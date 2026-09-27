/**
 * Cloud Functions — Ola 3: Facturación y Pagos
 *
 * calculateBillSplit   — valida y calcula el reparto de una factura, persiste shares
 * createPaymentSession — genera una Stripe Checkout Session para una participación
 * stripeWebhook        — verifica firma HMAC de Stripe y actualiza estados de pago
 *
 * Reglas de seguridad:
 * - Usuario autenticado en todas las operaciones.
 * - Solo managers/owners calculan repartos.
 * - Un reparto confirmado se versiona; nunca se sobrescribe.
 * - El webhook verifica la firma HMAC antes de procesar cualquier evento.
 * - Los pagos son idempotentes: el mismo evento duplicado no genera doble cobro.
 * - Nunca se expone la clave secreta de Stripe al navegador.
 */

import * as admin from "firebase-admin";
import Stripe from "stripe";
import {
  onCall,
  onRequest,
  HttpsError,
  type CallableRequest,
} from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";

// ─── Secrets (Secret Manager) ─────────────────────────────────────────────────
const STRIPE_SECRET_KEY     = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

// ─── Helper de notificaciones (importado de notifications.ts) ─────────────────
import { createNotificationInternal } from "./notifications";

// ─── Tipos locales ────────────────────────────────────────────────────────────

type SplitRule     = "equal" | "percentage" | "days_occupied" | "exclude";
type ShareStatus   = "pending" | "paid" | "overdue";
type PaymentStatus = "pending" | "processing" | "paid" | "failed" | "refunded" | "canceled";

interface ResidentInput {
  residentId: string;
  residentName?: string;
  percentage?: number;
  daysOccupied?: number;
  excluded?: boolean;
}

interface ShareCalculation {
  residentId: string;
  residentName?: string;
  rule: SplitRule;
  proportion: number;
  amountCents: number;
  daysOccupied?: number;
  totalDays?: number;
  percentageValue?: number;
}

// ─── Singleton de Firestore ───────────────────────────────────────────────────
const db = admin.firestore();

// ─── Singleton lazy de Stripe ─────────────────────────────────────────────────
// Se instancia dentro de cada función para que el secret esté disponible en runtime.
function getStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2025-06-30.basil" as Stripe.LatestApiVersion,
    typescript: true,
  });
}

// ─── Helper: auditoría ────────────────────────────────────────────────────────

