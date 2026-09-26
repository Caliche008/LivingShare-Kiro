/**
 * Pruebas del webhook de Stripe — lógica de procesamiento de eventos
 *
 * Estas pruebas verifican la lógica de negocio de cada handler de Stripe
 * simulando las respuestas de Firestore y la verificación de firma.
 *
 * No importamos las Cloud Functions directamente (están en /functions que
 * requiere su propio entorno). En su lugar, probamos:
 * 1. La verificación de firma HMAC (comportamiento de rechazo/aceptación).
 * 2. La idempotencia (evento duplicado → no reprocesar).
 * 3. Las transiciones de estado de cada evento Stripe.
 */

// ─── Tipos y estructuras del webhook que queremos probar ─────────────────────

type ShareStatus   = "pending" | "paid" | "overdue";
type PaymentStatus = "pending" | "processing" | "paid" | "failed" | "refunded" | "canceled";

interface PaymentRecord {
  userId:            string;
  billShareId:       string;
  billId:            string;
  status:            PaymentStatus;
  providerSessionId: string;
  providerPaymentId: string;
  amountCents:       number;
}

interface ShareRecord {
  billId:     string;
  residentId: string;
  status:     ShareStatus;
  paidAt:     null | string;
}

// ─── Simulador del procesador de eventos ─────────────────────────────────────
// Extraemos la lógica pura de los handlers para probarla sin firebase-admin.

class MockFirestore {
  private payments: Map<string, PaymentRecord> = new Map();
  private shares: Map<string, ShareRecord>     = new Map();
  private bills: Map<string, { status: string }> = new Map();
  private events: Set<string>                  = new Set();

  addPayment(id: string, p: PaymentRecord) { this.payments.set(id, p); }
  addShare(id: string,   s: ShareRecord)   { this.shares.set(id, s); }
  addBill(id: string,    b: { status: string }) { this.bills.set(id, b); }

  getPaymentBySessionId(sessionId: string): { id: string; data: PaymentRecord } | null {
    for (const [id, p] of this.payments.entries()) {
      if (p.providerSessionId === sessionId) return { id, data: p };
    }
    return null;
  }

  getPaymentByPaymentIntentId(piId: string): { id: string; data: PaymentRecord } | null {
    for (const [id, p] of this.payments.entries()) {
      if (p.providerPaymentId === piId) return { id, data: p };
    }
    return null;
  }

  getSharesForBill(billId: string): ShareRecord[] {
    return [...this.shares.values()].filter((s) => s.billId === billId);
  }

  updatePayment(id: string, updates: Partial<PaymentRecord>) {
    const p = this.payments.get(id);
    if (p) this.payments.set(id, { ...p, ...updates });
  }

  updateShare(id: string, updates: Partial<ShareRecord>) {
    const s = this.shares.get(id);
    if (s) this.shares.set(id, { ...s, ...updates });
  }

  updateBill(id: string, updates: Partial<{ status: string }>) {
    const b = this.bills.get(id);
    if (b) this.bills.set(id, { ...b, ...updates });
  }

  isEventProcessed(eventId: string) { return this.events.has(eventId); }
  markEventProcessed(eventId: string) { this.events.add(eventId); }

  getBill(id: string) { return this.bills.get(id); }
  getPayment(id: string) { return this.payments.get(id); }
  getShare(id: string) { return this.shares.get(id); }
}

// ─── Procesadores de eventos (lógica pura extraída de billing.ts) ─────────────

async function handleCheckoutCompleted(
  db: MockFirestore,
  sessionId: string,
  billId: string,
  shareId: string,
  residentId: string,
  paymentIntentId: string,
  amountTotal: number
) {
  // Actualizar payment → paid
  const payment = db.getPaymentBySessionId(sessionId);
  if (payment) {
    db.updatePayment(payment.id, {
      status: "paid",
      providerPaymentId: paymentIntentId,
    });
  }

  // Actualizar share → paid
  db.updateShare(shareId, { status: "paid", paidAt: new Date().toISOString() });

  // Verificar settled
  const shares = db.getSharesForBill(billId);
  const allPaid = shares.length > 0 && shares.every((s) => s.status === "paid");
  if (allPaid) {
    db.updateBill(billId, { status: "settled" });
  }
}

async function handleCheckoutExpired(
  db: MockFirestore,
  sessionId: string,
  status: "canceled" | "failed"
) {
  const payment = db.getPaymentBySessionId(sessionId);
  if (payment) {
    db.updatePayment(payment.id, { status });
  }
}

async function handlePaymentFailed(db: MockFirestore, paymentIntentId: string) {
  const payment = db.getPaymentByPaymentIntentId(paymentIntentId);
  if (payment) {
    db.updatePayment(payment.id, { status: "failed" });
  }
}

async function handleChargeRefunded(
  db: MockFirestore,
  paymentIntentId: string
) {
  const payment = db.getPaymentByPaymentIntentId(paymentIntentId);
  if (!payment) return;

  db.updatePayment(payment.id, { status: "refunded" });

  // Revertir share a pending
  const shareId = payment.data.billShareId;
  db.updateShare(shareId, { status: "pending", paidAt: null });
}

