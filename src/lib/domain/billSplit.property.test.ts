/**
 * Pruebas basadas en propiedades (property-based testing) del motor de reparto.
 *
 * A diferencia de las pruebas por casos puntuales (billSplit.test.ts), aquí se
 * definen INVARIANTES del dominio que deben cumplirse para CUALQUIER entrada
 * válida, y fast-check genera cientos de combinaciones aleatorias de montos,
 * número de residentes, porcentajes y días para intentar romperlas.
 *
 * Invariante central del dominio (steering de LivingShare):
 *   "La suma de las participaciones es exactamente igual al total de la factura"
 *   para cualquier regla, número de residentes y monto en centavos.
 */

import fc from "fast-check";
import { calculateBillSplit } from "./billSplit";
import type { ResidentSplitInput } from "@/types";

// ─── Generadores ────────────────────────────────────────────────────────────

/** Monto total en centavos: entero positivo, rango realista (1 centavo a $1,000,000). */
const totalCentsArb = fc.integer({ min: 1, max: 100_000_000 });

/** Número de residentes activos (1 a 12). */
const residentCountArb = fc.integer({ min: 1, max: 12 });

function makeResidents(n: number): ResidentSplitInput[] {
  return Array.from({ length: n }, (_, i) => ({
    residentId: `r${i}`,
    residentName: `Residente ${i}`,
  }));
}

// ─── Invariante 1: reparto equitativo suma exacta ────────────────────────────

describe("Property: reparto equitativo", () => {
  it("la suma de participaciones siempre es igual al total, para cualquier monto y número de residentes", () => {
    fc.assert(
      fc.property(totalCentsArb, residentCountArb, (totalCents, n) => {
        const residents = makeResidents(n);
        const result = calculateBillSplit(totalCents, "equal", residents);

        const sum = result.shares.reduce((s, sh) => s + sh.amountCents, 0);
        // Invariante: no se pierde ni se crea un centavo.
        expect(sum).toBe(totalCents);
        expect(result.verifiedTotal).toBe(totalCents);
      }),
      { numRuns: 500 }
    );
  });

  it("todas las participaciones son enteros no negativos", () => {
    fc.assert(
      fc.property(totalCentsArb, residentCountArb, (totalCents, n) => {
        const result = calculateBillSplit(totalCents, "equal", makeResidents(n));
        for (const sh of result.shares) {
          expect(Number.isInteger(sh.amountCents)).toBe(true);
          expect(sh.amountCents).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 300 }
    );
  });

  it("la diferencia entre participaciones nunca supera el residuo (totalCents mod n)", () => {
    fc.assert(
      fc.property(totalCentsArb, residentCountArb, (totalCents, n) => {
        const result = calculateBillSplit(totalCents, "equal", makeResidents(n));
        const amounts = result.shares.map((s) => s.amountCents);
        const max = Math.max(...amounts);
        const min = Math.min(...amounts);
        // El algoritmo asigna todo el residuo (totalCents % n) al primer residente,
        // por lo que la diferencia máxima es exactamente ese residuo, siempre < n.
        const remainder = totalCents % n;
        expect(max - min).toBe(remainder);
        expect(max - min).toBeLessThan(n);
      }),
      { numRuns: 300 }
    );
  });
});

// ─── Invariante 2: reparto por días suma exacta ──────────────────────────────

describe("Property: reparto por días ocupados", () => {
  it("la suma de participaciones siempre es igual al total, para cualquier combinación de días", () => {
    fc.assert(
      fc.property(
        totalCentsArb,
        fc.integer({ min: 1, max: 365 }),
        fc.array(fc.integer({ min: 0, max: 365 }), { minLength: 1, maxLength: 10 }),
        (totalCents, totalDays, rawDays) => {
          // Ajustar días para que no superen totalDays y que al menos uno sea > 0.
          const days: number[] = rawDays.map((d) => d % (totalDays + 1));
          if (days.every((d) => d === 0)) days[0] = 1; // garantizar suma > 0

          const residents: ResidentSplitInput[] = days.map((d, i) => ({
            residentId: `r${i}`,
            daysOccupied: d,
          }));

          const result = calculateBillSplit(totalCents, "days_occupied", residents, totalDays);
          const sum = result.shares.reduce((s, sh) => s + sh.amountCents, 0);
          expect(sum).toBe(totalCents);
        }
      ),
      { numRuns: 500 }
    );
  });
});

// ─── Invariante 3: reparto por porcentaje suma exacta ────────────────────────

describe("Property: reparto por porcentaje", () => {
  it("cuando los porcentajes suman 100, la suma de participaciones es igual al total", () => {
    fc.assert(
      fc.property(
        totalCentsArb,
        // genera entre 2 y 10 "pesos" positivos que luego normalizamos a 100
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 2, maxLength: 10 }),
        (totalCents, weights) => {
          const totalWeight = weights.reduce((a, b) => a + b, 0);
          // Normalizar a porcentajes enteros que sumen exactamente 100.
          const pcts = weights.map((w) => Math.floor((w / totalWeight) * 100));
          let diff = 100 - pcts.reduce((a, b) => a + b, 0);
          // Asignar el resto al primero para que sumen 100 exactos.
          pcts[0] += diff;
          diff = 0;

          const residents: ResidentSplitInput[] = pcts.map((p, i) => ({
            residentId: `r${i}`,
            percentage: p,
          }));

          const result = calculateBillSplit(totalCents, "percentage", residents);
          const sum = result.shares.reduce((s, sh) => s + sh.amountCents, 0);
          expect(sum).toBe(totalCents);
        }
      ),
      { numRuns: 500 }
    );
  });
});

// ─── Invariante 4: exclusión individual ──────────────────────────────────────

describe("Property: exclusión de residentes", () => {
  it("un residente excluido nunca recibe importe y los activos cubren el total", () => {
    fc.assert(
      fc.property(
        totalCentsArb,
        fc.array(fc.boolean(), { minLength: 2, maxLength: 10 }),
        (totalCents, excludedFlags) => {
          // Garantizar al menos un residente activo.
          if (excludedFlags.every((e) => e)) excludedFlags[0] = false;

          const residents: ResidentSplitInput[] = excludedFlags.map((excluded, i) => ({
            residentId: `r${i}`,
            excluded,
          }));

          const result = calculateBillSplit(totalCents, "equal", residents);

          // Ningún excluido aparece en el resultado.
          const resultIds = new Set(result.shares.map((s) => s.residentId));
          residents.forEach((r, i) => {
            if (r.excluded) {
              expect(resultIds.has(`r${i}`)).toBe(false);
            }
          });

          // Los activos cubren exactamente el total.
          const sum = result.shares.reduce((s, sh) => s + sh.amountCents, 0);
          expect(sum).toBe(totalCents);
        }
      ),
      { numRuns: 400 }
    );
  });
});