async function writeAuditLog(
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await db.collection("auditLogs").add({
    actorId,
    action,
    resourceType,
    resourceId,
    metadata: metadata ?? null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ─── Helper: lanzar HttpsError con código correcto ───────────────────────────

function toHttpsError(err: unknown): HttpsError {
  if (err instanceof HttpsError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  // Detectar prefijos de código en el mensaje: "not-found: ..."
  const prefixes: HttpsError["code"][] = [
    "unauthenticated", "permission-denied", "not-found",
    "invalid-argument", "failed-precondition", "internal",
  ];
  for (const code of prefixes) {
    if (msg.startsWith(`${code}:`)) {
      return new HttpsError(code, msg.slice(code.length + 2).trim());
    }
  }
  return new HttpsError("internal", msg);
}

// ─── Algoritmo Largest Remainder ─────────────────────────────────────────────

function largestRemainder(totalCents: number, weights: number[]): number[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) throw new Error("El total de pesos es 0");

  const rawAmounts = weights.map((w) => (w / totalWeight) * totalCents);
  const floored    = rawAmounts.map((a) => Math.floor(a));
  const remainders = rawAmounts.map((a, i) => a - floored[i]);

  let leftover = totalCents - floored.reduce((a, b) => a + b, 0);
  const sorted = remainders.map((r, i) => ({ i, r })).sort((a, b) => b.r - a.r);

  for (const { i } of sorted) {
    if (leftover <= 0) break;
    floored[i]++;
    leftover--;
  }
  return floored;
}

// ─── Lógica de reparto ───────────────────────────────────────────────────────

function computeShares(
  totalCents: number,
  rule: SplitRule,
  residents: ResidentInput[],
  totalDays?: number
): ShareCalculation[] {
  const active = residents.filter((r) => !r.excluded);
  if (active.length === 0) throw new Error("Todos los residentes están excluidos");

  if (rule === "equal" || rule === "exclude") {
    const amounts = largestRemainder(totalCents, active.map(() => 1));
    return active.map((r, i) => ({
      residentId: r.residentId,
      residentName: r.residentName,
      rule: "equal" as SplitRule,
      proportion: amounts[i] / totalCents,
      amountCents: amounts[i],
    }));
  }

  if (rule === "percentage") {
    const pcts  = active.map((r) => r.percentage ?? 0);
    const total = pcts.reduce((a, b) => a + b, 0);
    if (Math.round(total) !== 100) {
      throw new Error(`Los porcentajes deben sumar 100 (actual: ${total})`);
    }
    const amounts = largestRemainder(totalCents, pcts);
    return active.map((r, i) => ({
      residentId: r.residentId,
      residentName: r.residentName,
      rule: "percentage" as SplitRule,
      proportion: amounts[i] / totalCents,
      amountCents: amounts[i],
      percentageValue: r.percentage,
    }));
  }

  if (rule === "days_occupied") {
    if (!totalDays || totalDays <= 0) {
      throw new Error("totalDays es requerido para el reparto por días");
    }
    const days = active.map((r) => {
      if (r.daysOccupied === undefined || r.daysOccupied < 0) {
        throw new Error(`daysOccupied requerido para ${r.residentId}`);
      }
      if (r.daysOccupied > totalDays) {
        throw new Error(`daysOccupied supera totalDays para ${r.residentId}`);
      }
      return r.daysOccupied;
    });
    if (days.reduce((a, b) => a + b, 0) === 0) {
      throw new Error("La suma de días es 0");
    }
    const amounts = largestRemainder(totalCents, days);
    return active.map((r, i) => ({
      residentId: r.residentId,
      residentName: r.residentName,
      rule: "days_occupied" as SplitRule,
      proportion: amounts[i] / totalCents,
      amountCents: amounts[i],
      daysOccupied: r.daysOccupied,
      totalDays,
    }));
  }

  throw new Error(`Regla desconocida: ${rule}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Callable: calculateBillSplit
// ═══════════════════════════════════════════════════════════════════════════════

interface CalculateBillSplitData {
  billId: string;
  rule: SplitRule;
  residents: ResidentInput[];
  totalDays?: number;
}

export const calculateBillSplit = onCall(
  { secrets: [] },
  async (request: CallableRequest<CalculateBillSplitData>) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Debes estar autenticado");
      }

      const { billId, rule, residents, totalDays } = request.data;
      const uid = request.auth.uid;

      // 1. Obtener la factura
      const billSnap = await db.collection("bills").doc(billId).get();
      if (!billSnap.exists) throw new HttpsError("not-found", "Factura no encontrada");
      const bill = billSnap.data()!;

      // 2. Verificar que el caller es manager de la propiedad
      const propSnap = await db.collection("properties").doc(bill.propertyId).get();
      if (!propSnap.exists) throw new HttpsError("not-found", "Propiedad no encontrada");
      const prop       = propSnap.data()!;
      const isManager  = prop.ownerId === uid || (prop.managerIds ?? []).includes(uid);
      if (!isManager) {
        throw new HttpsError(
          "permission-denied",
          "Solo propietarios y administradores pueden calcular el reparto"
        );
      }

      // 3. Calcular reparto
      let shares: ShareCalculation[];
      try {
        shares = computeShares(bill.totalAmountCents, rule, residents, totalDays);
      } catch (err) {
        throw new HttpsError("invalid-argument", (err as Error).message);
      }

      // 4. Verificar suma exacta (invariante de seguridad)
      const sum = shares.reduce((s, r) => s + r.amountCents, 0);
      if (sum !== bill.totalAmountCents) {
        throw new HttpsError(
          "internal",
          `La suma de participaciones (${sum}) no coincide con el total (${bill.totalAmountCents})`
        );
      }

      // 5. Versionar
      const newVersion = (bill.splitVersion ?? 0) + 1;

      // 6. Persistir en batch atómico
      const batch = db.batch();

      for (const share of shares) {
        const shareRef = db
          .collection("bills").doc(billId)
          .collection("shares")
          .doc(`${billId}_${share.residentId}_v${newVersion}`);

        batch.set(shareRef, {
          billId,
          residentId:      share.residentId,
          residentName:    share.residentName    ?? null,
          rule:            share.rule,
          proportion:      share.proportion,
          amountCents:     share.amountCents,
          daysOccupied:    share.daysOccupied    ?? null,
          totalDays:       share.totalDays       ?? null,
          percentageValue: share.percentageValue ?? null,
          status:          "pending" as ShareStatus,
          splitVersion:    newVersion,
          calculatedAt:    admin.firestore.FieldValue.serverTimestamp(),
          paidAt:          null,
        });
      }

      batch.update(db.collection("bills").doc(billId), {
        status:      "split",
        splitVersion: newVersion,
        updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();

      await writeAuditLog(uid, "BILL_SPLIT_CALCULATED", "bills", billId, {
        rule,
        splitVersion:   newVersion,
        sharesCount:    shares.length,
        totalAmountCents: bill.totalAmountCents,
      });

      // Notificar a cada residente que su participación fue calculada
      const amountFormatted = (bill.totalAmountCents / 100).toFixed(2);
      const notifPromises = shares.map((share) =>
        createNotificationInternal(
          share.residentId,
          "bill_split",
          "Nueva participación en factura",
          `Se calculó tu parte de la factura de ${bill.serviceType ?? "servicios"}: $${(share.amountCents / 100).toFixed(2)} de $${amountFormatted}.`,
          {
            actionUrl:    `/bills/${billId}`,
            resourceType: "bills",
            resourceId:   billId,
            idempotencyKey: `notif_bill_split_${billId}_${share.residentId}_v${newVersion}`,
          }
        ).catch((err) => {
          // No fallar el split si la notificación falla
          logger.warn(`Error enviando notificación bill_split a ${share.residentId}`, { err });
        })
      );
      await Promise.all(notifPromises);

      return {
        success:      true,
        splitVersion: newVersion,
        sharesCount:  shares.length,
        shares: shares.map((s) => ({
          residentId:  s.residentId,
          amountCents: s.amountCents,
          proportion:  s.proportion,
        })),
      };
    } catch (err) {
      throw toHttpsError(err);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// Callable: createPaymentSession
// ═══════════════════════════════════════════════════════════════════════════════

interface CreatePaymentSessionData {
  billId:     string;
  shareId:    string;
  successUrl: string;
  cancelUrl:  string;
  currency?:  string;
}

export const createPaymentSession = onCall(
  { secrets: [STRIPE_SECRET_KEY] },
  async (request: CallableRequest<CreatePaymentSessionData>) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Debes estar autenticado");
      }

      const { billId, shareId, successUrl, cancelUrl, currency = "mxn" } = request.data;
      const uid    = request.auth.uid;
      const stripe = getStripe(STRIPE_SECRET_KEY.value());

      // 1. Obtener la participación
      const shareSnap = await db
        .collection("bills").doc(billId)
        .collection("shares").doc(shareId)
        .get();
      if (!shareSnap.exists) throw new HttpsError("not-found", "Participación no encontrada");
      const share = shareSnap.data()!;

      // 2. Validar propietario de la participación
      if (share.residentId !== uid) {
        throw new HttpsError("permission-denied", "Esta participación no te pertenece");
      }

      // 3. Validar estado
      if (share.status !== "pending") {
        throw new HttpsError(
          "failed-precondition",
          `El estado de la participación es '${share.status}', no 'pending'`
        );
      }

      // 4. Obtener la factura (para descripción del producto)
      const billSnap = await db.collection("bills").doc(billId).get();
      if (!billSnap.exists) throw new HttpsError("not-found", "Factura no encontrada");
      const bill = billSnap.data()!;

      // 5. Idempotencia: devolver sesión existente si ya está activa
      const existingSnap = await db
        .collection("payments")
        .where("billShareId", "==", shareId)
        .where("status", "in", ["pending", "processing"])
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        const existing = existingSnap.docs[0].data();
        if (existing.providerSessionId) {
          return { sessionId: existing.providerSessionId, url: null, existing: true };
        }
      }

      // 6. Crear Checkout Session en Stripe
      const idempotencyKey = `pay_${uid}_${shareId}_v${share.splitVersion}`;

      const session = await stripe.checkout.sessions.create(
        {
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency,
                product_data: {
                  name: `${bill.serviceType} — ${bill.periodStart} al ${bill.periodEnd}`,
                  description: `Participación en la factura de ${bill.provider ?? "servicios"}`,
                },
                unit_amount: share.amountCents,
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url:  cancelUrl,
          metadata: {
            billId,
            shareId,
            residentId:   uid,
            splitVersion: String(share.splitVersion),
          },
          client_reference_id: uid,
        },
        { idempotencyKey }
      );

      // 7. Persistir pago en Firestore con estado "pending"
      const paymentRef = await db.collection("payments").add({
        userId:            uid,
        billShareId:       shareId,
        billId,
        provider:          "stripe",
        providerPaymentId: session.payment_intent ?? "",
        providerSessionId: session.id,
        amountCents:       share.amountCents,
        currency,
        status:            "pending" as PaymentStatus,
        idempotencyKey,
        createdAt:         admin.firestore.FieldValue.serverTimestamp(),
        updatedAt:         admin.firestore.FieldValue.serverTimestamp(),
      });

      await writeAuditLog(uid, "PAYMENT_SESSION_CREATED", "payments", paymentRef.id, {
        billId,
        shareId,
        amountCents: share.amountCents,
        sessionId:   session.id,
      });

      return { sessionId: session.id, url: session.url, existing: false };
    } catch (err) {
      throw toHttpsError(err);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP: stripeWebhook
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Webhook de Stripe.
 *
 * Firebase Functions v2 expone el rawBody como Buffer en req.rawBody.
 * La verificación HMAC de Stripe lo requiere — no usar el body parseado.
 *
 * Eventos manejados:
 *   checkout.session.completed   → pago exitoso → share=paid, bill=settled si todos pagan
 *   checkout.session.expired     → sesión expiró → payment=canceled
 *   payment_intent.payment_failed → pago fallido → payment=failed
 *   charge.refunded              → reembolso → payment=refunded, share vuelve a pending
 */
export const stripeWebhook = onRequest(
  {
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
    // rawBody es necesario para verificar la firma HMAC de Stripe
    invoker: "public",
    // Un poco más de holgura que el global (3): Stripe puede reintentar en
    // ráfaga y no queremos rechazar eventos por saturación. Sigue acotado.
    maxInstances: 5,
  },
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).json({ error: "Falta la cabecera stripe-signature" });
      return;
    }

    const stripe = getStripe(STRIPE_SECRET_KEY.value());

    let event: Stripe.Event;
    try {
      // req.rawBody está disponible en Cloud Functions v2 como Buffer
      event = stripe.webhooks.constructEvent(
        req.rawBody as unknown as string,
        sig,
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      logger.error("Stripe webhook: firma inválida", { err });
      res.status(400).json({ error: "Firma inválida" });
      return;
    }

    // Idempotencia: marcar el evento antes de procesarlo
    const eventRef  = db.collection("_stripeEvents").doc(event.id);
    const eventSnap = await eventRef.get();

    if (eventSnap.exists) {
      logger.info(`Stripe event ${event.id} (${event.type}) ya procesado — ignorando`);
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    try {
      await processStripeEvent(stripe, event);

      await eventRef.set({
        eventId:     event.id,
        type:        event.type,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({ received: true });
    } catch (err) {
      logger.error(`Error procesando evento Stripe ${event.id}`, { err });
      // Devolver 500 para que Stripe reintente el evento
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// ─── Procesador de eventos ────────────────────────────────────────────────────

async function processStripeEvent(stripe: Stripe, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case "checkout.session.expired":
      await handleCheckoutExpiredOrCanceled(
        event.data.object as Stripe.Checkout.Session,
        "canceled"
      );
      break;

    case "payment_intent.payment_failed":
      await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
      break;

    case "charge.refunded":
      await handleChargeRefunded(event.data.object as Stripe.Charge);
      break;

    default:
      logger.info(`Evento Stripe no manejado: ${event.type}`);
  }

  void stripe; // satisfacer TypeScript — stripe se puede usar en handlers futuros
}

// ─── Handler: checkout.session.completed ─────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const { billId, shareId, residentId } = session.metadata ?? {};
  if (!billId || !shareId || !residentId) {
    logger.warn("checkout.session.completed: metadata incompleta", { sessionId: session.id });
    return;
  }

  const batch = db.batch();

  // Actualizar payment → paid
  const paymentsSnap = await db
    .collection("payments")
    .where("providerSessionId", "==", session.id)
    .limit(1)
    .get();

  if (!paymentsSnap.empty) {
    batch.update(paymentsSnap.docs[0].ref, {
      status:            "paid" as PaymentStatus,
      providerPaymentId: (session.payment_intent as string) ?? "",
      updatedAt:         admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Actualizar share → paid
  const shareRef = db
    .collection("bills").doc(billId)
    .collection("shares").doc(shareId);

  batch.update(shareRef, {
    status: "paid" as ShareStatus,
    paidAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();

  // Comprobar si todos los shares están pagados → settled
  await checkBillSettled(billId);

  await writeAuditLog(residentId, "PAYMENT_COMPLETED", "payments", session.id, {
    billId,
    shareId,
    amountTotal: session.amount_total,
  });

  // Notificar al residente que su pago fue confirmado
  const amountFormatted = session.amount_total
    ? `$${(session.amount_total / 100).toFixed(2)}`
    : "tu participación";

  await createNotificationInternal(
    residentId,
    "payment_confirmed",
    "Pago confirmado",
    `Tu pago de ${amountFormatted} fue procesado correctamente.`,
    {
      actionUrl:    `/bills/${billId}`,
      resourceType: "payments",
      resourceId:   session.id,
      idempotencyKey: `notif_payment_confirmed_${session.id}`,
    }
  );
}

// ─── Handler: checkout.session.expired / canceled ────────────────────────────

async function handleCheckoutExpiredOrCanceled(
  session: Stripe.Checkout.Session,
  status: "canceled" | "failed"
): Promise<void> {
  const snap = await db
    .collection("payments")
    .where("providerSessionId", "==", session.id)
    .limit(1)
    .get();

  if (!snap.empty) {
    await snap.docs[0].ref.update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

// ─── Handler: payment_intent.payment_failed ──────────────────────────────────

async function handlePaymentIntentFailed(pi: Stripe.PaymentIntent): Promise<void> {
  const snap = await db
    .collection("payments")
    .where("providerPaymentId", "==", pi.id)
    .limit(1)
    .get();

  if (!snap.empty) {
    const paymentData = snap.docs[0].data();

    await snap.docs[0].ref.update({
      status:    "failed" as PaymentStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notificar al residente que su pago falló
    if (paymentData.userId) {
      const errorMsg =
        pi.last_payment_error?.message ?? "El pago no pudo procesarse.";
      await createNotificationInternal(
        paymentData.userId as string,
        "payment_failed",
        "Pago fallido",
        `Tu pago falló: ${errorMsg}. Puedes intentarlo de nuevo.`,
        {
          actionUrl:    `/bills/${paymentData.billId ?? ""}`,
          resourceType: "payments",
          resourceId:   snap.docs[0].id,
          idempotencyKey: `notif_payment_failed_${pi.id}`,
        }
      );
    }
  }
}

// ─── Handler: charge.refunded ────────────────────────────────────────────────

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const snap = await db
    .collection("payments")
    .where("providerPaymentId", "==", charge.payment_intent)
    .limit(1)
    .get();

  if (snap.empty) return;

  const paymentDoc  = snap.docs[0];
  const paymentData = paymentDoc.data();

  await paymentDoc.ref.update({
    status:    "refunded" as PaymentStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Revertir share a pending para que el residente pueda volver a pagar
  if (paymentData.billShareId && paymentData.billId) {
    await db
      .collection("bills").doc(paymentData.billId as string)
      .collection("shares").doc(paymentData.billShareId as string)
      .update({
        status: "pending" as ShareStatus,
        paidAt: null,
      });
  }

  await writeAuditLog("system", "PAYMENT_REFUNDED", "payments", paymentDoc.id, {
    chargeId: charge.id,
  });
}

// ─── Helper: marcar factura como settled ─────────────────────────────────────

async function checkBillSettled(billId: string): Promise<void> {
  const sharesSnap = await db
    .collection("bills").doc(billId)
    .collection("shares")
    .get();

  if (sharesSnap.empty) return;

  const allPaid = sharesSnap.docs.every((d) => d.data().status === "paid");
  if (allPaid) {
    await db.collection("bills").doc(billId).update({
      status:    "settled",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await writeAuditLog("system", "BILL_SETTLED", "bills", billId, {});
  }
}
