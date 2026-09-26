/**
 * Lógica pura de reparto de facturas.
 *
 * Reglas de dominio:
 * - Los importes se calculan en centavos (enteros) para evitar errores de redondeo.
 * - La suma de todas las participaciones debe coincidir exactamente con el total.
 * - El centavo residual del redondeo se asigna al primer residente activo (mayor importe).
 * - Un reparto confirmado no puede sobrescribirse; se crea una nueva versión.
 * - La función es pura y determinista: sin efectos secundarios ni dependencias externas.
 */

import type { SplitRule, ResidentSplitInput } from "@/types";

// ─── Tipos locales ────────────────────────────────────────────────────────────

export interface ShareCalculation {
  residentId: string;
  residentName?: string;
  rule: SplitRule;
  proportion: number;        // fracción exacta (0-1)
  amountCents: number;       // entero, sin redondeo flotante
  daysOccupied?: number;
  totalDays?: number;
  percentageValue?: number;  // porcentaje original ingresado
}

export interface BillSplitResult {
  shares: ShareCalculation[];
  totalAmountCents: number;
  /** Suma de todas las participaciones — debe coincidir con totalAmountCents */
  verifiedTotal: number;
  rule: SplitRule;
}

// ─── Error tipado ─────────────────────────────────────────────────────────────

export class BillSplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillSplitError";
  }
}

// ─── Motor principal ──────────────────────────────────────────────────────────

/**
 * Calcula el reparto de una factura entre residentes.
 *
 * @param totalAmountCents - Monto total en centavos (entero positivo)
 * @param rule             - Regla de reparto a aplicar
 * @param residents        - Lista de residentes con sus parámetros
 * @param totalDays        - Total de días del período (solo para days_occupied)
 * @returns BillSplitResult con las participaciones calculadas
 * @throws BillSplitError si los datos son inválidos
 */
export function calculateBillSplit(
  totalAmountCents: number,
  rule: SplitRule,
  residents: ResidentSplitInput[],
  totalDays?: number
): BillSplitResult {
  // ── Validaciones básicas ──
  if (!Number.isInteger(totalAmountCents) || totalAmountCents <= 0) {
    throw new BillSplitError("El monto total debe ser un entero positivo en centavos");
  }
  if (residents.length === 0) {
    throw new BillSplitError("Debe haber al menos un residente");
  }

  // ── Filtrar excluidos ──
  const active = residents.filter((r) => !r.excluded);
  if (active.length === 0) {
    throw new BillSplitError("Todos los residentes están excluidos; al menos uno debe participar");
  }

  switch (rule) {
    case "equal":
      return splitEqual(totalAmountCents, active);
    case "percentage":
      return splitByPercentage(totalAmountCents, active);
    case "days_occupied":
      return splitByDays(totalAmountCents, active, totalDays);
    case "exclude":
      // "exclude" como regla global significa dividir equitativamente entre los no excluidos
      return splitEqual(totalAmountCents, active);
    default: {
      const _exhaustive: never = rule;
      throw new BillSplitError(`Regla de reparto desconocida: ${String(_exhaustive)}`);
    }
  }
}

// ─── Reparto equitativo ───────────────────────────────────────────────────────

function splitEqual(
  totalAmountCents: number,
  active: ResidentSplitInput[]
): BillSplitResult {
  const n = active.length;
  const base = Math.floor(totalAmountCents / n);
  const remainder = totalAmountCents - base * n; // centavos sobrantes (0 a n-1)

  const shares: ShareCalculation[] = active.map((r, i) => {
    const amount = base + (i === 0 ? remainder : 0); // el primero absorbe el residuo
    return {
      residentId: r.residentId,
      residentName: r.residentName,
      rule: "equal",
      proportion: amount / totalAmountCents,
      amountCents: amount,
    };
  });

  return buildResult(shares, totalAmountCents, "equal");
}

// ─── Reparto por porcentaje ───────────────────────────────────────────────────

