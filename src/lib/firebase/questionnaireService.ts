import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { Questionnaire, QuestionnaireAnswers } from "@/types";

export const QUESTIONNAIRE_VERSION = 1;

/** Preguntas que deben responderse antes del envío definitivo */
const REQUIRED_FIELDS: (keyof QuestionnaireAnswers)[] = [
  "sleepSchedule",
  "cleanlinessLevel",
  "noiseLevel",
  "hasPets",
  "smokes",
];

/**
 * Obtiene el cuestionario de un usuario. Retorna null si no existe.
 */
export async function getQuestionnaire(
  userId: string
): Promise<Questionnaire | null> {
  const snap = await getDoc(doc(db, "questionnaires", userId));
  if (!snap.exists()) return null;
  return snap.data() as Questionnaire;
}

/**
 * Guarda o actualiza las respuestas del cuestionario (borrador).
 * No valida campos obligatorios — permite guardar progreso parcial.
 */
export async function saveQuestionnaire(
  userId: string,
  answers: Partial<QuestionnaireAnswers>
): Promise<void> {
  await setDoc(
    doc(db, "questionnaires", userId),
    {
      userId,
      answers,
      version: QUESTIONNAIRE_VERSION,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Actualizar estado del usuario a 'in_progress' si no está ya 'submitted'
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (
    userSnap.exists() &&
    userSnap.data().questionnaireStatus === "pending"
  ) {
    await updateDoc(userRef, { questionnaireStatus: "in_progress" });
  }
}

/**
 * Envío definitivo del cuestionario.
 * Valida preguntas obligatorias. Persiste completedAt y actualiza el perfil.
 */
export async function submitQuestionnaire(
  userId: string,
  answers: QuestionnaireAnswers
): Promise<void> {
  // Validar campos obligatorios
  const missing = REQUIRED_FIELDS.filter(
    (field) => answers[field] === undefined || answers[field] === null
  );

  if (missing.length > 0) {
    throw new Error(
      `Preguntas obligatorias sin responder: ${missing.join(", ")}`
    );
  }

  await setDoc(doc(db, "questionnaires", userId), {
    userId,
    answers,
    version: QUESTIONNAIRE_VERSION,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Marcar perfil como 'submitted'.
  // Usamos setDoc con merge en lugar de updateDoc: si el documento de usuario
  // no existe todavia (cuentas creadas antes de que se guardara el perfil),
  // updateDoc fallaria con "No document to update". merge lo crea o actualiza.
  await setDoc(
    doc(db, "users", userId),
    {
      questionnaireStatus: "submitted",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
