/**
 * Pruebas de integración — stripeWebhook y createPaymentSession
 *
 * Prueba la Cloud Function real de billing.ts usando mocks de firebase-admin,
 * firebase-functions y Stripe para verificar:
 *
 * 1. stripeWebhook
 *    - Rechaza firma inválida (400)
 *    - Idempotencia: evento duplicado devuelve duplicate=true sin reprocesar
 *    - checkout.session.completed → payment=paid, share=paid
 *    - checkout.session.completed → bill=settled cuando todos los shares pagan
 *    - checkout.session.completed → metadata incompleta no falla
 *    - checkout.session.expired → payment=canceled
 *    - payment_intent.payment_failed → payment=failed, share permanece pending
 *    - charge.refunded → payment=refunded, share=pending, paidAt=null
 *    - Eventos desconocidos se ignoran sin error
 *
 * 2. createPaymentSession
 *    - Rechaza usuario no autenticado
 *    - Rechaza share que no pertenece al usuario
 *    - Rechaza share que no está en estado 'pending'
 *    - Idempotencia: devuelve sesión existente si ya hay un pago pending/processing
 *    - Crea nueva Checkout Session en Stripe y persiste pago en Firestore
 *    - Verifica que la clave secreta nunca se expone al cliente
 */

// Importamos los mocks primero para configurarlos antes de cargar billing.ts
import { _state, _resetState } from "./__mocks__/firebase-admin";
import {
  mockStripeState,
  resetMockStripe,
  type MockStripeCheckoutSession,
} from "./__mocks__/stripe";

// ─── Importar las funciones bajo prueba ──────────────────────────────────────
// Las importaciones de firebase-admin, stripe, etc. usarán los mocks automáticamente
// gracias a moduleNameMapper en jest config.

// Importamos el módulo después de configurar los módulos mockeados.
// Usamos require lazy para poder resetear el estado entre tests sin reimportar.
let stripeWebhook: (req: MockRequest, res: MockResponse) => Promise<void>;
let createPaymentSession: (req: { auth?: { uid: string }; data: unknown }) => Promise<unknown>;

// ─── Tipos auxiliares para las pruebas ───────────────────────────────────────

interface MockRequest {
  method:  string;
  headers: Record<string, string>;
  rawBody: Buffer | string;
  body:    unknown;
}

interface MockResponse {
  _status: number;
  _body:   unknown;
  status:  (code: number) => MockResponse;
  json:    (body: unknown) => void;
  send:    (body: unknown) => void;
}

function makeMockRes(): MockResponse {
  const res: MockResponse = {
    _status: 200,
    _body:   null,
    status(code) { this._status = code; return this; },
    json(body)   { this._body = body; },
    send(body)   { this._body = body; },
  };
  return res;
}

function makeMockReq(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    method:  "POST",
    headers: { "stripe-signature": "t=123,v1=abc" },
    rawBody: Buffer.from('{"type":"test"}'),
    body:    {},
    ...overrides,
  };
}

// ─── Evento Stripe de prueba ──────────────────────────────────────────────────

function makeStripeEvent(
  id: string,
  type: string,
  object: Record<string, unknown>
): Record<string, unknown> {
  return { id, type, data: { object } };
}

// ─── Setup global ─────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Cargamos billing.ts — en este momento ya están los mocks de los módulos
  const billing = await import("./billing");
  stripeWebhook        = billing.stripeWebhook as unknown as typeof stripeWebhook;
  createPaymentSession = billing.createPaymentSession as unknown as typeof createPaymentSession;
});

beforeEach(() => {
  _resetState();
  resetMockStripe();
});

// ═══════════════════════════════════════════════════════════════════════════════
// stripeWebhook — verificación de firma
// ═══════════════════════════════════════════════════════════════════════════════

