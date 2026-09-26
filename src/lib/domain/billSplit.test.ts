import {
  calculateBillSplit,
  formatCents,
  toCents,
  BillSplitError,
} from "./billSplit";
import type { ResidentSplitInput } from "@/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const r1: ResidentSplitInput = { residentId: "r1", residentName: "Ana" };
const r2: ResidentSplitInput = { residentId: "r2", residentName: "Beto" };
const r3: ResidentSplitInput = { residentId: "r3", residentName: "Carla" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sumShares(result: ReturnType<typeof calculateBillSplit>) {
  return result.shares.reduce((s, r) => s + r.amountCents, 0);
}

// ─── equal ────────────────────────────────────────────────────────────────────

describe("calculateBillSplit — equal", () => {
  test("divide exactamente entre 2 residentes (total divisible)", () => {
    const result = calculateBillSplit(10000, "equal", [r1, r2]);
    expect(result.shares).toHaveLength(2);
    expect(result.shares[0].amountCents).toBe(5000);
    expect(result.shares[1].amountCents).toBe(5000);
    expect(sumShares(result)).toBe(10000);
  });

  test("divide entre 3 residentes con centavo residual en el primero", () => {
    // 10001 / 3 = 3333.67 → base=3333, residuo=2
    const result = calculateBillSplit(10001, "equal", [r1, r2, r3]);
    expect(result.shares).toHaveLength(3);
    expect(sumShares(result)).toBe(10001);
    // El primero absorbe el residuo
    expect(result.shares[0].amountCents).toBe(3335);
    expect(result.shares[1].amountCents).toBe(3333);
    expect(result.shares[2].amountCents).toBe(3333);
  });

  test("suma siempre coincide con el total (propiedad de invariante)", () => {
    for (let total = 1; total <= 500; total++) {
      const result = calculateBillSplit(total, "equal", [r1, r2, r3]);
      expect(sumShares(result)).toBe(total);
    }
  });

  test("todos los amountCents son enteros", () => {
    const result = calculateBillSplit(99999, "equal", [r1, r2, r3]);
    for (const s of result.shares) {
      expect(Number.isInteger(s.amountCents)).toBe(true);
    }
  });

  test("rule=exclude aplica igual como equal entre los no excluidos", () => {
    const excluded = { ...r3, excluded: true };
    const result = calculateBillSplit(9000, "exclude", [r1, r2, excluded]);
    expect(result.shares).toHaveLength(2);
    expect(result.shares.find((s) => s.residentId === "r3")).toBeUndefined();
    expect(sumShares(result)).toBe(9000);
  });

  test("un solo residente activo recibe el 100%", () => {
    const result = calculateBillSplit(7500, "equal", [r1]);
    expect(result.shares[0].amountCents).toBe(7500);
    expect(result.shares[0].proportion).toBe(1);
  });

  test("es determinista: mismas entradas producen el mismo resultado", () => {
    const a = calculateBillSplit(10001, "equal", [r1, r2, r3]);
    const b = calculateBillSplit(10001, "equal", [r1, r2, r3]);
    expect(a.shares).toEqual(b.shares);
  });
});

// ─── percentage ───────────────────────────────────────────────────────────────

describe("calculateBillSplit — percentage", () => {
  test("divide según porcentajes exactos (50/50)", () => {
    const residents = [
      { ...r1, percentage: 50 },
      { ...r2, percentage: 50 },
    ];
    const result = calculateBillSplit(10000, "percentage", residents);
    expect(result.shares[0].amountCents).toBe(5000);
    expect(result.shares[1].amountCents).toBe(5000);
    expect(sumShares(result)).toBe(10000);
  });

  test("divide con porcentajes asimétricos (70/30)", () => {
    const residents = [
      { ...r1, percentage: 70 },
      { ...r2, percentage: 30 },
    ];
    const result = calculateBillSplit(10000, "percentage", residents);
    expect(result.shares[0].amountCents).toBe(7000);
    expect(result.shares[1].amountCents).toBe(3000);
    expect(sumShares(result)).toBe(10000);
  });

  test("reparto 33/33/34 — suma siempre es el total", () => {
    const residents = [
      { ...r1, percentage: 33 },
      { ...r2, percentage: 33 },
      { ...r3, percentage: 34 },
    ];
    const result = calculateBillSplit(10000, "percentage", residents);
    expect(sumShares(result)).toBe(10000);
  });

  test("Largest Remainder garantiza total exacto con porcentajes difíciles", () => {
    // 100/3 ≈ 33.33 cada uno
    const residents = [
      { ...r1, percentage: 33.33 },
      { ...r2, percentage: 33.33 },
      { ...r3, percentage: 33.34 },
    ];
    const result = calculateBillSplit(9999, "percentage", residents);
    expect(sumShares(result)).toBe(9999);
    for (const s of result.shares) {
      expect(Number.isInteger(s.amountCents)).toBe(true);
    }
  });

  test("lanza BillSplitError si porcentajes no suman 100", () => {
    const residents = [
      { ...r1, percentage: 40 },
      { ...r2, percentage: 40 },
    ];
    expect(() => calculateBillSplit(10000, "percentage", residents)).toThrow(
      BillSplitError
    );
  });

  test("excluidos no participan y los activos reciben el total", () => {
    const residents = [
      { ...r1, percentage: 60 },
      { ...r2, percentage: 40 },
      { ...r3, percentage: 0, excluded: true },
    ];
    const result = calculateBillSplit(10000, "percentage", residents);
    expect(result.shares).toHaveLength(2);
    expect(sumShares(result)).toBe(10000);
  });

  test("guarda el percentageValue original en cada share", () => {
    const residents = [
      { ...r1, percentage: 70 },
      { ...r2, percentage: 30 },
    ];
    const result = calculateBillSplit(10000, "percentage", residents);
    expect(result.shares[0].percentageValue).toBe(70);
    expect(result.shares[1].percentageValue).toBe(30);
  });
});

// ─── days_occupied ────────────────────────────────────────────────────────────

describe("calculateBillSplit — days_occupied", () => {
  test("divide proporcionalmente por días ocupados", () => {
    // r1: 20 días, r2: 10 días → r1 paga 2/3, r2 paga 1/3
    const residents = [
      { ...r1, daysOccupied: 20 },
      { ...r2, daysOccupied: 10 },
    ];
    const result = calculateBillSplit(9000, "days_occupied", residents, 30);
    expect(sumShares(result)).toBe(9000);
    expect(result.shares[0].amountCents).toBe(6000); // 2/3 de 9000
    expect(result.shares[1].amountCents).toBe(3000); // 1/3 de 9000
  });

  test("suma siempre coincide con el total (invariante)", () => {
    for (let total = 1; total <= 300; total++) {
      const residents = [
        { ...r1, daysOccupied: 15 },
        { ...r2, daysOccupied: 10 },
        { ...r3, daysOccupied: 5 },
      ];
      const result = calculateBillSplit(total, "days_occupied", residents, 30);
      expect(sumShares(result)).toBe(total);
    }
  });

  test("todos los amountCents son enteros", () => {
    const residents = [
      { ...r1, daysOccupied: 13 },
      { ...r2, daysOccupied: 17 },
    ];
    const result = calculateBillSplit(9999, "days_occupied", residents, 30);
    for (const s of result.shares) {
      expect(Number.isInteger(s.amountCents)).toBe(true);
    }
  });

  test("guarda daysOccupied y totalDays en cada share", () => {
    const residents = [
      { ...r1, daysOccupied: 15 },
      { ...r2, daysOccupied: 15 },
    ];
    const result = calculateBillSplit(10000, "days_occupied", residents, 30);
    expect(result.shares[0].daysOccupied).toBe(15);
    expect(result.shares[0].totalDays).toBe(30);
  });

  test("lanza BillSplitError si totalDays no se provee", () => {
    const residents = [{ ...r1, daysOccupied: 10 }];
    expect(() => calculateBillSplit(10000, "days_occupied", residents)).toThrow(
      BillSplitError
    );
  });

  test("lanza BillSplitError si falta daysOccupied en un residente", () => {
    const residents = [r1, { ...r2, daysOccupied: 10 }];
    expect(() =>
      calculateBillSplit(10000, "days_occupied", residents, 30)
    ).toThrow(BillSplitError);
  });

  test("lanza BillSplitError si daysOccupied supera totalDays", () => {
    const residents = [{ ...r1, daysOccupied: 40 }];
    expect(() =>
      calculateBillSplit(10000, "days_occupied", residents, 30)
    ).toThrow(BillSplitError);
  });

  test("lanza BillSplitError si la suma de días es 0", () => {
    const residents = [
      { ...r1, daysOccupied: 0 },
      { ...r2, daysOccupied: 0 },
    ];
    expect(() =>
      calculateBillSplit(10000, "days_occupied", residents, 30)
    ).toThrow(BillSplitError);
  });
});

// ─── Validaciones generales ────────────────────────────────────────────────────

describe("calculateBillSplit — validaciones", () => {
  test("lanza BillSplitError si totalAmountCents no es entero positivo", () => {
    expect(() => calculateBillSplit(0, "equal", [r1])).toThrow(BillSplitError);
    expect(() => calculateBillSplit(-100, "equal", [r1])).toThrow(BillSplitError);
    expect(() => calculateBillSplit(99.5, "equal", [r1])).toThrow(BillSplitError);
  });

  test("lanza BillSplitError si no hay residentes", () => {
    expect(() => calculateBillSplit(10000, "equal", [])).toThrow(BillSplitError);
  });

  test("lanza BillSplitError si todos los residentes están excluidos", () => {
    const excluded = [
      { ...r1, excluded: true },
      { ...r2, excluded: true },
    ];
    expect(() => calculateBillSplit(10000, "equal", excluded)).toThrow(
      BillSplitError
    );
  });

  test("el resultado incluye verifiedTotal == totalAmountCents", () => {
    const result = calculateBillSplit(15000, "equal", [r1, r2, r3]);
    expect(result.verifiedTotal).toBe(result.totalAmountCents);
  });
});

// ─── formatCents ─────────────────────────────────────────────────────────────

describe("formatCents", () => {
  test("formatea centavos como moneda MXN", () => {
    expect(formatCents(150000)).toMatch(/1[,.]500/);
  });

  test("formatea 100 centavos como 1 peso", () => {
    expect(formatCents(100)).toMatch(/1[.,]00/);
  });

  test("formatea 0 centavos como 0", () => {
    expect(formatCents(0)).toMatch(/0[.,]00/);
  });
});

// ─── toCents ─────────────────────────────────────────────────────────────────

describe("toCents", () => {
  test("convierte 1500.25 → 150025", () => {
    expect(toCents(1500.25)).toBe(150025);
  });

  test("convierte 0 → 0", () => {
    expect(toCents(0)).toBe(0);
  });

  test("redondea correctamente para evitar errores de punto flotante", () => {
    // 1.005 * 100 en JS = 100.49999... → Math.round → 100
    // pero 1.015 * 100 = 101.5 → 102
    expect(toCents(0.1 + 0.2)).toBe(30); // 0.30000...04 → 30
  });
});
