"use client";

import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { FUNCTIONS_ENABLED, FUNCTIONS_DISABLED_MESSAGE } from "@/lib/firebase/config";
import { formatCents } from "@/lib/domain/billSplit";
import type { BillShare, Payment, ShareStatus } from "@/types";

interface ShareCardProps {
  share: BillShare;
  payment?: Payment | null;
  billServiceType: string;
  billDueDate: string;
  /** Si el share pertenece al usuario actual (muestra botón de pago) */
  isOwn?: boolean;
}

const STATUS_CONFIG: Record<ShareStatus, { label: string; color: string; bg: string }> = {
  pending: {
    label: "Pendiente",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
  },
  paid: {
    label: "Pagado",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
  },
  overdue: {
    label: "Vencido",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
  },
};

const RULE_LABELS: Record<BillShare["rule"], string> = {
  equal: "Equitativo",
  percentage: "Porcentaje",
  days_occupied: "Días ocupados",
  exclude: "Excluido",
};

export default function ShareCard({
  share,
  payment,
  billServiceType,
  billDueDate,
  isOwn = false,
}: ShareCardProps) {
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const statusCfg = STATUS_CONFIG[share.status];

  async function handlePay() {
    setPayError("");
    if (!FUNCTIONS_ENABLED) {
      setPayError(FUNCTIONS_DISABLED_MESSAGE);
      return;
    }
    setPaying(true);

    try {
      const fns = getFunctions();
      const createSession = httpsCallable<
        {
          billId: string;
          shareId: string;
          successUrl: string;
          cancelUrl: string;
        },
        { sessionId: string; url: string | null; existing: boolean }
      >(fns, "createPaymentSession");

      const origin = window.location.origin;
      const result = await createSession({
        billId: share.billId,
        shareId: share.id,
        successUrl: `${origin}/payments/success`,
        cancelUrl: `${origin}/payments/cancel`,
      });

      if (result.data.url) {
        window.location.href = result.data.url;
      } else {
        // La Cloud Function siempre devuelve url en Stripe Checkout v3+.
        // Si por alguna razón no llega url, mostrar error en lugar de fallar silenciosamente.
        throw new Error("La sesión de pago no devolvió una URL de redirección.");
      }
    } catch (err) {
      setPayError((err as Error).message);
    } finally {
      setPaying(false);
    }
  }

  const isOverdue =
    share.status === "pending" && new Date(billDueDate) < new Date();

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${statusCfg.bg}`}>
      {/* Encabezado */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{billServiceType}</p>
          {share.residentName && (
            <p className="text-base font-semibold text-gray-800">{share.residentName}</p>
          )}
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusCfg.color} ${statusCfg.bg} border`}
        >
          {isOverdue && share.status === "pending" ? "Vencido" : statusCfg.label}
        </span>
      </div>

      {/* Monto */}
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900">
          {formatCents(share.amountCents)}
        </span>
        <span className="text-sm text-gray-400">
          ({(share.proportion * 100).toFixed(1)}%)
        </span>
      </div>

      {/* Detalles de regla */}
      <div className="text-xs text-gray-500 space-y-0.5">
        <p>Regla: <span className="font-medium text-gray-700">{RULE_LABELS[share.rule]}</span></p>
        {share.rule === "percentage" && share.percentageValue !== undefined && (
          <p>Porcentaje asignado: {share.percentageValue}%</p>
        )}
        {share.rule === "days_occupied" && share.daysOccupied !== undefined && (
          <p>Días ocupados: {share.daysOccupied} de {share.totalDays}</p>
        )}
        <p>Versión del reparto: v{share.splitVersion}</p>
        <p>Vencimiento: {billDueDate}</p>
        {share.paidAt && (
          <p>Pagado el: {new Date((share.paidAt as unknown as { seconds: number }).seconds * 1000).toLocaleDateString("es-MX")}</p>
        )}
      </div>

      {/* Estado del pago */}
      {payment && (
        <div className="rounded-lg bg-white/70 px-3 py-2 text-xs text-gray-600">
          <p>Pago: <span className="font-semibold">{payment.status}</span></p>
          <p>Referencia: {payment.providerPaymentId.slice(0, 20)}…</p>
        </div>
      )}

      {/* Botón de pago */}
      {isOwn && share.status === "pending" && (
        <div className="pt-1">
          {payError && (
            <p className="mb-2 text-xs text-red-600" role="alert">{payError}</p>
          )}
          <button
            type="button"
            onClick={handlePay}
            disabled={paying}
            className="w-full rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold
                       text-white hover:bg-indigo-700 disabled:opacity-60
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          >
            {paying ? "Redirigiendo a Stripe…" : `💳 Pagar ${formatCents(share.amountCents)}`}
          </button>
        </div>
      )}

      {share.status === "paid" && (
        <div className="flex items-center gap-2 text-sm font-medium text-green-700">
          <span>✓</span>
          <span>Pago confirmado</span>
        </div>
      )}
    </div>
  );
}
