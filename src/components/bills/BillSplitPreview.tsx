"use client";

import { useState, useMemo } from "react";
import { calculateBillSplit, formatCents, BillSplitError } from "@/lib/domain/billSplit";
import type { SplitRule, ResidentSplitInput } from "@/types";

interface ResidentOption {
  residentId: string;
  displayName: string;
}

interface BillSplitPreviewProps {
  totalAmountCents: number;
  residents: ResidentOption[];
  onConfirm: (
    rule: SplitRule,
    residentInputs: ResidentSplitInput[],
    totalDays?: number
  ) => Promise<void>;
  isLoading?: boolean;
}

const RULE_LABELS: Record<SplitRule, string> = {
  equal: "División equitativa",
  percentage: "Por porcentaje",
  days_occupied: "Por días ocupados",
  exclude: "Exclusión individual",
};

export default function BillSplitPreview({
  totalAmountCents,
  residents,
  onConfirm,
  isLoading = false,
}: BillSplitPreviewProps) {
  const [rule, setRule] = useState<SplitRule>("equal");
  const [percentages, setPercentages] = useState<Record<string, number>>(() =>
    Object.fromEntries(residents.map((r) => [r.residentId, 100 / residents.length]))
  );
  const [days, setDays] = useState<Record<string, number>>(() =>
    Object.fromEntries(residents.map((r) => [r.residentId, 30]))
  );
  const [totalDays, setTotalDays] = useState(30);
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  // Vista previa derivada: se recalcula durante el render, no en un effect.
  const { preview, previewError } = useMemo<{
    preview: ReturnType<typeof calculateBillSplit> | null;
    previewError: string;
  }>(() => {
    try {
      const inputs: ResidentSplitInput[] = residents.map((r) => ({
        residentId: r.residentId,
        residentName: r.displayName,
        percentage: percentages[r.residentId] ?? 0,
        daysOccupied: days[r.residentId] ?? 0,
        excluded: excluded[r.residentId] ?? false,
      }));
      return { preview: calculateBillSplit(totalAmountCents, rule, inputs, totalDays), previewError: "" };
    } catch (err) {
      if (err instanceof BillSplitError) {
        return { preview: null, previewError: err.message };
      }
      return { preview: null, previewError: "" };
    }
  }, [rule, percentages, days, totalDays, excluded, totalAmountCents, residents]);

  async function handleConfirm() {
    if (!preview) return;
    setConfirmError("");
    setConfirming(true);
    try {
      const inputs: ResidentSplitInput[] = residents.map((r) => ({
        residentId: r.residentId,
        residentName: r.displayName,
        percentage: percentages[r.residentId],
        daysOccupied: days[r.residentId],
        excluded: excluded[r.residentId] ?? false,
      }));
      await onConfirm(rule, inputs, rule === "days_occupied" ? totalDays : undefined);
    } catch (err) {
      setConfirmError((err as Error).message);
    } finally {
      setConfirming(false);
    }
  }

  const totalPct = residents
    .filter((r) => !excluded[r.residentId])
    .reduce((s, r) => s + (percentages[r.residentId] ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Selector de regla */}
      <div>
        <p className="text-sm font-medium text-gray-700">Regla de reparto</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(RULE_LABELS) as SplitRule[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRule(r)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors
                ${rule === r
                  ? "border-indigo-500 bg-indigo-50 font-medium text-indigo-700"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              {RULE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Total de días (solo para days_occupied) */}
      {rule === "days_occupied" && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Total de días del período
          </label>
          <input
            type="number"
            min={1}
            max={365}
            value={totalDays}
            onChange={(e) => setTotalDays(parseInt(e.target.value) || 30)}
            className="mt-1 w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm
                       focus:border-indigo-500 focus:outline-none"
          />
        </div>
      )}

      {/* Tabla de residentes */}
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-gray-600">Residente</th>
              {rule === "percentage" && (
                <th className="px-4 py-2.5 text-center font-medium text-gray-600">%</th>
              )}
              {rule === "days_occupied" && (
                <th className="px-4 py-2.5 text-center font-medium text-gray-600">Días</th>
              )}
              {rule === "exclude" && (
                <th className="px-4 py-2.5 text-center font-medium text-gray-600">Excluir</th>
              )}
              <th className="px-4 py-2.5 text-right font-medium text-gray-600">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {residents.map((r) => {
              const share = preview?.shares.find((s) => s.residentId === r.residentId);
              const isExcluded = excluded[r.residentId] ?? false;

              return (
                <tr key={r.residentId} className={isExcluded ? "opacity-40" : ""}>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {r.displayName}
                  </td>

                  {/* Campo porcentaje */}
                  {rule === "percentage" && (
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={percentages[r.residentId] ?? 0}
                        onChange={(e) =>
                          setPercentages((prev) => ({
                            ...prev,
                            [r.residentId]: parseFloat(e.target.value) || 0,
                          }))
                        }
                        disabled={isExcluded}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-center text-sm
                                   focus:border-indigo-500 focus:outline-none disabled:opacity-40"
                        aria-label={`Porcentaje para ${r.displayName}`}
                      />
                      <span className="ml-1 text-gray-400">%</span>
                    </td>
                  )}

                  {/* Campo días */}
                  {rule === "days_occupied" && (
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min={0}
                        max={totalDays}
                        value={days[r.residentId] ?? 0}
                        onChange={(e) =>
                          setDays((prev) => ({
                            ...prev,
                            [r.residentId]: parseInt(e.target.value) || 0,
                          }))
                        }
                        disabled={isExcluded}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-center text-sm
                                   focus:border-indigo-500 focus:outline-none disabled:opacity-40"
                        aria-label={`Días para ${r.displayName}`}
                      />
                    </td>
                  )}

                  {/* Checkbox excluir */}
                  {rule === "exclude" && (
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={excluded[r.residentId] ?? false}
                        onChange={(e) =>
                          setExcluded((prev) => ({
                            ...prev,
                            [r.residentId]: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                        aria-label={`Excluir a ${r.displayName}`}
                      />
                    </td>
                  )}

                  {/* Monto calculado */}
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">
                    {isExcluded ? (
                      <span className="text-gray-400">—</span>
                    ) : share ? (
                      <span className="text-indigo-700">{formatCents(share.amountCents)}</span>
                    ) : (
                      <span className="text-gray-300">…</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Pie de tabla: total */}
          <tfoot className="bg-gray-50">
            <tr>
              <td
                colSpan={rule === "equal" ? 1 : 2}
                className="px-4 py-3 font-semibold text-gray-700"
              >
                Total
              </td>
              <td className="px-4 py-3 text-right font-bold text-gray-900">
                {formatCents(totalAmountCents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Advertencia porcentajes */}
      {rule === "percentage" && Math.round(totalPct) !== 100 && (
        <p className="text-sm text-amber-600">
          ⚠ Los porcentajes suman {totalPct.toFixed(2)}% — deben sumar exactamente 100%
        </p>
      )}

      {/* Error de cálculo */}
      {previewError && (
        <p className="text-sm text-red-600" role="alert">⚠ {previewError}</p>
      )}

      {/* Error de confirmación */}
      {confirmError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {confirmError}
        </p>
      )}

      {/* Botón confirmar */}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!preview || confirming || isLoading}
        className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold
                   text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {confirming || isLoading
          ? "Confirmando reparto…"
          : preview
            ? `✓ Confirmar reparto de ${formatCents(totalAmountCents)}`
            : "Corrige los errores para continuar"}
      </button>
    </div>
  );
}
