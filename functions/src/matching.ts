// Motor de matching para Cloud Functions — sin imports de Next.js

export const ALGORITHM_VERSION = "1.0.0";

export interface QuestionnaireAnswers {
  sleepSchedule?: "early" | "night_owl" | "flexible";
  workFromHome?: boolean;
  workHours?: "morning" | "afternoon" | "night" | "variable";
  cleanlinessLevel?: 1 | 2 | 3 | 4 | 5;
  cleaningFrequency?: "daily" | "weekly" | "biweekly";
  noiseLevel?: "silent" | "moderate" | "lively";
  guestsFrequency?: "never" | "rarely" | "sometimes" | "often";
  overnightGuests?: boolean;
  hasPets?: boolean;
  petTypes?: string[];
  acceptsPets?: boolean;
  smokes?: boolean;
  acceptsSmoking?: boolean;
  drinksAlcohol?: boolean;
  maxBudgetCents?: number;
  moveInDate?: string;
  stayDuration?: "short" | "medium" | "long";
}

export interface MatchFactor {
  criterion: string;
  weight: number;
  similarity: number;
  label: string;
}

export interface CompatibilityResult {
  score: number;
  factors: MatchFactor[];
  coverage: number;
}

const SLEEP_ORDER = ["early", "flexible", "night_owl"] as const;
const NOISE_ORDER = ["silent", "moderate", "lively"] as const;
const GUESTS_ORDER = ["never", "rarely", "sometimes", "often"] as const;
const WORK_ORDER = ["morning", "afternoon", "variable", "night"] as const;

const CRITERIA = [
  { key: "sleepSchedule",    weight: 0.20, label: "Horario de descanso" },
  { key: "cleanlinessLevel", weight: 0.20, label: "Nivel de limpieza" },
  { key: "noiseLevel",       weight: 0.15, label: "Nivel de ruido" },
  { key: "pets",             weight: 0.15, label: "Mascotas",        hardBlock: true },
  { key: "smoking",          weight: 0.15, label: "Tabaco",          hardBlock: true },
  { key: "guestsFrequency",  weight: 0.10, label: "Visitas" },
  { key: "workFromHome",     weight: 0.05, label: "Trabajo desde casa" },
];

function ordinalSimilarity(a: string, b: string, order: readonly string[]): number {
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia === -1 || ib === -1) return 0;
  return 1 - Math.abs(ia - ib) / (order.length - 1);
}

function numericSimilarity(a: number, b: number, maxDiff = 4): number {
  return 1 - Math.abs(a - b) / maxDiff;
}

function petSimilarity(a: QuestionnaireAnswers, b: QuestionnaireAnswers): number | null {
  if (a.hasPets === undefined && b.hasPets === undefined) return null;
  if (a.hasPets === true && b.acceptsPets === false) return 0;
  if (b.hasPets === true && a.acceptsPets === false) return 0;
  return 1.0;
}

function smokingSimilarity(a: QuestionnaireAnswers, b: QuestionnaireAnswers): number | null {
  if (a.smokes === undefined && b.smokes === undefined) return null;
  if (a.smokes === true && b.acceptsSmoking === false) return 0;
  if (b.smokes === true && a.acceptsSmoking === false) return 0;
  return 1.0;
}

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
        if (userAnswers.sleepSchedule && targetAnswers.sleepSchedule)
          similarity = ordinalSimilarity(userAnswers.sleepSchedule, targetAnswers.sleepSchedule, SLEEP_ORDER);
        break;
      case "cleanlinessLevel":
        if (userAnswers.cleanlinessLevel !== undefined && targetAnswers.cleanlinessLevel !== undefined)
          similarity = numericSimilarity(userAnswers.cleanlinessLevel, targetAnswers.cleanlinessLevel);
        break;
      case "noiseLevel":
        if (userAnswers.noiseLevel && targetAnswers.noiseLevel)
          similarity = ordinalSimilarity(userAnswers.noiseLevel, targetAnswers.noiseLevel, NOISE_ORDER);
        break;
      case "pets":
        similarity = petSimilarity(userAnswers, targetAnswers);
        break;
      case "smoking":
        similarity = smokingSimilarity(userAnswers, targetAnswers);
        break;
      case "guestsFrequency":
        if (userAnswers.guestsFrequency && targetAnswers.guestsFrequency)
          similarity = ordinalSimilarity(userAnswers.guestsFrequency, targetAnswers.guestsFrequency, GUESTS_ORDER);
        if (similarity === null && userAnswers.workHours && targetAnswers.workHours)
          similarity = ordinalSimilarity(userAnswers.workHours, targetAnswers.workHours, WORK_ORDER);
        break;
      case "workFromHome":
        if (userAnswers.workFromHome !== undefined && targetAnswers.workFromHome !== undefined)
          similarity = userAnswers.workFromHome === targetAnswers.workFromHome ? 1.0 : 0.3;
        break;
    }

    if (similarity === null) continue;
    respondedCriteria++;
    applicableWeight += criterion.weight;
    weightedSum += criterion.weight * similarity;
    if (criterion.hardBlock && similarity === 0) hardBlocked = true;

    factors.push({ criterion: criterion.key, weight: criterion.weight, similarity, label: criterion.label });
  }

  if (applicableWeight === 0) return { score: 0, factors: [], coverage: 0 };

  const raw = hardBlocked ? 0 : (weightedSum / applicableWeight) * 100;
  const score = Math.round(raw * 10) / 10;
  const coverage = respondedCriteria / CRITERIA.length;

  if (coverage < 0.3) {
    factors.push({ criterion: "coverage_warning", weight: 0, similarity: coverage, label: "Pocos datos para resultado confiable" });
  }

  return { score, factors, coverage };
}
