import {
  calculateCompatibility,
  normalizeAnswers,
  getCompatibilityLabel,
  ALGORITHM_VERSION,
} from "./matching";
import type { QuestionnaireAnswers } from "@/types";

// ─── Fixture: respuestas perfectamente compatibles ────────────────────────────
const perfectA: QuestionnaireAnswers = {
  sleepSchedule: "early",
  cleanlinessLevel: 4,
  noiseLevel: "silent",
  hasPets: false,
  acceptsPets: false,
  smokes: false,
  acceptsSmoking: false,
  guestsFrequency: "rarely",
  workFromHome: true,
};

const perfectB: QuestionnaireAnswers = { ...perfectA };

// ─── Fixture: respuestas opuestas ─────────────────────────────────────────────
const oppositeA: QuestionnaireAnswers = {
  sleepSchedule: "early",
  cleanlinessLevel: 1,
  noiseLevel: "silent",
  hasPets: false,
  acceptsPets: false,
  smokes: false,
  acceptsSmoking: false,
  guestsFrequency: "never",
  workFromHome: true,
};

const oppositeB: QuestionnaireAnswers = {
  sleepSchedule: "night_owl",
  cleanlinessLevel: 5,
  noiseLevel: "lively",
  hasPets: false,
  acceptsPets: false,
  smokes: false,
  acceptsSmoking: false,
  guestsFrequency: "often",
  workFromHome: false,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("calculateCompatibility", () => {
  test("respuestas idénticas producen score cercano a 100", () => {
    const result = calculateCompatibility(perfectA, perfectB);
    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.factors.length).toBeGreaterThan(0);
  });

  test("respuestas opuestas producen score bajo", () => {
    const result = calculateCompatibility(oppositeA, oppositeB);
    expect(result.score).toBeLessThan(50);
  });

  test("bloqueo duro: hasPets=true y acceptsPets=false → score = 0", () => {
    const userWithPet: QuestionnaireAnswers = { ...perfectA, hasPets: true };
    const userNoPets: QuestionnaireAnswers = { ...perfectA, acceptsPets: false };
    const result = calculateCompatibility(userWithPet, userNoPets);
    expect(result.score).toBe(0);
  });

  test("bloqueo duro en sentido inverso: targetHasPets=true y userAccepts=false → score = 0", () => {
    const userA: QuestionnaireAnswers = { ...perfectA, acceptsPets: false };
    const userB: QuestionnaireAnswers = { ...perfectA, hasPets: true };
    const result = calculateCompatibility(userA, userB);
    expect(result.score).toBe(0);
  });

  test("bloqueo duro: smokes=true y acceptsSmoking=false → score = 0", () => {
    const smoker: QuestionnaireAnswers = { ...perfectA, smokes: true };
    const noSmoking: QuestionnaireAnswers = { ...perfectA, acceptsSmoking: false };
    const result = calculateCompatibility(smoker, noSmoking);
    expect(result.score).toBe(0);
  });

  test("sin mascotas en ambos y aceptan mascotas → no bloqueo, score > 0", () => {
    const a: QuestionnaireAnswers = { ...perfectA, hasPets: false, acceptsPets: true };
    const b: QuestionnaireAnswers = { ...perfectA, hasPets: false, acceptsPets: true };
    const result = calculateCompatibility(a, b);
    expect(result.score).toBeGreaterThan(0);
  });

  test("respuestas parciales no penalizan (coverage parcial)", () => {
    const minimal: QuestionnaireAnswers = {
      sleepSchedule: "early",
      cleanlinessLevel: 3,
    };
    const result = calculateCompatibility(minimal, minimal);
    // Con solo 2 criterios respondidos, score no debe ser 0
    expect(result.score).toBeGreaterThan(0);
    expect(result.coverage).toBeLessThan(0.5);
  });

  test("coverage bajo genera factor de advertencia", () => {
    const sparse: QuestionnaireAnswers = { sleepSchedule: "early" };
    const result = calculateCompatibility(sparse, sparse);
    const warning = result.factors.find((f) => f.criterion === "coverage_warning");
    expect(warning).toBeDefined();
  });

  test("sin datos comunes → score = 0, factors vacíos", () => {
    const a: QuestionnaireAnswers = { maxBudgetCents: 5000_00 };
    const b: QuestionnaireAnswers = { moveInDate: "2026-01-01" };
    const result = calculateCompatibility(a, b);
    expect(result.score).toBe(0);
    expect(result.factors.filter((f) => f.criterion !== "coverage_warning").length).toBe(0);
  });

  test("es determinista: mismas entradas producen mismo resultado", () => {
    const r1 = calculateCompatibility(perfectA, oppositeB);
    const r2 = calculateCompatibility(perfectA, oppositeB);
    expect(r1.score).toBe(r2.score);
    expect(r1.factors).toEqual(r2.factors);
  });

  test("cleanlinessLevel: diferencia de 1 produce similitud alta", () => {
    const a: QuestionnaireAnswers = { cleanlinessLevel: 3, sleepSchedule: "flexible", noiseLevel: "moderate", hasPets: false, smokes: false, acceptsPets: false, acceptsSmoking: false };
    const b: QuestionnaireAnswers = { cleanlinessLevel: 4, sleepSchedule: "flexible", noiseLevel: "moderate", hasPets: false, smokes: false, acceptsPets: false, acceptsSmoking: false };
    const result = calculateCompatibility(a, b);
    const cleanlinessFactor = result.factors.find((f) => f.criterion === "cleanlinessLevel");
    expect(cleanlinessFactor).toBeDefined();
    expect(cleanlinessFactor!.similarity).toBeCloseTo(0.75, 2);
  });

  test("cleanlinessLevel: diferencia máxima (1 vs 5) produce similitud 0", () => {
    const a: QuestionnaireAnswers = { cleanlinessLevel: 1 };
    const b: QuestionnaireAnswers = { cleanlinessLevel: 5 };
    const result = calculateCompatibility(a, b);
    const factor = result.factors.find((f) => f.criterion === "cleanlinessLevel");
    expect(factor?.similarity).toBe(0);
  });

  test("el algoritmo exporta ALGORITHM_VERSION como string", () => {
    expect(typeof ALGORITHM_VERSION).toBe("string");
    expect(ALGORITHM_VERSION.length).toBeGreaterThan(0);
  });
});