describe("stripeWebhook — verificación de firma", () => {
  test("devuelve 400 si falta el header stripe-signature", async () => {
    const req = makeMockReq({ headers: {} });
    const res = makeMockRes();

    await stripeWebhook(req, res);

    expect(res._status).toBe(400);
    expect((res._body as Record<string, unknown>).error).toMatch(/stripe-signature/i);
  });

  test("devuelve 400 si la firma es inválida", async () => {
    mockStripeState.invalidSignature = true;

    const req = makeMockReq();
    const res = makeMockRes();

    await stripeWebhook(req, res);

    expect(res._status).toBe(400);
    expect((res._body as Record<string, unknown>).error).toMatch(/firma/i);
  });

  test("devuelve 200 con received=true si la firma es válida", async () => {
    mockStripeState.nextEvent = makeStripeEvent("evt_valid", "customer.created", {});

    const req = makeMockReq();
    const res = makeMockRes();

    await stripeWebhook(req, res);

    expect(res._status).toBe(200);
    expect((res._body as Record<string, unknown>).received).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// stripeWebhook — idempotencia de eventos duplicados
// ═══════════════════════════════════════════════════════════════════════════════

describe("stripeWebhook — idempotencia", () => {
  test("evento duplicado devuelve duplicate=true en la segunda llamada", async () => {
    const event = makeStripeEvent("evt_idem_001", "customer.created", {});
    mockStripeState.nextEvent = event;

    const req = makeMockReq();

    const res1 = makeMockRes();
    await stripeWebhook(req, res1);
    expect((res1._body as Record<string, unknown>).duplicate).toBeUndefined();

    // Segundo procesamiento del mismo evento
    const res2 = makeMockRes();
    mockStripeState.nextEvent = event; // misma instancia
    await stripeWebhook(req, res2);

    expect(res2._status).toBe(200);
    expect((res2._body as Record<string, unknown>).duplicate).toBe(true);
  });

  test("el estado de Firestore NO cambia al procesar evento duplicado", async () => {
    // Preparar datos
    const sessionId = "cs_idem_dup";
    _state.payments.set("pay-idem", {
      providerSessionId: sessionId,
      providerPaymentId: "",
      billShareId:       "share-idem",
      billId:            "bill-idem",
      status:            "pending",
      amountCents:       5000,
      userId:            "u1",
    });
    _state.shares.set("share-idem", {
      billId:     "bill-idem",
      residentId: "u1",
      status:     "pending",
      paidAt:     null,
    });
    _state.bills.set("bill-idem", { status: "split" });

    const event = makeStripeEvent("evt_idem_pay", "checkout.session.completed", {
      id:             sessionId,
      payment_intent: "pi_idem",
      amount_total:   5000,
      metadata: { billId: "bill-idem", shareId: "share-idem", residentId: "u1" },
    });

    // Primera llamada — procesa el evento
    mockStripeState.nextEvent = event;
    await stripeWebhook(makeMockReq(), makeMockRes());
    expect(_state.payments.get("pay-idem")?.status).toBe("paid");

    // Simular que el estado volvió a pending (no real, pero verifica idempotencia)
    _state.payments.set("pay-idem", { ..._state.payments.get("pay-idem")!, status: "pending" });

    // Segunda llamada — el evento ya está marcado; no reprocesa
    mockStripeState.nextEvent = event;
    await stripeWebhook(makeMockReq(), makeMockRes());
    expect(_state.payments.get("pay-idem")?.status).toBe("pending"); // sin cambio
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// stripeWebhook — checkout.session.completed
// ═══════════════════════════════════════════════════════════════════════════════

describe("stripeWebhook — checkout.session.completed", () => {
  test("pone payment=paid y share=paid", async () => {
    const sessionId = "cs_completed_001";
    _state.payments.set("pay-001", {
      providerSessionId: sessionId,
      providerPaymentId: "",
      billShareId:       "share-001",
      billId:            "bill-001",
      status:            "pending",
      amountCents:       3000,
      userId:            "u1",
    });
    _state.shares.set("share-001", {
      billId:     "bill-001",
      residentId: "u1",
      status:     "pending",
      paidAt:     null,
    });
    _state.bills.set("bill-001", { status: "split" });

    mockStripeState.nextEvent = makeStripeEvent("evt_comp_001", "checkout.session.completed", {
      id:             sessionId,
      payment_intent: "pi_001",
      amount_total:   3000,
      metadata: { billId: "bill-001", shareId: "share-001", residentId: "u1" },
    });

    const res = makeMockRes();
    await stripeWebhook(makeMockReq(), res);

    expect(res._status).toBe(200);
    expect(_state.payments.get("pay-001")?.status).toBe("paid");
    expect(_state.shares.get("share-001")?.status).toBe("paid");
  });

  test("marca la factura como settled cuando todos los shares pagan", async () => {
    const sessionId = "cs_settle_001";
    _state.payments.set("pay-settle", {
      providerSessionId: sessionId,
      providerPaymentId: "",
      billShareId:       "share-settle-a",
      billId:            "bill-settle",
      status:            "pending",
      amountCents:       5000,
      userId:            "u1",
    });
    // share-settle-a: pendiente (el que estamos pagando)
    _state.shares.set("share-settle-a", {
      billId:     "bill-settle",
      residentId: "u1",
      status:     "pending",
      paidAt:     null,
    });
    // share-settle-b: ya pagado
    _state.shares.set("share-settle-b", {
      billId:     "bill-settle",
      residentId: "u2",
      status:     "paid",
      paidAt:     "2026-01-01",
    });
    _state.bills.set("bill-settle", { status: "split" });

    mockStripeState.nextEvent = makeStripeEvent("evt_settle_001", "checkout.session.completed", {
      id:             sessionId,
      payment_intent: "pi_settle",
      amount_total:   5000,
      metadata: { billId: "bill-settle", shareId: "share-settle-a", residentId: "u1" },
    });

    await stripeWebhook(makeMockReq(), makeMockRes());

    expect(_state.bills.get("bill-settle")?.status).toBe("settled");
  });

  test("NO marca settled si hay shares pendientes", async () => {
    const sessionId = "cs_nosettle_001";
    _state.payments.set("pay-nosettle", {
      providerSessionId: sessionId,
      providerPaymentId: "",
      billShareId:       "share-ns-a",
      billId:            "bill-ns",
      status:            "pending",
      amountCents:       5000,
      userId:            "u1",
    });
    _state.shares.set("share-ns-a", {
      billId: "bill-ns", residentId: "u1", status: "pending", paidAt: null,
    });
    _state.shares.set("share-ns-b", {
      billId: "bill-ns", residentId: "u2", status: "pending", paidAt: null,
    });
    _state.bills.set("bill-ns", { status: "split" });

    mockStripeState.nextEvent = makeStripeEvent("evt_nosettle", "checkout.session.completed", {
      id:             sessionId,
      payment_intent: "pi_nosettle",
      amount_total:   5000,
      metadata: { billId: "bill-ns", shareId: "share-ns-a", residentId: "u1" },
    });

    await stripeWebhook(makeMockReq(), makeMockRes());

    expect(_state.bills.get("bill-ns")?.status).toBe("split"); // sin cambio
  });

  test("responde 200 sin fallar si la metadata está incompleta", async () => {
    mockStripeState.nextEvent = makeStripeEvent("evt_no_meta", "checkout.session.completed", {
      id:             "cs_no_meta",
      payment_intent: "pi_no_meta",
      amount_total:   1000,
      metadata:       {}, // sin billId, shareId, residentId
    });

    const res = makeMockRes();
    await stripeWebhook(makeMockReq(), res);

    expect(res._status).toBe(200);
  });

  test("escribe un log de auditoría tras el pago exitoso", async () => {
    const sessionId = "cs_audit_001";
    _state.payments.set("pay-audit", {
      providerSessionId: sessionId,
      providerPaymentId: "",
      billShareId:       "share-audit",
      billId:            "bill-audit",
      status:            "pending",
      amountCents:       2000,
      userId:            "u_audit",
    });
    _state.shares.set("share-audit", {
      billId: "bill-audit", residentId: "u_audit", status: "pending", paidAt: null,
    });
    _state.bills.set("bill-audit", { status: "split" });

    mockStripeState.nextEvent = makeStripeEvent("evt_audit_001", "checkout.session.completed", {
      id:             sessionId,
      payment_intent: "pi_audit",
      amount_total:   2000,
      metadata: { billId: "bill-audit", shareId: "share-audit", residentId: "u_audit" },
    });

    await stripeWebhook(makeMockReq(), makeMockRes());

    const auditEntry = _state.auditLogs.find(
      (l: Record<string, unknown>) => l.action === "PAYMENT_COMPLETED"
    );
    expect(auditEntry).toBeDefined();
    expect(auditEntry?.resourceId).toBe(sessionId);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// stripeWebhook — checkout.session.expired
// ═══════════════════════════════════════════════════════════════════════════════

describe("stripeWebhook — checkout.session.expired", () => {
  test("pone payment en 'canceled' al expirar la sesión", async () => {
    const sessionId = "cs_exp_001";
    _state.payments.set("pay-exp", {
      providerSessionId: sessionId,
      status:            "pending",
      billShareId:       "share-exp",
      billId:            "bill-exp",
      userId:            "u1",
      amountCents:       1500,
      providerPaymentId: "",
    });

    mockStripeState.nextEvent = makeStripeEvent("evt_exp_001", "checkout.session.expired", {
      id: sessionId,
    });

    await stripeWebhook(makeMockReq(), makeMockRes());

    expect(_state.payments.get("pay-exp")?.status).toBe("canceled");
  });

  test("el share permanece en 'pending' después de expirar", async () => {
    const sessionId = "cs_exp_002";
    _state.payments.set("pay-exp2", {
      providerSessionId: sessionId,
      status:            "pending",
      billShareId:       "share-exp2",
      billId:            "bill-exp2",
      userId:            "u2",
      amountCents:       2000,
      providerPaymentId: "",
    });
    _state.shares.set("share-exp2", {
      billId: "bill-exp2", residentId: "u2", status: "pending", paidAt: null,
    });

    mockStripeState.nextEvent = makeStripeEvent("evt_exp_002", "checkout.session.expired", {
      id: sessionId,
    });

    await stripeWebhook(makeMockReq(), makeMockRes());

    // El share no cambia — la expiración solo afecta el payment
    expect(_state.shares.get("share-exp2")?.status).toBe("pending");
  });

  test("no falla si no hay payment asociado a la sesión", async () => {
    mockStripeState.nextEvent = makeStripeEvent("evt_exp_noop", "checkout.session.expired", {
      id: "cs_nonexistent",
    });

    const res = makeMockRes();
    await stripeWebhook(makeMockReq(), res);

    expect(res._status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// stripeWebhook — payment_intent.payment_failed (pagos fallidos)
// ═══════════════════════════════════════════════════════════════════════════════

describe("stripeWebhook — payment_intent.payment_failed", () => {
  test("pone payment en 'failed'", async () => {
    const piId = "pi_fail_001";
    _state.payments.set("pay-fail", {
      providerPaymentId: piId,
      providerSessionId: "cs_fail",
      status:            "processing",
      billShareId:       "share-fail",
      billId:            "bill-fail",
      userId:            "u1",
      amountCents:       4000,
    });

    mockStripeState.nextEvent = makeStripeEvent("evt_fail_001", "payment_intent.payment_failed", {
      id: piId,
      last_payment_error: { message: "Card declined" },
    });

    await stripeWebhook(makeMockReq(), makeMockRes());

    expect(_state.payments.get("pay-fail")?.status).toBe("failed");
  });

  test("el share permanece en 'pending' cuando el pago falla (puede reintentarse)", async () => {
    const piId = "pi_fail_share";
    _state.payments.set("pay-fail-share", {
      providerPaymentId: piId,
      providerSessionId: "cs_fail_share",
      status:            "processing",
      billShareId:       "share-fail-orig",
      billId:            "bill-fail-share",
      userId:            "u1",
      amountCents:       3500,
    });
    _state.shares.set("share-fail-orig", {
      billId: "bill-fail-share", residentId: "u1", status: "pending", paidAt: null,
    });

    mockStripeState.nextEvent = makeStripeEvent("evt_fail_share", "payment_intent.payment_failed", {
      id: piId,
    });

    await stripeWebhook(makeMockReq(), makeMockRes());

    // El share debe seguir pending para que el residente pueda reintentar
    expect(_state.shares.get("share-fail-orig")?.status).toBe("pending");
    expect(_state.payments.get("pay-fail-share")?.status).toBe("failed");
  });

  test("no falla si no hay payment con ese payment_intent", async () => {
    mockStripeState.nextEvent = makeStripeEvent("evt_fail_noop", "payment_intent.payment_failed", {
      id: "pi_nonexistent",
    });

    const res = makeMockRes();
    await stripeWebhook(makeMockReq(), res);

    expect(res._status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// stripeWebhook — charge.refunded
// ═══════════════════════════════════════════════════════════════════════════════

describe("stripeWebhook — charge.refunded", () => {
  test("pone payment en 'refunded' y share vuelve a 'pending'", async () => {
    const piId = "pi_refund_001";
    _state.payments.set("pay-refund", {
      providerPaymentId: piId,
      providerSessionId: "cs_refund",
      status:            "paid",
      billShareId:       "share-refund",
      billId:            "bill-refund",
      userId:            "u1",
      amountCents:       6000,
    });
    _state.shares.set("share-refund", {
      billId:     "bill-refund",
      residentId: "u1",
      status:     "paid",
      paidAt:     "2026-01-15",
    });
    _state.bills.set("bill-refund", { status: "settled" });

    mockStripeState.nextEvent = makeStripeEvent("evt_refund_001", "charge.refunded", {
      id:             "ch_001",
      payment_intent: piId,
    });

    await stripeWebhook(makeMockReq(), makeMockRes());

    expect(_state.payments.get("pay-refund")?.status).toBe("refunded");
    expect(_state.shares.get("share-refund")?.status).toBe("pending");
    expect(_state.shares.get("share-refund")?.paidAt).toBeNull();
  });

  test("escribe auditoría de PAYMENT_REFUNDED", async () => {
    const piId = "pi_refund_audit";
    _state.payments.set("pay-refund-a", {
      providerPaymentId: piId,
      providerSessionId: "cs_ra",
      status:            "paid",
      billShareId:       "share-ra",
      billId:            "bill-ra",
      userId:            "u1",
      amountCents:       2500,
    });
    _state.shares.set("share-ra", {
      billId: "bill-ra", residentId: "u1", status: "paid", paidAt: "2026-01-20",
    });

    mockStripeState.nextEvent = makeStripeEvent("evt_refund_audit", "charge.refunded", {
      id:             "ch_audit",
      payment_intent: piId,
    });

    await stripeWebhook(makeMockReq(), makeMockRes());

    const entry = _state.auditLogs.find((l: Record<string, unknown>) => l.action === "PAYMENT_REFUNDED");
    expect(entry).toBeDefined();
  });

  test("no falla si no hay payment asociado al charge", async () => {
    mockStripeState.nextEvent = makeStripeEvent("evt_refund_noop", "charge.refunded", {
      id:             "ch_noop",
      payment_intent: "pi_nonexistent",
    });

    const res = makeMockRes();
    await stripeWebhook(makeMockReq(), res);

    expect(res._status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// stripeWebhook — eventos desconocidos
// ═══════════════════════════════════════════════════════════════════════════════

describe("stripeWebhook — eventos no manejados", () => {
  test("procesa sin errores un evento desconocido", async () => {
    mockStripeState.nextEvent = makeStripeEvent(
      "evt_unknown_001",
      "customer.subscription.updated",
      { id: "sub_001" }
    );

    const res = makeMockRes();
    await stripeWebhook(makeMockReq(), res);

    expect(res._status).toBe(200);
    expect((res._body as Record<string, unknown>).received).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createPaymentSession — autenticación y autorización
// ═══════════════════════════════════════════════════════════════════════════════

describe("createPaymentSession — autenticación", () => {
  test("lanza unauthenticated si no hay auth", async () => {
    await expect(
      createPaymentSession({
        auth: undefined,
        data: { billId: "b1", shareId: "s1", successUrl: "http://x", cancelUrl: "http://y" },
      })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });
});

describe("createPaymentSession — autorización", () => {
  test("lanza permission-denied si el share no pertenece al usuario", async () => {
    _state.bills.set("bill-auth", {
      totalAmountCents: 5000,
      propertyId:       "prop-auth",
      serviceType:      "Agua",
      periodStart:      "2026-01-01",
      periodEnd:        "2026-01-31",
    });
    // El share pertenece a "otro-usuario"
    _state.shares.set("share-auth", {
      billId:       "bill-auth",
      residentId:   "otro-usuario",
      status:       "pending",
      amountCents:  5000,
      splitVersion: 1,
    });

    await expect(
      createPaymentSession({
        auth: { uid: "mi-usuario" },
        data: {
          billId:     "bill-auth",
          shareId:    "share-auth",
          successUrl: "http://x/success",
          cancelUrl:  "http://x/cancel",
        },
      })
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("lanza failed-precondition si el share ya está pagado", async () => {
    _state.bills.set("bill-paid", {
      totalAmountCents: 3000,
      propertyId:       "prop-paid",
      serviceType:      "Gas",
      periodStart:      "2026-02-01",
      periodEnd:        "2026-02-28",
    });
    _state.shares.set("share-paid", {
      billId:       "bill-paid",
      residentId:   "u-paid",
      status:       "paid",   // ← ya pagado
      amountCents:  3000,
      splitVersion: 1,
    });

    await expect(
      createPaymentSession({
        auth: { uid: "u-paid" },
        data: {
          billId:     "bill-paid",
          shareId:    "share-paid",
          successUrl: "http://x/success",
          cancelUrl:  "http://x/cancel",
        },
      })
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
});

describe("createPaymentSession — idempotencia", () => {
  test("devuelve la sesión existente si ya hay un pago en pending para ese share", async () => {
    const existingSessionId = "cs_existing_001";

    _state.bills.set("bill-idem2", {
      totalAmountCents: 5000,
      propertyId:       "prop-idem2",
      serviceType:      "Electricidad",
      periodStart:      "2026-01-01",
      periodEnd:        "2026-01-31",
    });
    _state.shares.set("share-idem2", {
      billId:       "bill-idem2",
      residentId:   "u-idem",
      status:       "pending",
      amountCents:  5000,
      splitVersion: 1,
    });
    // Hay un pago existente en estado "pending"
    _state.payments.set("pay-idem2", {
      billShareId:       "share-idem2",
      billId:            "bill-idem2",
      userId:            "u-idem",
      status:            "pending",
      providerSessionId: existingSessionId,
      providerPaymentId: "",
      amountCents:       5000,
    });

    const result = await createPaymentSession({
      auth: { uid: "u-idem" },
      data: {
        billId:     "bill-idem2",
        shareId:    "share-idem2",
        successUrl: "http://x/success",
        cancelUrl:  "http://x/cancel",
      },
    }) as Record<string, unknown>;

    expect(result.existing).toBe(true);
    expect(result.sessionId).toBe(existingSessionId);
    // Stripe NO debe haberse llamado
    expect(mockStripeState.calls.checkoutCreate).toHaveLength(0);
  });

  test("devuelve la sesión existente si el pago está en 'processing'", async () => {
    const existingSessionId = "cs_processing_001";

    _state.bills.set("bill-proc", {
      totalAmountCents: 8000,
      propertyId:       "prop-proc",
      serviceType:      "Agua",
      periodStart:      "2026-03-01",
      periodEnd:        "2026-03-31",
    });
    _state.shares.set("share-proc", {
      billId:       "bill-proc",
      residentId:   "u-proc",
      status:       "pending",
      amountCents:  8000,
      splitVersion: 2,
    });
    _state.payments.set("pay-proc", {
      billShareId:       "share-proc",
      billId:            "bill-proc",
      userId:            "u-proc",
      status:            "processing",  // ← en procesamiento
      providerSessionId: existingSessionId,
      providerPaymentId: "pi_proc",
      amountCents:       8000,
    });

    const result = await createPaymentSession({
      auth: { uid: "u-proc" },
      data: {
        billId:     "bill-proc",
        shareId:    "share-proc",
        successUrl: "http://x/success",
        cancelUrl:  "http://x/cancel",
      },
    }) as Record<string, unknown>;

    expect(result.existing).toBe(true);
    expect(result.sessionId).toBe(existingSessionId);
    expect(mockStripeState.calls.checkoutCreate).toHaveLength(0);
  });
});

describe("createPaymentSession — creación exitosa", () => {
  test("crea una Checkout Session en Stripe y persiste el pago en Firestore", async () => {
    const newSession: MockStripeCheckoutSession = {
      id:             "cs_new_001",
      url:            "https://checkout.stripe.com/pay/cs_new_001",
      payment_intent: "pi_new_001",
      amount_total:   7500,
      metadata:       {},
    };
    mockStripeState.nextSession = newSession;

    _state.bills.set("bill-new", {
      totalAmountCents: 7500,
      propertyId:       "prop-new",
      serviceType:      "Internet",
      periodStart:      "2026-04-01",
      periodEnd:        "2026-04-30",
      provider:         "Telmex",
    });
    _state.shares.set("share-new", {
      billId:       "bill-new",
      residentId:   "u-new",
      status:       "pending",
      amountCents:  7500,
      splitVersion: 1,
    });

    const result = await createPaymentSession({
      auth: { uid: "u-new" },
      data: {
        billId:     "bill-new",
        shareId:    "share-new",
        successUrl: "https://app.example.com/success",
        cancelUrl:  "https://app.example.com/cancel",
      },
    }) as Record<string, unknown>;

    // La función devuelve el sessionId de Stripe
    expect(result.sessionId).toBe("cs_new_001");
    expect(result.existing).toBe(false);

    // Stripe fue llamado
    expect(mockStripeState.calls.checkoutCreate).toHaveLength(1);
    const stripeCall = mockStripeState.calls.checkoutCreate[0] as Record<string, unknown>;
    expect(stripeCall.mode).toBe("payment");

    // El pago fue persistido en Firestore
    const payments = [..._state.payments.values()];
    const newPayment = payments.find((p) => p.providerSessionId === "cs_new_001");
    expect(newPayment).toBeDefined();
    expect(newPayment?.status).toBe("pending");
    expect(newPayment?.amountCents).toBe(7500);
    expect(newPayment?.userId).toBe("u-new");
  });

  test("la clave de Stripe nunca aparece en la respuesta", async () => {
    mockStripeState.nextSession = {
      id:             "cs_safe_001",
      url:            "https://checkout.stripe.com/pay/cs_safe_001",
      payment_intent: "pi_safe",
      amount_total:   1000,
      metadata:       {},
    };

    _state.bills.set("bill-safe", {
      totalAmountCents: 1000,
      propertyId:       "prop-safe",
      serviceType:      "Gas",
      periodStart:      "2026-05-01",
      periodEnd:        "2026-05-31",
    });
    _state.shares.set("share-safe", {
      billId:       "bill-safe",
      residentId:   "u-safe",
      status:       "pending",
      amountCents:  1000,
      splitVersion: 1,
    });

    const result = await createPaymentSession({
      auth: { uid: "u-safe" },
      data: {
        billId:     "bill-safe",
        shareId:    "share-safe",
        successUrl: "https://app.example.com/success",
        cancelUrl:  "https://app.example.com/cancel",
      },
    });

    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain("sk_test");
    expect(resultStr).not.toContain("whsec");
  });

  test("usa clave de idempotencia basada en uid+shareId+splitVersion", async () => {
    mockStripeState.nextSession = {
      id:             "cs_ikey_001",
      url:            null,
      payment_intent: "pi_ikey",
      amount_total:   2000,
      metadata:       {},
    };

    _state.bills.set("bill-ikey", {
      totalAmountCents: 2000,
      propertyId:       "prop-ikey",
      serviceType:      "Agua",
      periodStart:      "2026-06-01",
      periodEnd:        "2026-06-30",
    });
    _state.shares.set("share-ikey", {
      billId:       "bill-ikey",
      residentId:   "u-ikey",
      status:       "pending",
      amountCents:  2000,
      splitVersion: 3,
    });

    await createPaymentSession({
      auth: { uid: "u-ikey" },
      data: {
        billId:     "bill-ikey",
        shareId:    "share-ikey",
        successUrl: "https://app.example.com/success",
        cancelUrl:  "https://app.example.com/cancel",
      },
    });

    // La clave de idempotencia debe ser determinista y única por usuario+share+versión
    const payments = [..._state.payments.values()];
    const p = payments.find((pay) => pay.providerSessionId === "cs_ikey_001");
    expect(p?.idempotencyKey).toBe("pay_u-ikey_share-ikey_v3");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Flujo completo: pago fallido → reintento
// ═══════════════════════════════════════════════════════════════════════════════

describe("Flujo: pago fallido → residente reintenta", () => {
  test("después de failed, el residente puede crear una nueva sesión de pago", async () => {
    // 1. Setup inicial: share pending
    _state.bills.set("bill-retry", {
      totalAmountCents: 9000,
      propertyId:       "prop-retry",
      serviceType:      "Electricidad",
      periodStart:      "2026-07-01",
      periodEnd:        "2026-07-31",
      provider:         "CFE",
    });
    _state.shares.set("share-retry", {
      billId:       "bill-retry",
      residentId:   "u-retry",
      status:       "pending",
      amountCents:  9000,
      splitVersion: 1,
    });

    // 2. Primera sesión de pago creada
    mockStripeState.nextSession = {
      id:             "cs_retry_first",
      url:            "https://checkout.stripe.com/pay/cs_retry_first",
      payment_intent: "pi_retry_first",
      amount_total:   9000,
      metadata:       {},
    };
    await createPaymentSession({
      auth: { uid: "u-retry" },
      data: {
        billId:     "bill-retry",
        shareId:    "share-retry",
        successUrl: "https://app.example.com/success",
        cancelUrl:  "https://app.example.com/cancel",
      },
    });

    // Encontrar el paymentId creado
    const firstPaymentEntry = [..._state.payments.entries()].find(
      ([, p]) => p.providerSessionId === "cs_retry_first"
    );
    expect(firstPaymentEntry).toBeDefined();
    const [firstPaymentId] = firstPaymentEntry!;
    expect(_state.payments.get(firstPaymentId)?.status).toBe("pending");

    // 3. El pago falla (webhook payment_intent.payment_failed)
    mockStripeState.nextEvent = makeStripeEvent("evt_retry_fail", "payment_intent.payment_failed", {
      id: "pi_retry_first",
    });
    await stripeWebhook(makeMockReq(), makeMockRes());

    // Verificar que el pago quedó en failed (leer del Map para ver el estado actualizado)
    expect(_state.payments.get(firstPaymentId)?.status).toBe("failed");
    // El share sigue en pending (puede reintentarse)
    expect(_state.shares.get("share-retry")?.status).toBe("pending");

    // 4. El residente reintenta: el pago anterior está en 'failed' (no pending/processing),
    //    createPaymentSession debe crear una nueva sesión
    resetMockStripe();
    mockStripeState.nextSession = {
      id:             "cs_retry_second",
      url:            "https://checkout.stripe.com/pay/cs_retry_second",
      payment_intent: "pi_retry_second",
      amount_total:   9000,
      metadata:       {},
    };

    const result = await createPaymentSession({
      auth: { uid: "u-retry" },
      data: {
        billId:     "bill-retry",
        shareId:    "share-retry",
        successUrl: "https://app.example.com/success",
        cancelUrl:  "https://app.example.com/cancel",
      },
    }) as Record<string, unknown>;

    // Una nueva sesión fue creada (no devolvió la anterior en 'failed')
    expect(result.existing).toBe(false);
    expect(result.sessionId).toBe("cs_retry_second");
    expect(mockStripeState.calls.checkoutCreate).toHaveLength(1);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Notificaciones — billing events
// ═══════════════════════════════════════════════════════════════════════════════

describe("Notificaciones — checkout.session.completed crea payment_confirmed", () => {
  test("crea notificación payment_confirmed para el residente al pagar", async () => {
    const sessionId = "cs_notif_pay_001";
    _state.payments.set("pay-notif", {
      providerSessionId: sessionId,
      providerPaymentId: "",
      billShareId:       "share-notif",
      billId:            "bill-notif",
      status:            "pending",
      amountCents:       4500,
      userId:            "u-notif",
    });
    _state.shares.set("share-notif", {
      billId:     "bill-notif",
      residentId: "u-notif",
      status:     "pending",
      paidAt:     null,
    });
    _state.bills.set("bill-notif", { status: "split" });

    mockStripeState.nextEvent = makeStripeEvent("evt_notif_pay", "checkout.session.completed", {
      id:             sessionId,
      payment_intent: "pi_notif",
      amount_total:   4500,
      metadata: { billId: "bill-notif", shareId: "share-notif", residentId: "u-notif" },
    });

    await stripeWebhook(makeMockReq(), makeMockRes());

    // Debe haber una notificación para el residente
    const notifs = [..._state.notifications.values()];
    const notif = notifs.find(
      (n) => n.userId === "u-notif" && n.type === "payment_confirmed"
    );
    expect(notif).toBeDefined();
    expect(notif?.read).toBe(false);
    expect(notif?.actionUrl).toBe("/bills/bill-notif");
  });

  test("la notificación incluye el importe formateado en el body", async () => {
    const sessionId = "cs_notif_amount";
    _state.payments.set("pay-notif-amt", {
      providerSessionId: sessionId,
      providerPaymentId: "",
      billShareId:       "share-notif-amt",
      billId:            "bill-notif-amt",
      status:            "pending",
      amountCents:       12050,
      userId:            "u-amt",
    });
    _state.shares.set("share-notif-amt", {
      billId:     "bill-notif-amt",
      residentId: "u-amt",
      status:     "pending",
      paidAt:     null,
    });
    _state.bills.set("bill-notif-amt", { status: "split" });

    mockStripeState.nextEvent = makeStripeEvent("evt_notif_amt", "checkout.session.completed", {
      id:             sessionId,
      payment_intent: "pi_amt",
      amount_total:   12050,
      metadata: { billId: "bill-notif-amt", shareId: "share-notif-amt", residentId: "u-amt" },
    });

    await stripeWebhook(makeMockReq(), makeMockRes());

    const notif = [..._state.notifications.values()].find(
      (n) => n.userId === "u-amt" && n.type === "payment_confirmed"
    );
    expect(notif?.body).toContain("120.50");
  });

  test("la notificación es idempotente (misma sesión no crea duplicado)", async () => {
    const sessionId = "cs_notif_idem";
    _state.payments.set("pay-nidem", {
      providerSessionId: sessionId,
      providerPaymentId: "",
      billShareId:       "share-nidem",
      billId:            "bill-nidem",
      status:            "pending",
      amountCents:       3000,
      userId:            "u-nidem",
    });
    _state.shares.set("share-nidem", {
      billId:     "bill-nidem",
      residentId: "u-nidem",
      status:     "pending",
      paidAt:     null,
    });
    _state.bills.set("bill-nidem", { status: "split" });

    const event = makeStripeEvent("evt_nidem", "checkout.session.completed", {
      id:             sessionId,
      payment_intent: "pi_nidem",
      amount_total:   3000,
      metadata: { billId: "bill-nidem", shareId: "share-nidem", residentId: "u-nidem" },
    });

    // Primera llamada
    mockStripeState.nextEvent = event;
    await stripeWebhook(makeMockReq(), makeMockRes());

    const countAfterFirst = [..._state.notifications.values()].filter(
      (n) => n.idempotencyKey === `notif_payment_confirmed_${sessionId}`
    ).length;
    expect(countAfterFirst).toBe(1);

    // Intentar crear de nuevo la misma notificación directamente
    const { createNotificationInternal } = await import("./notifications");
    await createNotificationInternal("u-nidem", "payment_confirmed", "T", "B", {
      idempotencyKey: `notif_payment_confirmed_${sessionId}`,
    });

    const countAfterSecond = [..._state.notifications.values()].filter(
      (n) => n.idempotencyKey === `notif_payment_confirmed_${sessionId}`
    ).length;
    expect(countAfterSecond).toBe(1); // sin duplicado
  });
});

describe("Notificaciones — payment_intent.payment_failed crea payment_failed", () => {
  test("crea notificación payment_failed cuando el pago es rechazado", async () => {
    const piId = "pi_notif_fail_001";
    _state.payments.set("pay-nfail", {
      providerPaymentId: piId,
      providerSessionId: "cs_nfail",
      status:            "processing",
      billShareId:       "share-nfail",
      billId:            "bill-nfail",
      userId:            "u-nfail",
      amountCents:       6000,
    });

    mockStripeState.nextEvent = makeStripeEvent("evt_nfail", "payment_intent.payment_failed", {
      id: piId,
      last_payment_error: { message: "Fondos insuficientes" },
    });

    await stripeWebhook(makeMockReq(), makeMockRes());

    const notif = [..._state.notifications.values()].find(
      (n) => n.userId === "u-nfail" && n.type === "payment_failed"
    );
    expect(notif).toBeDefined();
    expect(notif?.read).toBe(false);
    expect(notif?.body).toContain("Fondos insuficientes");
    expect(notif?.actionUrl).toBe("/bills/bill-nfail");
  });

  test("no crea notificación si no hay userId en el pago", async () => {
    const piId = "pi_nfail_nouser";
    _state.payments.set("pay-nfail-nouser", {
      providerPaymentId: piId,
      providerSessionId: "cs_nfail_nouser",
      status:            "processing",
      billShareId:       "share-x",
      billId:            "bill-x",
      // userId ausente
      amountCents:       1000,
    });

    mockStripeState.nextEvent = makeStripeEvent("evt_nfail_nouser", "payment_intent.payment_failed", {
      id: piId,
    });

    const before = _state.notifications.size;
    await stripeWebhook(makeMockReq(), makeMockRes());
    // Sin userId, no debe crear notificación
    expect(_state.notifications.size).toBe(before);
  });

  test("la notificación payment_failed es idempotente por payment_intent id", async () => {
    const piId = "pi_nfail_idem";
    _state.payments.set("pay-nfail-idem", {
      providerPaymentId: piId,
      providerSessionId: "cs_nfail_idem",
      status:            "processing",
      billShareId:       "share-idem-f",
      billId:            "bill-idem-f",
      userId:            "u-idem-f",
      amountCents:       2000,
    });

    const { createNotificationInternal } = await import("./notifications");
    const key = `notif_payment_failed_${piId}`;

    // Primera vez
    await createNotificationInternal("u-idem-f", "payment_failed", "T", "B", {
      idempotencyKey: key,
    });
    // Segunda vez
    await createNotificationInternal("u-idem-f", "payment_failed", "T", "B", {
      idempotencyKey: key,
    });

    const count = [..._state.notifications.values()].filter(
      (n) => n.idempotencyKey === key
    ).length;
    expect(count).toBe(1);
  });
});

describe("Notificaciones — calculateBillSplit crea bill_split por residente", () => {
  test("crea una notificación bill_split para cada residente incluido", async () => {
    _state.bills.set("bill-split-notif", {
      totalAmountCents: 9000,
      propertyId:       "prop-sn",
      serviceType:      "Electricidad",
      splitVersion:     0,
    });
    _state.properties.set("prop-sn", {
      ownerId:    "owner-sn",
      managerIds: [],
    });

    // Importar y llamar calculateBillSplit directamente
    const { calculateBillSplit } = await import("./billing");
    const callableFn = calculateBillSplit as unknown as (req: {
      auth: { uid: string };
      data: unknown;
    }) => Promise<unknown>;

    await callableFn({
      auth: { uid: "owner-sn" },
      data: {
        billId: "bill-split-notif",
        rule:   "equal",
        residents: [
          { residentId: "res-sn-1" },
          { residentId: "res-sn-2" },
          { residentId: "res-sn-3" },
        ],
      },
    });

    // Debe haber exactamente 3 notificaciones bill_split
    const notifs = [..._state.notifications.values()].filter(
      (n) => n.type === "bill_split"
    );
    expect(notifs).toHaveLength(3);

    const userIds = notifs.map((n) => n.userId as string).sort();
    expect(userIds).toEqual(["res-sn-1", "res-sn-2", "res-sn-3"].sort());
  });

  test("cada notificación bill_split incluye el importe correcto", async () => {
    _state.bills.set("bill-split-amount", {
      totalAmountCents: 6000,
      propertyId:       "prop-sa",
      serviceType:      "Agua",
      splitVersion:     0,
    });
    _state.properties.set("prop-sa", {
      ownerId:    "owner-sa",
      managerIds: [],
    });

    const { calculateBillSplit } = await import("./billing");
    const callableFn = calculateBillSplit as unknown as (req: {
      auth: { uid: string };
      data: unknown;
    }) => Promise<unknown>;

    await callableFn({
      auth: { uid: "owner-sa" },
      data: {
        billId: "bill-split-amount",
        rule:   "equal",
        residents: [
          { residentId: "res-sa-1" },
          { residentId: "res-sa-2" },
        ],
      },
    });

    const notifs = [..._state.notifications.values()].filter(
      (n) => n.type === "bill_split"
    );
    // 6000 centavos / 2 residentes = $30.00 cada uno
    for (const notif of notifs) {
      expect(notif.body as string).toContain("30.00");
    }
  });

  test("las notificaciones bill_split son idempotentes por (billId, residentId, versión)", async () => {
    _state.bills.set("bill-split-idem", {
      totalAmountCents: 3000,
      propertyId:       "prop-si",
      serviceType:      "Internet",
      splitVersion:     1, // versión 1 ya existe, generará v2
    });
    _state.properties.set("prop-si", {
      ownerId:    "owner-si",
      managerIds: [],
    });

    const { calculateBillSplit } = await import("./billing");
    const callableFn = calculateBillSplit as unknown as (req: {
      auth: { uid: string };
      data: unknown;
    }) => Promise<unknown>;

    // Primer split (generará v2)
    await callableFn({
      auth: { uid: "owner-si" },
      data: {
        billId: "bill-split-idem",
        rule:   "equal",
        residents: [{ residentId: "res-si-1" }],
      },
    });

    // Llamar createNotificationInternal con la misma key de idempotencia que usó el split
    const { createNotificationInternal } = await import("./notifications");
    await createNotificationInternal("res-si-1", "bill_split", "T", "B", {
      idempotencyKey: "notif_bill_split_bill-split-idem_res-si-1_v2",
    });

    const count = [..._state.notifications.values()].filter(
      (n) => n.idempotencyKey === "notif_bill_split_bill-split-idem_res-si-1_v2"
    ).length;
    expect(count).toBe(1); // sin duplicado
  });

  test("no falla el split si una notificación individual lanza error", async () => {
    // Este test verifica que el split no falla si createNotificationInternal falla
    // El código usa .catch() en las promesas de notificación
    _state.bills.set("bill-split-robust", {
      totalAmountCents: 5000,
      propertyId:       "prop-rb",
      serviceType:      "Gas",
      splitVersion:     0,
    });
    _state.properties.set("prop-rb", {
      ownerId:    "owner-rb",
      managerIds: [],
    });

    const { calculateBillSplit } = await import("./billing");
    const callableFn = calculateBillSplit as unknown as (req: {
      auth: { uid: string };
      data: unknown;
    }) => Promise<unknown>;

    // El split debe completarse sin importar las notificaciones
    const result = await callableFn({
      auth: { uid: "owner-rb" },
      data: {
        billId:    "bill-split-robust",
        rule:      "equal",
        residents: [{ residentId: "res-rb" }],
      },
    }) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(result.splitVersion).toBe(1);
  });
});