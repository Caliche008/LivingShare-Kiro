import type { QuestionnaireAnswers, MatchFactor } from "@/types";

export const ALGORITHM_VERSION = "1.0.0";

// ─── Configuración de criterios ───────────────────────────────────────────────

export interface CriterionConfig {
  key: string;
  weight: number; // suma total exacta = 1.0
  label: string;
  /** Si true, incompatibilidad total lleva el score a 0 */
  hardBlock?: boolean;
}

export const CRITERIA: CriterionConfig[] = [
  { key: "sleepSchedule",    weight: 0.20, label: "Horario de descanso" },
  { key: "cleanlinessLevel", weight: 0.20, label: "Nivel de limpieza" },
  { key: "noiseLevel",       weight: 0.15, label: "Nivel de ruido" },
  { key: "pets",             weight: 0.15, label: "Mascotas",        hardBlock: true },
  { key: "smoking",          weight: 0.15, label: "Tabaco",          hardBlock: true },
  { key: "guestsFrequency",  weight: 0.10, label: "Visitas" },
  { key: "workFromHome",     weight: 0.05, label: "Trabajo desde casa" },
];

// ─── Funciones de similitud ───────────────────────────────────────────────────

const SLEEP_ORDER = ["early", "flexible", "night_owl"] as const;
const NOISE_ORDER = ["silent", "moderate", "lively"] as const;
const GUESTS_ORDER = ["never", "rarely", "sometimes", "often"] as const;
const WORK_ORDER = ["morning", "afternoon", "variable", "night"] as const;

/** Similitud para enums con orden implícito: 1.0 si igual, penaliza por distancia */
function ordinalSimilarity(
  a: string,
  b: string,
  order: readonly string[]
): number {
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia === -1 || ib === -1) return 0;
  const maxDist = order.length - 1;
  return 1 - Math.abs(ia - ib) / maxDist;
}

/** Similitud para nivel numérico 1-5: diferencia normalizada */
function numericSimilarity(a: number, b: number, maxDiff = 4): number {
  return 1 - Math.abs(a - b) / maxDiff;
}

/**
 * Calcula similitud para el criterio "mascotas".
 * hasPets=true + acceptsPets=false → incompatibilidad total (0)
 */
function petSimilarity(
  userA: QuestionnaireAnswers,
  userB: QuestionnaireAnswers
): number | null {
  const aHas = userA.hasPets;
  const bAccepts = userB.acceptsPets;
  const bHas = userB.hasPets;
  const aAccepts = userA.acceptsPets;

  if (aHas === undefined && bHas === undefined) return null; // sin datos

  // Bloqueo duro: alguien tiene mascota y el otro NO las acepta
  if (aHas === true && bAccepts === false) return 0;
  if (bHas === true && aAccepts === false) return 0;

  // Ambos tienen / ambos aceptan / indiferente
  return 1.0;
}

/**
 * Calcula similitud para el criterio "tabaco".
 */
function smokingSimilarity(
  userA: QuestionnaireAnswers,
  userB: QuestionnaireAnswers
): number | null {
  const aSmokes = userA.smokes;
  const bAccepts = userB.acceptsSmoking;
  const bSmokes = userB.smokes;
  const aAccepts = userA.acceptsSmoking;

  if (aSmokes === undefined && bSmokes === undefined) return null;

  if (aSmokes === true && bAccepts === false) return 0;
  if (bSmokes === true && aAccepts === false) return 0;

  return 1.0;
}

// ─── Motor principal ──────────────────────────────────────────────────────────

export interface CompatibilityResult {
  score: number;          // 0-100 redondeado a 1 decimal
  factors: MatchFactor[];
  coverage: number;       // 0-1 fracción de criterios respondidos
}

/**
 * Calcula la compatibilidad entre dos conjuntos de respuestas.
 * Es una función pura: sin side effects, determinista.
 */
