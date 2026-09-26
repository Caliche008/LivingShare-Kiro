/**
 * Cloud Function: generateNotification
 *
 * Crea una notificación in-app para un usuario dado.
 * Solo puede ser llamada por servicios backend autenticados (owners/admins o
 * desde otras Cloud Functions). Los usuarios normales no pueden crear
 * notificaciones para otros.
 *
 * Reglas:
 * - El caller debe estar autenticado.
 * - Si targetUserId ≠ caller.uid, el caller debe tener rol owner o admin.
 * - Las notificaciones se crean con read=false.
 * - La operación es idempotente si se provee un idempotencyKey.
 */

import * as admin from "firebase-admin";
import {
  onCall,
  HttpsError,
  type CallableRequest,
} from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

const db = admin.firestore();

// ─── Tipos ────────────────────────────────────────────────────────────────────

type NotificationType =
  | "match_calculated"
  | "bill_split"
  | "bill_due_soon"
  | "payment_confirmed"
  | "payment_failed"
  | "room_status_changed"
  | "admin_request";

interface GenerateNotificationData {
  /** Usuario destinatario */
  targetUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Ruta Next.js de acción, ej. "/bills/bill-001" */
  actionUrl?: string;
  /** Tipo de recurso que originó la notificación */
  resourceType?: string;
  resourceId?: string;
  /**
   * Clave de idempotencia opcional.
   * Si se provee y ya existe una notificación con esa clave, no se crea duplicado.
   */
  idempotencyKey?: string;
}

const VALID_TYPES: NotificationType[] = [
  "match_calculated",
  "bill_split",
  "bill_due_soon",
  "payment_confirmed",
  "payment_failed",
  "room_status_changed",
  "admin_request",
];

// ─── Cloud Function ───────────────────────────────────────────────────────────

export const generateNotification = onCall(
  { secrets: [] },
  async (request: CallableRequest<GenerateNotificationData>) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes estar autenticado");
    }

    const { uid } = request.auth;
    const {
      targetUserId,
      type,
      title,
      body,
      actionUrl,
      resourceType,
      resourceId,
      idempotencyKey,
    } = request.data;

    // ── Validaciones básicas ──────────────────────────────────────────────────

    if (!targetUserId || typeof targetUserId !== "string") {
      throw new HttpsError("invalid-argument", "targetUserId es requerido");
    }
    if (!type || !VALID_TYPES.includes(type)) {
      throw new HttpsError(
        "invalid-argument",
        `Tipo de notificación inválido: ${type}`
      );
    }
    if (!title?.trim()) {
      throw new HttpsError("invalid-argument", "title es requerido");
    }
    if (!body?.trim()) {
      throw new HttpsError("invalid-argument", "body es requerido");
    }

    // ── Autorización: caller puede notificar a sí mismo o debe ser owner/admin ─

    if (targetUserId !== uid) {
      const callerSnap = await db.collection("users").doc(uid).get();
      const callerRoles: string[] = callerSnap.data()?.roles ?? [];
      const canNotifyOthers =
        callerRoles.includes("owner") || callerRoles.includes("admin");

      if (!canNotifyOthers) {
        throw new HttpsError(
          "permission-denied",
          "Solo propietarios y administradores pueden notificar a otros usuarios"
        );
      }
    }

    // ── Idempotencia: evitar duplicados si se provee idempotencyKey ───────────

    if (idempotencyKey) {
      const existing = await db
        .collection("notifications")
        .where("idempotencyKey", "==", idempotencyKey)
        .limit(1)
        .get();

      if (!existing.empty) {
        logger.info(
          `generateNotification: notificación duplicada ignorada (key=${idempotencyKey})`
        );
        return { created: false, duplicate: true, id: existing.docs[0].id };
      }
    }

    // ── Crear notificación ────────────────────────────────────────────────────

    const payload: Record<string, unknown> = {
      userId:       targetUserId,
      type,
      title:        title.trim(),
      body:         body.trim(),
      actionUrl:    actionUrl    ?? null,
      resourceType: resourceType ?? null,
      resourceId:   resourceId   ?? null,
      read:         false,
      createdAt:    admin.firestore.FieldValue.serverTimestamp(),
    };

    if (idempotencyKey) {
      payload.idempotencyKey = idempotencyKey;
    }

    const ref = await db.collection("notifications").add(payload);

    logger.info(
      `generateNotification: creada [${type}] para usuario ${targetUserId} (id=${ref.id})`
    );

    return { created: true, id: ref.id };
  }
);

// ─── Helper interno: generar notificaciones desde otras Cloud Functions ───────

/**
 * Crea una notificación directamente desde una Cloud Function interna,
 * sin pasar por la validación de autorización del callable (ya estamos en backend).
 *
 * Idempotente si se provee idempotencyKey.
 */
export async function createNotificationInternal(
  targetUserId: string,
  type: NotificationType,
  title: string,
  body: string,
  options: {
    actionUrl?: string;
    resourceType?: string;
    resourceId?: string;
    idempotencyKey?: string;
  } = {}
): Promise<string | null> {
  const { actionUrl, resourceType, resourceId, idempotencyKey } = options;

  if (idempotencyKey) {
    const existing = await db
      .collection("notifications")
      .where("idempotencyKey", "==", idempotencyKey)
      .limit(1)
      .get();

    if (!existing.empty) {
      return existing.docs[0].id; // ya existe, retornar id
    }
  }

  const payload: Record<string, unknown> = {
    userId:       targetUserId,
    type,
    title,
    body,
    actionUrl:    actionUrl    ?? null,
    resourceType: resourceType ?? null,
    resourceId:   resourceId   ?? null,
    read:         false,
    createdAt:    admin.firestore.FieldValue.serverTimestamp(),
  };

  if (idempotencyKey) {
    payload.idempotencyKey = idempotencyKey;
  }

  const ref = await db.collection("notifications").add(payload);
  return ref.id;
}
