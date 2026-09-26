"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPropertiesByOwner } from "@/lib/firebase/propertiesService";
import { getPendingBillsForProperty } from "@/lib/firebase/billsService";
import { getPaymentsByUser } from "@/lib/firebase/billSplitService";
import { getRoomsByProperty } from "@/lib/firebase/roomsService";
import type { Bill, Payment, Property, Room } from "@/types";

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

interface DashboardData {
  pendingBills: Bill[];
  recentPayments: Payment[];
  properties: Property[];
  publishedRooms: Room[];
}

interface DashboardSummaryProps {
  userId: string;
  displayName?: string;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardSummary({
  userId,
  displayName,
}: DashboardSummaryProps) {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    loadDashboardData(userId).then(setData).catch((err) => {
      setError("No se pudo cargar el resumen. Intenta de nuevo.");
      console.error("DashboardSummary error:", err);
    }).finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const { pendingBills, recentPayments, properties, publishedRooms } = data!;

  return (
    <div className="space-y-8">
      {/* Saludo */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Bienvenido{displayName ? `, ${displayName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Aquí tienes un resumen de tu actividad reciente.
        </p>
      </div>

      {/* Grid de tarjetas de resumen */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon="📄"
          label="Facturas pendientes"
          value={pendingBills.length}
          href="/bills"
          colorClass="bg-amber-50 text-amber-700"
          emptyLabel="Al día"
        />
        <StatCard
          icon="🏢"
          label="Propiedades"
          value={properties.length}
          href="/properties"
          colorClass="bg-indigo-50 text-indigo-700"
          emptyLabel="Sin propiedades"
        />
        <StatCard
          icon="🛏️"
          label="Habitaciones publicadas"
          value={publishedRooms.length}
          href="/rooms"
          colorClass="bg-green-50 text-green-700"
          emptyLabel="Sin habitaciones"
        />
        <StatCard
          icon="✅"
          label="Pagos realizados"
          value={recentPayments.filter((p) => p.status === "paid").length}
          href="/bills"
          colorClass="bg-emerald-50 text-emerald-700"
          emptyLabel="Sin pagos"
        />
      </div>

      {/* Facturas pendientes */}
      <Section
        title="Facturas pendientes"
        href="/bills"
        linkLabel="Ver todas"
        empty={pendingBills.length === 0}
        emptyMessage="No tienes facturas pendientes."
      >
        <ul className="divide-y rounded-xl border bg-white" role="list">
          {pendingBills.slice(0, 4).map((bill) => (
            <BillRow key={bill.id} bill={bill} />
          ))}
        </ul>
      </Section>

      {/* Habitaciones publicadas */}
      {publishedRooms.length > 0 && (
        <Section
          title="Habitaciones publicadas"
          href="/rooms"
          linkLabel="Ver todas"
          empty={false}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {publishedRooms.slice(0, 3).map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </Section>
      )}

      {/* Pagos recientes */}
      {recentPayments.length > 0 && (
        <Section
          title="Pagos recientes"
          href="/bills"
          linkLabel="Ver historial"
          empty={false}
        >
          <ul className="divide-y rounded-xl border bg-white" role="list">
            {recentPayments.slice(0, 4).map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </ul>
        </Section>
      )}

      {/* Accesos rápidos cuando no hay datos */}
      {pendingBills.length === 0 &&
        recentPayments.length === 0 &&
        properties.length === 0 && <QuickActions />}
    </div>
  );
}

// ─── Carga de datos ───────────────────────────────────────────────────────────

async function loadDashboardData(userId: string): Promise<DashboardData> {
  // Cargamos en paralelo para minimizar latencia
  const [properties, recentPayments] = await Promise.all([
    getPropertiesByOwner(userId).catch(() => [] as Property[]),
    getPaymentsByUser(userId).catch(() => [] as Payment[]),
  ]);

  // Facturas y habitaciones dependen de las propiedades
  const [billArrays, roomArrays] = await Promise.all([
    Promise.all(
      properties.map((p) =>
        getPendingBillsForProperty(p.id).catch(() => [] as Bill[])
      )
    ),
    Promise.all(
      properties.map((p) =>
        getRoomsByProperty(p.id).catch(() => [] as Room[])
      )
    ),
  ]);

  const pendingBills   = billArrays.flat();
  const publishedRooms = roomArrays
    .flat()
    .filter((r) => r.status === "published");

  return {
    pendingBills:   pendingBills.slice(0, 10),
    recentPayments: recentPayments.slice(0, 10),
    properties,
    publishedRooms,
  };
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  href,
  colorClass,
  emptyLabel,
}: {
  icon: string;
  label: string;
  value: number;
  href: string;
  colorClass: string;
  emptyLabel: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm
                 hover:shadow-md transition-shadow focus-visible:outline-none
                 focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">
          {value === 0 ? emptyLabel : label}
        </p>
      </div>
    </Link>
  );
}

function Section({
  title,
  href,
  linkLabel,
  empty,
  emptyMessage,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  empty: boolean;
  emptyMessage?: string;
  children?: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`section-${title}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2
          id={`section-${title}`}
          className="text-base font-semibold text-gray-800"
        >
          {title}
        </h2>
        <Link
          href={href}
          className="text-sm text-indigo-600 hover:underline focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
        >
          {linkLabel} →
        </Link>
      </div>
      {empty ? (
        <p className="rounded-xl border border-dashed bg-white px-6 py-8 text-center
                      text-sm text-gray-500">
          {emptyMessage}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function BillRow({ bill }: { bill: Bill }) {
  const isOverdue = bill.dueDate && bill.dueDate < new Date().toISOString().slice(0, 10);
  const amount    = (bill.totalAmountCents / 100).toLocaleString("es-MX", {
    style:    "currency",
    currency: "MXN",
  });

  return (
    <li>
      <Link
        href={`/bills/${bill.id}`}
        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50
                   focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-inset focus-visible:ring-indigo-500"
      >
        <div>
          <p className="text-sm font-medium text-gray-800">{bill.serviceType}</p>
          <p className="text-xs text-gray-500">
            Vence: {bill.dueDate}
            {isOverdue && (
              <span className="ml-2 font-medium text-red-600">Vencida</span>
            )}
          </p>
        </div>
        <span className={`text-sm font-semibold ${isOverdue ? "text-red-600" : "text-gray-700"}`}>
          {amount}
        </span>
      </Link>
    </li>
  );
}

function RoomCard({ room }: { room: Room }) {
  const price = (room.priceCents / 100).toLocaleString("es-MX", {
    style:    "currency",
    currency: "MXN",
  });

  return (
    <Link
      href={`/properties/${room.propertyId}`}
      className="rounded-xl border bg-white p-4 hover:shadow-md transition-shadow
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <p className="text-sm font-medium text-gray-800 truncate">{room.title}</p>
      <p className="mt-1 text-xs text-gray-500">
        {price} / mes
      </p>
      <span className="mt-2 inline-flex items-center rounded-full bg-green-100
                       px-2 py-0.5 text-xs font-medium text-green-700">
        Publicada
      </span>
    </Link>
  );
}

function PaymentRow({ payment }: { payment: Payment }) {
  const amount = (payment.amountCents / 100).toLocaleString("es-MX", {
    style:    "currency",
    currency: payment.currency.toUpperCase() as "MXN",
  });

  const statusConfig: Record<Payment["status"], { label: string; className: string }> = {
    paid:       { label: "Pagado",     className: "bg-green-100 text-green-700" },
    pending:    { label: "Pendiente",  className: "bg-amber-100 text-amber-700" },
    processing: { label: "Procesando", className: "bg-blue-100 text-blue-700" },
    failed:     { label: "Fallido",    className: "bg-red-100 text-red-700" },
    refunded:   { label: "Reembolsado",className: "bg-gray-100 text-gray-700" },
    canceled:   { label: "Cancelado",  className: "bg-gray-100 text-gray-600" },
  };

  const { label, className } = statusConfig[payment.status] ?? statusConfig.pending;

  return (
    <li className="flex items-center justify-between px-4 py-3">
      <div>
        <p className="text-sm font-medium text-gray-800">{amount}</p>
        <p className="text-xs text-gray-500">{payment.currency.toUpperCase()}</p>
      </div>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
        {label}
      </span>
    </li>
  );
}

function QuickActions() {
  const actions = [
    { label: "Completar cuestionario", href: "/questionnaire", icon: "📋" },
    { label: "Ver compatibilidad",     href: "/matches",        icon: "🤝" },
    { label: "Agregar propiedad",       href: "/properties/new", icon: "🏢" },
    { label: "Registrar factura",       href: "/bills/new",      icon: "📄" },
  ];

  return (
    <section aria-labelledby="quick-actions-title">
      <h2
        id="quick-actions-title"
        className="mb-3 text-base font-semibold text-gray-800"
      >
        Acciones rápidas
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map(({ label, href, icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl border bg-white p-4
                       hover:shadow-md transition-shadow focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span className="text-2xl" aria-hidden="true">{icon}</span>
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-7 w-48 rounded-lg bg-gray-200" />
        <div className="mt-2 h-4 w-64 rounded bg-gray-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-200" />
        ))}
      </div>
      <div>
        <div className="mb-3 h-5 w-36 rounded bg-gray-200" />
        <div className="h-40 rounded-xl bg-gray-200" />
      </div>
    </div>
  );
}