export function calculateCompatibility(
  userAnswers: QuestionnaireAnswers,
  targetAnswers: QuestionnaireAnswers
): CompatibilityResult {
  const factors: MatchFactor[] = [];
  let weightedSum = 0;
  let applicableWeight = 0;
  let respondedCriteria = 0;
  let hardBlocked = false;

  for (const criterion of CRITERIA) {
    let similarity: number | null = null;

    switch (criterion.key) {
      case "sleepSchedule":
        if (userAnswers.sleepSchedule && targetAnswers.sleepSchedule) {
          similarity = ordinalSimilarity(
            userAnswers.sleepSchedule,
            targetAnswers.sleepSchedule,
            SLEEP_ORDER
          );
        }
        break;

      case "cleanlinessLevel":
        if (
          userAnswers.cleanlinessLevel !== undefined &&
          targetAnswers.cleanlinessLevel !== undefined
        ) {
          similarity = numericSimilarity(
            userAnswers.cleanlinessLevel,
            targetAnswers.cleanlinessLevel
          );
        }
        break;

      case "noiseLevel":
        if (userAnswers.noiseLevel && targetAnswers.noiseLevel) {
          similarity = ordinalSimilarity(
            userAnswers.noiseLevel,
            targetAnswers.noiseLevel,
            NOISE_ORDER
          );
        }
        break;

      case "pets":
        similarity = petSimilarity(userAnswers, targetAnswers);
        break;

      case "smoking":
        similarity = smokingSimilarity(userAnswers, targetAnswers);
        break;

      case "guestsFrequency":
        if (userAnswers.guestsFrequency && targetAnswers.guestsFrequency) {
          similarity = ordinalSimilarity(
            userAnswers.guestsFrequency,
            targetAnswers.guestsFrequency,
            GUESTS_ORDER
          );
        }
        // workHours como proxy si guestsFrequency no está
        if (similarity === null && userAnswers.workHours && targetAnswers.workHours) {
          similarity = ordinalSimilarity(
            userAnswers.workHours,
            targetAnswers.workHours,
            WORK_ORDER
          );
        }
        break;

      case "workFromHome":
        if (
          userAnswers.workFromHome !== undefined &&
          targetAnswers.workFromHome !== undefined
        ) {
          similarity = userAnswers.workFromHome === targetAnswers.workFromHome
            ? 1.0
            : 0.3; // diferencia no es bloqueo, solo preferencia
        }
        break;
    }

    // Criterio sin datos de al menos uno de los dos → no cuenta
    if (similarity === null) continue;

    respondedCriteria++;
    applicableWeight += criterion.weight;
    weightedSum += criterion.weight * similarity;

    // Bloqueo duro
    if (criterion.hardBlock && similarity === 0) {
      hardBlocked = true;
    }

    factors.push({
      criterion: criterion.key,
      weight: criterion.weight,
      similarity,
      label: criterion.label,
    });
  }

  // Sin datos suficientes
  if (applicableWeight === 0) {
    return { score: 0, factors: [], coverage: 0 };
  }

  const rawScore = hardBlocked
    ? 0
    : (weightedSum / applicableWeight) * 100;

  const score = Math.round(rawScore * 10) / 10; // 1 decimal
  const coverage = respondedCriteria / CRITERIA.length;

  // Warning factor si cobertura baja
  if (coverage < 0.3) {
    factors.push({
      criterion: "coverage_warning",
      weight: 0,
      similarity: coverage,
      label: "Pocos datos disponibles para un resultado confiable",
    });
  }

  return { score, factors, coverage };
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

/**
 * Normaliza y limpia respuestas de cuestionario.
 * Elimina campos undefined/null y valores fuera de rango.
 */
export function normalizeAnswers(
  raw: Partial<QuestionnaireAnswers>
): QuestionnaireAnswers {
  const out: QuestionnaireAnswers = {};

  if (raw.sleepSchedule && ["early", "night_owl", "flexible"].includes(raw.sleepSchedule)) {
    out.sleepSchedule = raw.sleepSchedule;
  }
  if (typeof raw.workFromHome === "boolean") out.workFromHome = raw.workFromHome;
  if (raw.workHours && ["morning", "afternoon", "night", "variable"].includes(raw.workHours)) {
    out.workHours = raw.workHours;
  }
  if (
    typeof raw.cleanlinessLevel === "number" &&
    raw.cleanlinessLevel >= 1 &&
    raw.cleanlinessLevel <= 5
  ) {
    out.cleanlinessLevel = raw.cleanlinessLevel as 1 | 2 | 3 | 4 | 5;
  }
  if (raw.cleaningFrequency && ["daily", "weekly", "biweekly"].includes(raw.cleaningFrequency)) {
    out.cleaningFrequency = raw.cleaningFrequency;
  }
  if (raw.noiseLevel && ["silent", "moderate", "lively"].includes(raw.noiseLevel)) {
    out.noiseLevel = raw.noiseLevel;
  }
  if (raw.guestsFrequency && ["never", "rarely", "sometimes", "often"].includes(raw.guestsFrequency)) {
    out.guestsFrequency = raw.guestsFrequency;
  }
  if (typeof raw.overnightGuests === "boolean") out.overnightGuests = raw.overnightGuests;
  if (typeof raw.hasPets === "boolean") out.hasPets = raw.hasPets;
  if (Array.isArray(raw.petTypes)) out.petTypes = raw.petTypes;
  if (typeof raw.acceptsPets === "boolean") out.acceptsPets = raw.acceptsPets;
  if (typeof raw.smokes === "boolean") out.smokes = raw.smokes;
  if (typeof raw.acceptsSmoking === "boolean") out.acceptsSmoking = raw.acceptsSmoking;
  if (typeof raw.drinksAlcohol === "boolean") out.drinksAlcohol = raw.drinksAlcohol;
  if (typeof raw.maxBudgetCents === "number" && raw.maxBudgetCents > 0) {
    out.maxBudgetCents = raw.maxBudgetCents;
  }
  if (typeof raw.moveInDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.moveInDate)) {
    out.moveInDate = raw.moveInDate;
  }
  if (raw.stayDuration && ["short", "medium", "long"].includes(raw.stayDuration)) {
    out.stayDuration = raw.stayDuration;
  }

  return out;
}

/**
 * Etiqueta descriptiva del nivel de compatibilidad.
 */
export function getCompatibilityLabel(score: number): string {
  if (score >= 80) return "Excelente";
  if (score >= 60) return "Buena";
  if (score >= 40) return "Regular";
  return "Baja";
}
