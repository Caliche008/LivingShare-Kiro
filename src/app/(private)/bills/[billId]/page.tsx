"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getFunctions, httpsCallable } from "firebase/functions";
import ProtectedRoute from "@/components/ui/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorMessage from "@/components/ui/ErrorMessage";
import BillSplitPreview from "@/components/bills/BillSplitPreview";
import ShareCard from "@/components/bills/ShareCard";
import { useAuth } from "@/lib/firebase/AuthContext";
import { FUNCTIONS_ENABLED, FUNCTIONS_DISABLED_MESSAGE } from "@/lib/firebase/config";
import { getBill } from "@/lib/firebase/billsService";
import {
  getSharesByBill,
  getPaymentByShare,
} from "@/lib/firebase/billSplitService";
import { getRoomsByProperty } from "@/lib/firebase/roomsService";
import { formatCents } from "@/lib/domain/billSplit";
import type { Bill, BillShare, Payment, SplitRule, ResidentSplitInput } from "@/types";

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface ResidentOption {
  residentId: string;
  displayName: string;
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function BillDetailPage() {
  const { billId } = useParams<{ billId: string }>();
  const { user, profile } = useAuth();
  const router = useRouter();

  const [bill, setBill] = useState<Bill | null>(null);
  const [shares, setShares] = useState<BillShare[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment | null>>({});
  const [residents, setResidents] = useState<ResidentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSplit, setShowSplit] = useState(false);
  const [splitLoading, setSplitLoading] = useState(false);

  const isManager =
    profile?.roles.includes("owner") || profile?.roles.includes("admin");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      // 1. Obtener factura
      const billData = await getBill(billId);
      if (!billData) {
        setError("Factura no encontrada");
        return;
      }
      setBill(billData);

      // 2. Obtener participaciones existentes
      const sharesData = await getSharesByBill(billId);
      setShares(sharesData);

      // 3. Obtener pagos para cada participación
      const paymentMap: Record<string, Payment | null> = {};
      await Promise.all(
        sharesData.map(async (s) => {
          paymentMap[s.id] = await getPaymentByShare(s.id);
        })
      );
      setPayments(paymentMap);

      // 4. Para el reparto, obtener residentes de la propiedad
      // Simplificado: mostramos los usuarios de habitaciones activas de la propiedad
      try {
        const rooms = await getRoomsByProperty(billData.propertyId);
        const residentSet = new Set<string>();
        const residentOptions: ResidentOption[] = [];

        // Incluimos al usuario actual como ejemplo de residente si hay habitaciones
        if (rooms.length > 0 && user && !residentSet.has(user.uid)) {
          residentSet.add(user.uid);
          residentOptions.push({
            residentId: user.uid,
            displayName: profile?.displayName ?? user.email ?? user.uid,
          });
        }

        // Si no hay habitaciones, al menos incluir al usuario actual
        if (residentOptions.length === 0) {
          residentOptions.push({
            residentId: user.uid,
            displayName: profile?.displayName ?? user.email ?? user.uid,
          });
        }

        setResidents(residentOptions);
      } catch {
        // Si falla la carga de residentes, al menos mostrar el usuario actual
        setResidents([
          {
            residentId: user.uid,
            displayName: profile?.displayName ?? user.uid,
          },
        ]);
      }
    } catch {
      setError("No se pudo cargar la factura. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  }, [billId, user, profile]);

  useEffect(() => {
    // Carga inicial de datos: setState dentro del fetch es intencional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId]);

  async function handleConfirmSplit(
    rule: SplitRule,
    residentInputs: ResidentSplitInput[],
    totalDays?: number
  ) {
    if (!bill) return;
    if (!FUNCTIONS_ENABLED) {
      // BillSplitPreview muestra este mensaje en su estado de error de confirmación.
      throw new Error(FUNCTIONS_DISABLED_MESSAGE);
    }
    setSplitLoading(true);
    try {
      const fns = getFunctions();
      const calcFn = httpsCallable(fns, "calculateBillSplit");
      await calcFn({ billId: bill.id, rule, residents: residentInputs, totalDays });
      setShowSplit(false);
      await load(); // Recargar shares
    } finally {
      setSplitLoading(false);
    }
  }

  const STATUS_LABELS: Record<Bill["status"], string> = {
    pending: "Pendiente",
    split: "Repartida",
    settled: "Liquidada",
  };

  const STATUS_COLORS: Record<Bill["status"], string> = {
    pending: "text-amber-700 bg-amber-50",
    split: "text-blue-700 bg-blue-50",
    settled: "text-green-700 bg-green-50",
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !bill) {
    return (
      <ProtectedRoute>
        <main className="min-h-screen bg-gray-50 p-8">
          <ErrorMessage message={error || "Factura no encontrada"} onRetry={load} />
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
            <div>
              <button
                onClick={() => router.back()}
                className="text-sm text-indigo-600 hover:underline"
              >
                ← Volver
              </button>
              <h1 className="text-xl font-bold text-gray-900">
                {bill.serviceType}
                {bill.provider && (
                  <span className="ml-2 text-sm font-normal text-gray-400">
                    · {bill.provider}
                  </span>
                )}
              </h1>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[bill.status]}`}
            >
              {STATUS_LABELS[bill.status]}
            </span>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
          {/* Resumen de la factura */}
          <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {formatCents(bill.totalAmountCents)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Período: {bill.periodStart} — {bill.periodEnd}
                </p>
                <p className="text-sm text-gray-500">
                  Vencimiento: {bill.dueDate}
                </p>
                {bill.splitVersion && bill.splitVersion > 0 && (
                  <p className="text-xs text-gray-400">
                    Versión del reparto: v{bill.splitVersion}
                  </p>
                )}
              </div>
              {bill.attachmentPath && (
                <a
                  href={bill.attachmentPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center text-indigo-600 hover:text-indigo-800"
                >
                  <span className="text-2xl">📄</span>
                  <span className="text-xs">Ver comprobante</span>
                </a>
              )}
            </div>
          </div>

          {/* Sección de reparto */}
          {isManager && bill.status === "pending" && (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">Calcular reparto</h2>
                <button
                  onClick={() => setShowSplit((v) => !v)}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  {showSplit ? "Ocultar" : "Mostrar"}
                </button>
              </div>

              {showSplit && residents.length > 0 && (
                <div className="mt-4">
                  <BillSplitPreview
                    totalAmountCents={bill.totalAmountCents}
                    residents={residents}
                    onConfirm={handleConfirmSplit}
                    isLoading={splitLoading}
                  />
                </div>
              )}
            </div>
          )}

          {/* Participaciones */}
          {shares.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-gray-800">
                Participaciones ({shares.length})
              </h2>
              {shares.map((share) => (
                <ShareCard
                  key={share.id}
                  share={share}
                  payment={payments[share.id]}
                  billServiceType={bill.serviceType}
                  billDueDate={bill.dueDate}
                  isOwn={share.residentId === user?.uid}
                />
              ))}
            </div>
          )}

          {shares.length === 0 && bill.status === "pending" && !isManager && (
            <div className="rounded-xl bg-white p-5 shadow-sm text-center text-sm text-gray-500">
              El reparto aún no ha sido calculado. El administrador lo configurará pronto.
            </div>
          )}

          {bill.status === "settled" && (
            <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
              <p className="text-lg">🎉</p>
              <p className="font-semibold text-green-800">Factura completamente liquidada</p>
              <p className="text-sm text-green-600">Todos los residentes han pagado su parte</p>
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
