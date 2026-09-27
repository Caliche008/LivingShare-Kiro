import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2/options";
import {
  onRequest,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";
import { beforeUserCreated, beforeUserSignedIn } from "firebase-functions/v2/identity";
import { logger } from "firebase-functions";

// ─── Límite global de instancias (control de costos) ─────────────────────────
// Acota cuántas instancias concurrentes puede lanzar CUALQUIER función de este
// proyecto. Es el freno físico más importante contra un gasto descontrolado en
// el plan Blaze: aunque llegue un pico o un abuso, el número de instancias
// facturables queda limitado. Con pocos usuarios este techo nunca se alcanza.
// Ajustar al alza cuando el tráfico real lo justifique.
setGlobalOptions({ maxInstances: 3 });

// ─── Inicializar Firebase Admin SDK ──────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ─── Helper: escribir log de auditoría ───────────────────────────────────────
async function writeAuditLog(
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, unknown>
) {
  await db.collection("auditLogs").add({
    actorId,
    action,
    resourceType,
    resourceId,
    metadata: metadata ?? null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ─── Blocking trigger: antes de crear usuario ────────────────────────────────
/**
 * Se ejecuta antes de que Firebase Auth cree un usuario.
 * Permite validar o enriquecer el registro.
 */
export const beforeCreate = beforeUserCreated(async (event) => {
  const user = event.data;
  logger.info(`New user registering: ${user?.uid}`);
  // Aquí se puede bloquear registros según dominio de email, etc.
  return {};
});

// ─── Blocking trigger: antes de iniciar sesión ───────────────────────────────
export const beforeSignIn = beforeUserSignedIn(async (event) => {
  const user = event.data;
  logger.info(`User signing in: ${user?.uid}`);
  return {};
});

// ─── HTTP: función de salud ───────────────────────────────────────────────────
export const healthCheck = onRequest(async (req, res) => {
  try {
    await db.collection("_health").doc("ping").set({
      ts: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        firestore: "ok",
        adminSdk: "ok",
      },
    });
  } catch (error) {
    logger.error("Health check failed", error);
    res.status(500).json({
      status: "error",
      message: "Service unavailable",
    });
  }
});

// ─── HTTP Callable: crear perfil de usuario ───────────────────────────────────
/**
 * Crea o actualiza el perfil del usuario en Firestore.
 * Se llama desde el cliente tras el registro.
 */
export const createUserProfile = onCall(
  async (request: CallableRequest<{ displayName: string }>) => {
    if (!request.auth) {
      throw new Error("unauthenticated: Debes estar autenticado.");
    }

    const { uid, token } = request.auth;
    const displayName = request.data.displayName ?? token.name ?? "";

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    if (!snap.exists) {
      await userRef.set({
        uid,
        email: token.email ?? "",
        displayName,
        photoURL: token.picture ?? null,
        roles: ["resident"],
        questionnaireStatus: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await writeAuditLog(uid, "USER_CREATED", "users", uid);
    }

    return { success: true };
  }
);

// ─── HTTP Callable: asignar rol ────────────────────────────────────────────────
interface AssignRoleData {
  targetUid: string;
  role: string;
}

export const assignRole = onCall(
  async (request: CallableRequest<AssignRoleData>) => {
    if (!request.auth) {
      throw new Error("unauthenticated: Debes estar autenticado.");
    }

    const callerSnap = await db
      .collection("users")
      .doc(request.auth.uid)
      .get();
    const callerRoles: string[] = callerSnap.data()?.roles ?? [];

    if (!callerRoles.includes("owner")) {
      throw new Error(
        "permission-denied: Solo los propietarios pueden asignar roles."
      );
    }

    const { targetUid, role } = request.data;
    const validRoles = ["owner", "admin", "resident", "visitor"];

    if (!validRoles.includes(role)) {
      throw new Error(`invalid-argument: Rol inválido: ${role}`);
    }

    await db
      .collection("users")
      .doc(targetUid)
      .update({
        roles: admin.firestore.FieldValue.arrayUnion(role),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    await writeAuditLog(request.auth.uid, "ROLE_ASSIGNED", "users", targetUid, {
      role,
    });

    return { success: true };
  }
);


// ─── Billing: reparto de facturas y pagos con Stripe ──────────────────────────
export {
  calculateBillSplit,
  createPaymentSession,
  stripeWebhook,
} from "./billing";

// ─── Notificaciones in-app ────────────────────────────────────────────────────
export { generateNotification } from "./notifications";
import { createNotificationInternal } from "./notifications";

// ─── Matching: calcular compatibilidad para un usuario ─────────────────────────
import { calculateCompatibility, ALGORITHM_VERSION } from "./matching";

interface CalculateMatchesData {
  userId?: string;
}

/**
 * Calcula y persiste matches de compatibilidad entre el usuario y todas las
 * habitaciones publicadas. Llama desde el cliente cuando el usuario envía
 * el cuestionario o solicita actualizar sus resultados.
 */
export const calculateMatchesForUser = onCall(
  async (request: CallableRequest<CalculateMatchesData>) => {
    if (!request.auth) {
      throw new Error("unauthenticated: Debes estar autenticado.");
    }

    const uid = request.data?.userId ?? request.auth.uid;

    // 1. Obtener cuestionario del usuario
    const questionnaireSnap = await db.collection("questionnaires").doc(uid).get();
    if (!questionnaireSnap.exists) {
      return { matches: 0, reason: "no_questionnaire" };
    }

    const questionnaireData = questionnaireSnap.data();
    if (!questionnaireData?.completedAt) {
      return { matches: 0, reason: "questionnaire_not_submitted" };
    }

    const userAnswers = questionnaireData.answers ?? {};

    // 2. Obtener habitaciones publicadas (collectionGroup)
    const roomsSnap = await db
      .collectionGroup("rooms")
      .where("status", "==", "published")
      .get();

    if (roomsSnap.empty) {
      return { matches: 0, reason: "no_rooms" };
    }

    // 3. Calcular y persistir matches en batch
    const batch = db.batch();
    let matchCount = 0;

    for (const roomDoc of roomsSnap.docs) {
      const room = roomDoc.data();
      const targetAnswers = room.preferences ?? {};

      const result = calculateCompatibility(userAnswers, targetAnswers);

      // Generar id determinista para idempotencia: uid_roomId
      const matchId = `${uid}_${roomDoc.id}`;
      const matchRef = db.collection("matches").doc(matchId);

      batch.set(matchRef, {
        userId: uid,
        targetType: "room",
        targetId: roomDoc.id,
        propertyId: room.propertyId ?? null,
        score: result.score,
        factors: result.factors,
        coverage: result.coverage,
        algorithmVersion: ALGORITHM_VERSION,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      matchCount++;
    }

    await batch.commit();

    await writeAuditLog(uid, "MATCHES_CALCULATED", "matches", uid, {
      count: matchCount,
      algorithmVersion: ALGORITHM_VERSION,
    });

    // Notificar al usuario que sus resultados de compatibilidad están listos
    if (matchCount > 0) {
      await createNotificationInternal(
        uid,
        "match_calculated",
        "Resultados de compatibilidad listos",
        `Se calcularon ${matchCount} resultado${matchCount > 1 ? "s" : ""} de compatibilidad para ti.`,
        {
          actionUrl:    "/matches",
          resourceType: "matches",
          resourceId:   uid,
          idempotencyKey: `notif_match_calculated_${uid}_${ALGORITHM_VERSION}_${Date.now()}`,
        }
      ).catch((err) => {
        logger.warn("Error enviando notificación match_calculated", { err });
      });
    }

    return {
      matches: matchCount,
      calculatedAt: new Date().toISOString(),
    };
  }
);