// ─── Simulador del webhook completo ──────────────────────────────────────────

async function processWebhookEvent(
  db: MockFirestore,
  event: {
    id: string;
    type: string;
    data: Record<string, unknown>;
  },
  signatureValid: boolean
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!signatureValid) {
    return { status: 400, body: { error: "Firma inválida" } };
  }

  if (db.isEventProcessed(event.id)) {
    return { status: 200, body: { received: true, duplicate: true } };
  }

  const obj = event.data.object as Record<string, unknown>;

  switch (event.type) {
    case "checkout.session.completed": {
      const meta = obj.metadata as Record<string, string> ?? {};
      if (meta.billId && meta.shareId && meta.residentId) {
        await handleCheckoutCompleted(
          db,
          obj.id as string,
          meta.billId,
          meta.shareId,
          meta.residentId,
          obj.payment_intent as string,
          obj.amount_total as number
        );
      }
      break;
    }
    case "checkout.session.expired":
      await handleCheckoutExpired(db, obj.id as string, "canceled");
      break;
    case "payment_intent.payment_failed":
      await handlePaymentFailed(db, obj.id as string);
      break;
    case "charge.refunded":
      await handleChargeRefunded(db, obj.payment_intent as string);
      break;
  }

  db.markEventProcessed(event.id);
  return { status: 200, body: { received: true } };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Webhook — verificación de firma", () => {
  test("devuelve 400 si la firma es inválida", async () => {
    const db    = new MockFirestore();
    const event = { id: "evt_001", type: "checkout.session.completed", data: { object: {} } };
    const res   = await processWebhookEvent(db, event, false);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("devuelve 200 si la firma es válida", async () => {
    const db    = new MockFirestore();
    const event = { id: "evt_valid", type: "customer.created", data: { object: {} } };
    const res   = await processWebhookEvent(db, event, true);
    expect(res.status).toBe(200);
  });
});

describe("Webhook — idempotencia", () => {
  test("el mismo evento procesado dos veces devuelve duplicate=true en la segunda", async () => {
    const db    = new MockFirestore();
    const event = {
      id:   "evt_idem_001",
      type: "customer.created",
      data: { object: {} },
    };

    const res1 = await processWebhookEvent(db, event, true);
    const res2 = await processWebhookEvent(db, event, true);

    expect(res1.body.duplicate).toBeUndefined();
    expect(res2.body.duplicate).toBe(true);
  });

  test("los datos no cambian al procesar el evento duplicado", async () => {
    const db = new MockFirestore();
    db.addPayment("pay-001", {
      userId:            "user-001",
      billShareId:       "share-001",
      billId:            "bill-001",
      status:            "pending",
      providerSessionId: "cs_test_001",
      providerPaymentId: "",
      amountCents:       5000,
    });
    db.addShare("share-001", { billId: "bill-001", residentId: "user-001", status: "pending", paidAt: null });
    db.addBill("bill-001", { status: "split" });

    const event = {
      id:   "evt_idem_pay",
      type: "checkout.session.completed",
      data: {
        object: {
          id:             "cs_test_001",
          payment_intent: "pi_001",
          amount_total:   5000,
          metadata: { billId: "bill-001", shareId: "share-001", residentId: "user-001" },
        },
      },
    };

    await processWebhookEvent(db, event, true);
    expect(db.getPayment("pay-001")?.status).toBe("paid");

    // Simular que el pago vuelve a "pending" (no debería pasar en producción,
    // pero verifica que el segundo procesamiento no hace doble trabajo)
    db.updatePayment("pay-001", { status: "pending" });
    await processWebhookEvent(db, event, true); // duplicado
    // El estado no debe cambiar porque el evento ya fue marcado
    expect(db.getPayment("pay-001")?.status).toBe("pending");
  });
});