// ─── normalizeAnswers ─────────────────────────────────────────────────────────

describe("normalizeAnswers", () => {
  test("elimina campos con valores inválidos", () => {
    const raw = {
      sleepSchedule: "invalid_value" as QuestionnaireAnswers["sleepSchedule"],
      cleanlinessLevel: 10 as QuestionnaireAnswers["cleanlinessLevel"],
      noiseLevel: "moderate" as const,
    };
    const out = normalizeAnswers(raw);
    expect(out.sleepSchedule).toBeUndefined();
    expect(out.cleanlinessLevel).toBeUndefined();
    expect(out.noiseLevel).toBe("moderate");
  });

  test("conserva valores válidos", () => {
    const raw: QuestionnaireAnswers = {
      sleepSchedule: "flexible",
      cleanlinessLevel: 3,
      hasPets: true,
      smokes: false,
    };
    const out = normalizeAnswers(raw);
    expect(out.sleepSchedule).toBe("flexible");
    expect(out.cleanlinessLevel).toBe(3);
    expect(out.hasPets).toBe(true);
    expect(out.smokes).toBe(false);
  });

  test("ignora campos null/undefined sin lanzar error", () => {
    expect(() => normalizeAnswers({})).not.toThrow();
    expect(() =>
      normalizeAnswers({ sleepSchedule: undefined, cleanlinessLevel: undefined })
    ).not.toThrow();
  });

  test("valida rango de cleanlinessLevel (1-5)", () => {
    expect(normalizeAnswers({ cleanlinessLevel: 0 as 1 }).cleanlinessLevel).toBeUndefined();
    expect(normalizeAnswers({ cleanlinessLevel: 6 as 1 }).cleanlinessLevel).toBeUndefined();
    expect(normalizeAnswers({ cleanlinessLevel: 1 }).cleanlinessLevel).toBe(1);
    expect(normalizeAnswers({ cleanlinessLevel: 5 }).cleanlinessLevel).toBe(5);
  });
});

// ─── getCompatibilityLabel ────────────────────────────────────────────────────

describe("getCompatibilityLabel", () => {
  test.each([
    [100, "Excelente"],
    [80,  "Excelente"],
    [79,  "Buena"],
    [60,  "Buena"],
    [59,  "Regular"],
    [40,  "Regular"],
    [39,  "Baja"],
    [0,   "Baja"],
  ])("score %i → '%s'", (score, label) => {
    expect(getCompatibilityLabel(score)).toBe(label);
  });
});
