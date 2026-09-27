"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ui/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useAuth } from "@/lib/firebase/AuthContext";
import { getBillsByProperty } from "@/lib/firebase/billsService";
import { formatCents } from "@/lib/domain/billSplit";
import type { Bill, BillStatus } from "@/types";

// ─── Config de estado ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<BillStatus, string> = {
  pending: "Pendiente",
  split: "Repartida",
  settled: "Liquidada",
};

const STATUS_STYLES: Record<BillStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  split: "bg-blue-100 text-blue-700",
  settled: "bg-green-100 text-green-700",
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function BillsPage() {
  const { profile } = useAuth();
  const router = useRouter();

  // Para simplificar, usamos la primera propiedad del usuario si es owner/admin.
  // En una versión más completa, habría un selector de propiedad.
  const [propertyId, setPropertyId] = useState<string>("");
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<BillStatus | "all">("all");

  const load = useCallback(async (pid: string) => {
    if (!pid) return;
    setLoading(true);
    setError("");
    try {
      const data = await getBillsByProperty(pid);
      setBills(data);
    } catch {
      setError("No se pudieron cargar las facturas. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Obtener propertyId desde la URL si está disponible
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("propertyId") ?? "";
    // Lectura de query param al montar: setState intencional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPropertyId(pid);
    if (pid) {
      load(pid);
    } else {
      setLoading(false);
    }
  }, [load]);

  const filtered = filter === "all" ? bills : bills.filter((b) => b.status === filter);

  const isManager =
    profile?.roles.includes("owner") || profile?.roles.includes("admin");

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <div>
              <a href="/dashboard" className="text-sm text-indigo-600 hover:underline">
                ← Dashboard
              </a>
              <h1 className="text-xl font-bold text-gray-900">Facturas</h1>
            </div>
            {isManager && propertyId && (
              <button
                onClick={() => router.push(`/bills/new?propertyId=${propertyId}`)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                           hover:bg-indigo-700"
              >
                + Nueva factura
              </button>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-8 space-y-5">
          {/* Sin propertyId */}
          {!propertyId && !loading && (
            <EmptyState
              icon="📄"
              title="Selecciona una propiedad"
              description="Accede a las facturas desde el detalle de una propiedad."
              actionLabel="Ir a propiedades"
              onAction={() => router.push("/properties")}
            />
          )}

          {propertyId && (
            <>
              {/* Filtros de estado */}
              <div className="flex flex-wrap gap-2">
                {(["all", "pending", "split", "settled"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-colors
                      ${filter === s
                        ? "bg-indigo-600 text-white"
                        : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"}`}
                  >
                    {s === "all" ? "Todas" : STATUS_LABELS[s]}
                    {s !== "all" && (
                      <span className="ml-1 text-xs opacity-70">
                        ({bills.filter((b) => b.status === s).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex justify-center py-20">
                  <LoadingSpinner size="lg" />
                </div>
              ) : error ? (
                <ErrorMessage message={error} onRetry={() => load(propertyId)} />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon="📄"
                  title={
                    filter === "all"
                      ? "No hay facturas registradas"
                      : `No hay facturas ${STATUS_LABELS[filter as BillStatus].toLowerCase()}`
                  }
                  description={
                    filter === "all" && isManager
                      ? "Registra la primera factura de la propiedad."
                      : undefined
                  }
                  actionLabel={filter === "all" && isManager ? "Nueva factura" : undefined}
                  onAction={
                    filter === "all" && isManager
                      ? () => router.push(`/bills/new?propertyId=${propertyId}`)
                      : undefined
                  }
                />
              ) : (
                <div className="space-y-3">
                  {filtered.map((bill) => (
                    <BillRow
                      key={bill.id}
                      bill={bill}
                      onClick={() => router.push(`/bills/${bill.id}`)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}

// ─── BillRow ──────────────────────────────────────────────────────────────────

function BillRow({ bill, onClick }: { bill: Bill; onClick: () => void }) {
  const isOverdue =
    bill.status === "pending" && new Date(bill.dueDate) < new Date();

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl bg-white p-4 shadow-sm hover:shadow-md
                 transition-shadow text-left border border-gray-100"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-800 truncate">{bill.serviceType}</p>
            {bill.provider && (
              <span className="text-xs text-gray-400">· {bill.provider}</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {bill.periodStart} — {bill.periodEnd}
          </p>
          <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
            Vence: {bill.dueDate} {isOverdue ? "⚠ Vencida" : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-lg font-bold text-gray-900">
            {formatCents(bill.totalAmountCents)}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[bill.status]}`}
          >
            {STATUS_LABELS[bill.status]}
          </span>
        </div>
      </div>
    </button>
  );
}