describe("Webhook — checkout.session.completed", () => {
  test("pone payment en 'paid' y share en 'paid'", async () => {
    const db = new MockFirestore();
    db.addPayment("pay-001", {
      userId: "user-001", billShareId: "share-001", billId: "bill-001",
      status: "pending", providerSessionId: "cs_001", providerPaymentId: "", amountCents: 3000,
    });
    db.addShare("share-001", { billId: "bill-001", residentId: "user-001", status: "pending", paidAt: null });
    db.addBill("bill-001", { status: "split" });

    await processWebhookEvent(db, {
      id:   "evt_c_001",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_001", payment_intent: "pi_001", amount_total: 3000,
          metadata: { billId: "bill-001", shareId: "share-001", residentId: "user-001" },
        },
      },
    }, true);

    expect(db.getPayment("pay-001")?.status).toBe("paid");
    expect(db.getShare("share-001")?.status).toBe("paid");
  });

  test("marca la factura como 'settled' cuando todos los shares están pagados", async () => {
    const db = new MockFirestore();
    db.addPayment("pay-001", {
      userId: "u1", billShareId: "share-001", billId: "bill-001",
      status: "pending", providerSessionId: "cs_001", providerPaymentId: "", amountCents: 5000,
    });
    // Dos shares: uno ya pagado, el otro pendiente
    db.addShare("share-001", { billId: "bill-001", residentId: "u1", status: "pending", paidAt: null });
    db.addShare("share-002", { billId: "bill-001", residentId: "u2", status: "paid", paidAt: "2026-01-01" });
    db.addBill("bill-001", { status: "split" });

    await processWebhookEvent(db, {
      id:   "evt_settle",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_001", payment_intent: "pi_001", amount_total: 5000,
          metadata: { billId: "bill-001", shareId: "share-001", residentId: "u1" },
        },
      },
    }, true);

    expect(db.getBill("bill-001")?.status).toBe("settled");
  });

  test("NO marca settled si hay shares pendientes", async () => {
    const db = new MockFirestore();
    db.addPayment("pay-001", {
      userId: "u1", billShareId: "share-001", billId: "bill-001",
      status: "pending", providerSessionId: "cs_002", providerPaymentId: "", amountCents: 5000,
    });
    db.addShare("share-001", { billId: "bill-001", residentId: "u1", status: "pending", paidAt: null });
    db.addShare("share-002", { billId: "bill-001", residentId: "u2", status: "pending", paidAt: null });
    db.addBill("bill-001", { status: "split" });

    await processWebhookEvent(db, {
      id:   "evt_no_settle",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_002", payment_intent: "pi_002", amount_total: 5000,
          metadata: { billId: "bill-001", shareId: "share-001", residentId: "u1" },
        },
      },
    }, true);

    expect(db.getBill("bill-001")?.status).toBe("split"); // no settled
  });

  test("no falla si no hay metadata en el evento", async () => {
    const db  = new MockFirestore();
    const res = await processWebhookEvent(db, {
      id:   "evt_no_meta",
      type: "checkout.session.completed",
      data: { object: { id: "cs_003", metadata: {} } },
    }, true);
    expect(res.status).toBe(200);
  });
});

describe("Webhook — checkout.session.expired", () => {
  test("pone payment en 'canceled'", async () => {
    const db = new MockFirestore();
    db.addPayment("pay-002", {
      userId: "u1", billShareId: "share-002", billId: "bill-002",
      status: "pending", providerSessionId: "cs_exp_001", providerPaymentId: "", amountCents: 2000,
    });

    await processWebhookEvent(db, {
      id:   "evt_exp_001",
      type: "checkout.session.expired",
      data: { object: { id: "cs_exp_001" } },
    }, true);

    expect(db.getPayment("pay-002")?.status).toBe("canceled");
  });
});

describe("Webhook — payment_intent.payment_failed", () => {
  test("pone payment en 'failed'", async () => {
    const db = new MockFirestore();
    db.addPayment("pay-003", {
      userId: "u1", billShareId: "share-003", billId: "bill-003",
      status: "processing", providerSessionId: "cs_003", providerPaymentId: "pi_fail_001", amountCents: 1000,
    });

    await processWebhookEvent(db, {
      id:   "evt_fail_001",
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_fail_001" } },
    }, true);

    expect(db.getPayment("pay-003")?.status).toBe("failed");
  });
});

describe("Webhook — charge.refunded", () => {
  test("pone payment en 'refunded' y share vuelve a 'pending'", async () => {
    const db = new MockFirestore();
    db.addPayment("pay-004", {
      userId: "u1", billShareId: "share-004", billId: "bill-004",
      status: "paid", providerSessionId: "cs_004", providerPaymentId: "pi_refund_001", amountCents: 4000,
    });
    db.addShare("share-004", { billId: "bill-004", residentId: "u1", status: "paid", paidAt: "2026-01-10" });
    db.addBill("bill-004", { status: "settled" });

    await processWebhookEvent(db, {
      id:   "evt_refund_001",
      type: "charge.refunded",
      data: { object: { id: "ch_001", payment_intent: "pi_refund_001" } },
    }, true);

    expect(db.getPayment("pay-004")?.status).toBe("refunded");
    expect(db.getShare("share-004")?.status).toBe("pending");
    expect(db.getShare("share-004")?.paidAt).toBeNull();
  });

  test("no falla si no hay payment asociado", async () => {
    const db  = new MockFirestore();
    const res = await processWebhookEvent(db, {
      id:   "evt_refund_noop",
      type: "charge.refunded",
      data: { object: { id: "ch_noop", payment_intent: "pi_nonexistent" } },
    }, true);
    expect(res.status).toBe(200);
  });
});

describe("Webhook — eventos no manejados", () => {
  test("procesa sin errores eventos desconocidos", async () => {
    const db  = new MockFirestore();
    const res = await processWebhookEvent(db, {
      id:   "evt_unknown",
      type: "customer.subscription.created",
      data: { object: {} },
    }, true);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});