function splitByPercentage(
  totalAmountCents: number,
  active: ResidentSplitInput[]
): BillSplitResult {
  const percentages = active.map((r) => r.percentage ?? 0);
  const totalPct = percentages.reduce((a, b) => a + b, 0);

  if (Math.round(totalPct) !== 100) {
    throw new BillSplitError(
      `Los porcentajes deben sumar 100 (actual: ${totalPct})`
    );
  }

  // Calcular importes con método de Largest Remainder (Hamilton)
  // para garantizar que la suma exacta sea totalAmountCents
  const rawAmounts = percentages.map((p) => (p / 100) * totalAmountCents);
  const floored = rawAmounts.map((a) => Math.floor(a));
  const remainders = rawAmounts.map((a, i) => a - floored[i]);

  const totalFloored = floored.reduce((a, b) => a + b, 0);
  let leftover = totalAmountCents - totalFloored;

  // Distribuir los centavos sobrantes a los que tienen mayor parte decimal
  const sorted = remainders
    .map((r, i) => ({ i, r }))
    .sort((a, b) => b.r - a.r);

  for (const { i } of sorted) {
    if (leftover <= 0) break;
    floored[i]++;
    leftover--;
  }

  const shares: ShareCalculation[] = active.map((r, i) => ({
    residentId: r.residentId,
    residentName: r.residentName,
    rule: "percentage",
    proportion: floored[i] / totalAmountCents,
    amountCents: floored[i],
    percentageValue: r.percentage,
  }));

  return buildResult(shares, totalAmountCents, "percentage");
}

// ─── Reparto por días ocupados ────────────────────────────────────────────────

function splitByDays(
  totalAmountCents: number,
  active: ResidentSplitInput[],
  totalDays?: number
): BillSplitResult {
  if (!totalDays || totalDays <= 0) {
    throw new BillSplitError(
      "totalDays es requerido y debe ser positivo para el reparto por días"
    );
  }

  for (const r of active) {
    if (r.daysOccupied === undefined || r.daysOccupied < 0) {
      throw new BillSplitError(
        `daysOccupied es requerido para el residente ${r.residentId}`
      );
    }
    if (r.daysOccupied > totalDays) {
      throw new BillSplitError(
        `daysOccupied (${r.daysOccupied}) no puede superar totalDays (${totalDays}) para ${r.residentId}`
      );
    }
  }

  const totalOccupied = active.reduce((sum, r) => sum + (r.daysOccupied ?? 0), 0);
  if (totalOccupied === 0) {
    throw new BillSplitError("La suma de días ocupados es 0; no se puede calcular el reparto");
  }

  // Calcular con Largest Remainder igual que percentages
  const rawAmounts = active.map(
    (r) => ((r.daysOccupied ?? 0) / totalOccupied) * totalAmountCents
  );
  const floored = rawAmounts.map((a) => Math.floor(a));
  const remainders = rawAmounts.map((a, i) => a - floored[i]);

  const totalFloored = floored.reduce((a, b) => a + b, 0);
  let leftover = totalAmountCents - totalFloored;

  const sorted = remainders
    .map((r, i) => ({ i, r }))
    .sort((a, b) => b.r - a.r);

  for (const { i } of sorted) {
    if (leftover <= 0) break;
    floored[i]++;
    leftover--;
  }

  const shares: ShareCalculation[] = active.map((r, i) => ({
    residentId: r.residentId,
    residentName: r.residentName,
    rule: "days_occupied",
    proportion: floored[i] / totalAmountCents,
    amountCents: floored[i],
    daysOccupied: r.daysOccupied,
    totalDays,
  }));

  return buildResult(shares, totalAmountCents, "days_occupied");
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function buildResult(
  shares: ShareCalculation[],
  totalAmountCents: number,
  rule: SplitRule
): BillSplitResult {
  const verifiedTotal = shares.reduce((sum, s) => sum + s.amountCents, 0);

  if (verifiedTotal !== totalAmountCents) {
    // Esto nunca debería ocurrir si el algoritmo es correcto
    throw new BillSplitError(
      `Error interno: la suma de participaciones (${verifiedTotal}) no coincide con el total (${totalAmountCents})`
    );
  }

  return { shares, totalAmountCents, verifiedTotal, rule };
}

// ─── Formateo ─────────────────────────────────────────────────────────────────

/**
 * Formatea centavos como moneda para mostrar en UI.
 * Ejemplo: 150025 → "$1,500.25"
 */
export function formatCents(
  cents: number,
  currency = "MXN",
  locale = "es-MX"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Convierte pesos (número con decimales) a centavos enteros.
 * Ejemplo: 1500.25 → 150025
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
