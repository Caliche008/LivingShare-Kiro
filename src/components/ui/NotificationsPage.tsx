"use client";

/**
 * NotificationsPage.tsx
 *
 * Componente completo de la página /notifications.
 *
 * Funcionalidades:
 *   - Lista paginada (cursor-based, botón "Cargar más")
 *   - Filtro por tipo de notificación
 *   - Filtro por estado (todas / no leídas / leídas)
 *   - Botón "Marcar todas como leídas"
 *   - Marcar notificación individual como leída al hacer clic
 *   - Estados: cargando (skeleton), vacío, error
 *   - Totalmente accesible: roles ARIA, navegación por teclado, focus visible
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getNotificationsPage,
  markAsRead,
  markAllAsRead,
  type NotificationsPageOptions,
} from "@/lib/firebase/notificationsService";
import type { Notification, NotificationType } from "@/types";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

const TYPE_ICON: Record<NotificationType, string> = {
  match_calculated:    "🤝",
  bill_split:          "📄",
  bill_due_soon:       "⚠️",
  payment_confirmed:   "✅",
  payment_failed:      "❌",
  room_status_changed: "🛏️",
  admin_request:       "🔔",
};

const TYPE_LABEL: Record<NotificationType, string> = {
  match_calculated:    "Compatibilidad",
  bill_split:          "Factura repartida",
  bill_due_soon:       "Vencimiento próximo",
  payment_confirmed:   "Pago confirmado",
  payment_failed:      "Pago fallido",
  room_status_changed: "Estado de habitación",
  admin_request:       "Solicitud admin",
};

const ALL_TYPES: NotificationType[] = [
  "match_calculated",
  "bill_split",
  "bill_due_soon",
  "payment_confirmed",
  "payment_failed",
  "room_status_changed",
  "admin_request",
];

// ─── Tipos de filtro ──────────────────────────────────────────────────────────

type ReadFilter = "all" | "unread" | "read";

// ─── Componente principal ─────────────────────────────────────────────────────

interface NotificationsPageProps {
  userId: string;
}

export default function NotificationsPage({ userId }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [hasMore, setHasMore]             = useState(false);
  const [markingAll, setMarkingAll]       = useState(false);
  const [lastDoc, setLastDoc]             = useState<QueryDocumentSnapshot<DocumentData> | undefined>(undefined);

  // Filtros
  const [filterType, setFilterType] = useState<NotificationType | undefined>(undefined);
  const [filterRead, setFilterRead] = useState<ReadFilter>("all");

  // Ref para el anuncio de accesibilidad
  const liveRef = useRef<HTMLDivElement>(null);

  // ── Resolución de filterRead → boolean | undefined ─────────────────────────
  const readBool: boolean | undefined =
    filterRead === "unread" ? false :
    filterRead === "read"   ? true  :
    undefined;

  // ── Carga inicial y cuando cambian filtros ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadFirst() {
      setLoading(true);
      setError(null);
      setNotifications([]);
      setLastDoc(undefined);
      setHasMore(false);

      try {
        const options: NotificationsPageOptions = {
          pageSize:   PAGE_SIZE,
          filterType,
          filterRead: readBool,
        };
        const result = await getNotificationsPage(userId, options);
        if (!cancelled) {
          setNotifications(result.notifications);
          setLastDoc(result.lastDoc);
          setHasMore(result.hasMore);
        }
      } catch (err) {
        if (!cancelled) {
          setError("No se pudieron cargar las notificaciones. Intenta de nuevo.");
          console.error("NotificationsPage load error:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFirst();
    return () => { cancelled = true; };
  }, [userId, filterType, readBool]);

  // ── Anuncios de accesibilidad ──────────────────────────────────────────────
  const announce = useCallback((msg: string) => {
    if (liveRef.current) {
      liveRef.current.textContent = "";
      // Pequeño delay para que el lector de pantalla detecte el cambio
      setTimeout(() => {
        if (liveRef.current) liveRef.current.textContent = msg;
      }, 50);
    }
  }, []);

  // ── Cargar más ─────────────────────────────────────────────────────────────
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    setLoadingMore(true);
    try {
      const options: NotificationsPageOptions = {
        pageSize:   PAGE_SIZE,
        filterType,
        filterRead: readBool,
        lastDoc,
      };
      const result = await getNotificationsPage(userId, options);
      setNotifications((prev) => [...prev, ...result.notifications]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (err) {
      setError("Error al cargar más notificaciones.");
      console.error("NotificationsPage loadMore error:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [userId, filterType, readBool, lastDoc, hasMore, loadingMore]);

  // ── Marcar individual como leída ───────────────────────────────────────────
  const handleMarkAsRead = useCallback(async (notif: Notification) => {
    if (notif.read) return;
    // Actualizar UI optimísticamente
    setNotifications((prev) =>
      prev.map((n) => n.id === notif.id ? { ...n, read: true } : n)
    );
    try {
      await markAsRead(notif.id);
    } catch {
      // Revertir en caso de error
      setNotifications((prev) =>
        prev.map((n) => n.id === notif.id ? { ...n, read: false } : n)
      );
    }
  }, []);

  // ── Marcar todas como leídas ───────────────────────────────────────────────
  const handleMarkAllAsRead = useCallback(async () => {
    if (markingAll) return;
    const unreadCount = notifications.filter((n) => !n.read).length;
    if (unreadCount === 0) return;

    setMarkingAll(true);
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      await markAllAsRead(userId);
      announce(`${unreadCount} notificación${unreadCount > 1 ? "es marcadas" : " marcada"} como leída${unreadCount > 1 ? "s" : ""}.`);
    } catch {
      // Revertir
      setNotifications((prev) => prev.map((n, i) =>
        notifications[i]?.read === false ? { ...n, read: false } : n
      ));
      setError("No se pudo marcar todo como leído. Intenta de nuevo.");
    } finally {
      setMarkingAll(false);
    }
  }, [userId, markingAll, notifications, announce]);

  // ── Cambio de filtros ──────────────────────────────────────────────────────
  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setFilterType(val === "" ? undefined : val as NotificationType);
  }

  function handleReadChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setFilterRead(e.target.value as ReadFilter);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasActiveFilters = filterType !== undefined || filterRead !== "all";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Región live para lectores de pantalla */}
      <div
        ref={liveRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notificaciones</h1>
          {!loading && (
            <p className="mt-0.5 text-sm text-gray-500">
              {unreadCount > 0
                ? `${unreadCount} sin leer`
                : "Todas al día"}
            </p>
          )}
        </div>

        {unreadCount > 0 && !loading && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={markingAll}
            className="self-start rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2
                       text-sm font-medium text-indigo-700 hover:bg-indigo-100
                       disabled:cursor-not-allowed disabled:opacity-50
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                       sm:self-auto"
          >
            {markingAll ? "Marcando…" : "Marcar todas como leídas"}
          </button>
        )}
      </div>

      {/* Barra de filtros */}
      <div
        className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm
                   sm:flex-row sm:items-center"
        role="group"
        aria-label="Filtros de notificaciones"
      >
        {/* Filtro por tipo */}
        <div className="flex flex-1 flex-col gap-1">
          <label
            htmlFor="filter-type"
            className="text-xs font-medium text-gray-600"
          >
            Tipo
          </label>
          <select
            id="filter-type"
            value={filterType ?? ""}
            onChange={handleTypeChange}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm
                       text-gray-700 focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-indigo-500"
          >
            <option value="">Todos los tipos</option>
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_ICON[t]} {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por estado de lectura */}
        <div className="flex flex-1 flex-col gap-1">
          <label
            htmlFor="filter-read"
            className="text-xs font-medium text-gray-600"
          >
            Estado
          </label>
          <select
            id="filter-read"
            value={filterRead}
            onChange={handleReadChange}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm
                       text-gray-700 focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-indigo-500"
          >
            <option value="all">Todas</option>
            <option value="unread">Sin leer</option>
            <option value="read">Leídas</option>
          </select>
        </div>

        {/* Limpiar filtros */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setFilterType(undefined);
              setFilterRead("all");
            }}
            className="self-end rounded-lg border border-gray-200 px-3 py-2 text-xs
                       text-gray-500 hover:bg-gray-50
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                       sm:mt-5"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Mensaje de error */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50
                     px-4 py-3 text-sm text-red-700"
        >
          <span aria-hidden="true" className="mt-0.5 text-base">❌</span>
          <div className="flex-1">
            <p className="font-medium">Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-red-500 rounded"
            aria-label="Cerrar mensaje de error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Estado: cargando */}
      {loading && <NotificationsSkeleton />}

      {/* Lista de notificaciones */}
      {!loading && (
        <>
          {notifications.length === 0 ? (
            <EmptyState
              hasFilters={hasActiveFilters}
              onClearFilters={() => {
                setFilterType(undefined);
                setFilterRead("all");
              }}
            />
          ) : (
            <section aria-label="Lista de notificaciones">
              <ul
                className="divide-y rounded-xl border bg-white shadow-sm"
                role="list"
              >
                {notifications.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onRead={() => handleMarkAsRead(n)}
                  />
                ))}
              </ul>

              {/* Botón "Cargar más" */}
              {hasMore && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="rounded-lg border border-gray-300 bg-white px-6 py-2.5
                               text-sm font-medium text-gray-600 hover:bg-gray-50
                               disabled:cursor-not-allowed disabled:opacity-50
                               focus-visible:outline-none focus-visible:ring-2
                               focus-visible:ring-indigo-500"
                    aria-busy={loadingMore}
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <LoadingSpinnerInline />
                        Cargando…
                      </span>
                    ) : (
                      "Cargar más"
                    )}
                  </button>
                </div>
              )}

              {/* Indicador de fin de lista */}
              {!hasMore && notifications.length >= PAGE_SIZE && (
                <p className="mt-4 text-center text-xs text-gray-400">
                  Has visto todas las notificaciones
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ─── Fila de notificación ─────────────────────────────────────────────────────

function NotificationRow({
  notification: n,
  onRead,
}: {
  notification: Notification;
  onRead: () => void;
}) {
  const icon = TYPE_ICON[n.type] ?? "🔔";

  const inner = (
    <div
      className={[
        "flex items-start gap-4 px-4 py-4 transition-colors",
        !n.read ? "bg-indigo-50" : "bg-white hover:bg-gray-50",
      ].join(" ")}
    >
      {/* Icono del tipo */}
      <span
        className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center
                   rounded-full bg-white text-xl shadow-sm ring-1 ring-gray-100"
        aria-hidden="true"
      >
        {icon}
      </span>

      {/* Contenido */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={`text-sm font-medium leading-tight ${
              !n.read ? "text-gray-900" : "text-gray-700"
            }`}
          >
            {n.title}
          </p>
          <span
            className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5
                       text-[10px] font-medium text-gray-500"
          >
            {TYPE_LABEL[n.type] ?? n.type}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{n.body}</p>
        <p className="mt-1.5 text-xs text-gray-400">
          {formatRelativeDate(n.createdAt)}
        </p>
      </div>

      {/* Indicador no leída */}
      {!n.read && (
        <span
          className="mt-2 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-indigo-500"
          aria-label="Sin leer"
        />
      )}
    </div>
  );

  if (n.actionUrl) {
    return (
      <li>
        <Link
          href={n.actionUrl}
          onClick={onRead}
          className="block focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-inset focus-visible:ring-indigo-500"
          aria-label={`${n.title}${!n.read ? " — sin leer" : ""}`}
        >
          {inner}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button
        onClick={onRead}
        disabled={n.read}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-inset focus-visible:ring-indigo-500
                   disabled:cursor-default"
        aria-label={`${n.title}${!n.read ? " — sin leer, clic para marcar como leída" : ""}`}
      >
        {inner}
      </button>
    </li>
  );
}

// ─── Estado vacío ─────────────────────────────────────────────────────────────

function EmptyState({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border
                 border-dashed bg-white px-6 py-16 text-center shadow-sm"
      role="status"
    >
      <span className="text-4xl" aria-hidden="true">
        {hasFilters ? "🔍" : "🔔"}
      </span>
      <p className="mt-4 text-base font-medium text-gray-700">
        {hasFilters
          ? "No hay notificaciones con esos filtros"
          : "No tienes notificaciones"}
      </p>
      <p className="mt-1 text-sm text-gray-500">
        {hasFilters
          ? "Prueba cambiando los filtros o limpiándolos."
          : "Aquí aparecerán tus alertas de pagos, compatibilidad y más."}
      </p>
      {hasFilters && (
        <button
          onClick={onClearFilters}
          className="mt-4 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2
                     text-sm font-medium text-indigo-700 hover:bg-indigo-100
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

// ─── Skeleton de carga ────────────────────────────────────────────────────────

function NotificationsSkeleton() {
  return (
    <div
      className="animate-pulse divide-y rounded-xl border bg-white shadow-sm"
      aria-busy="true"
      aria-label="Cargando notificaciones…"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 px-4 py-4">
          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <div className="h-4 w-40 rounded bg-gray-200" />
              <div className="h-4 w-20 rounded bg-gray-100" />
            </div>
            <div className="h-3 w-full rounded bg-gray-100" />
            <div className="h-3 w-3/4 rounded bg-gray-100" />
            <div className="h-3 w-24 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Spinner inline ───────────────────────────────────────────────────────────

function LoadingSpinnerInline() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2
                 border-gray-300 border-t-gray-600"
      aria-hidden="true"
    />
  );
}

// ─── Utilidad: fecha relativa ─────────────────────────────────────────────────

function formatRelativeDate(
  timestamp: Notification["createdAt"] | undefined
): string {
  if (!timestamp) return "";
  const date =
    typeof (timestamp as { toDate?: () => Date }).toDate === "function"
      ? (timestamp as { toDate: () => Date }).toDate()
      : new Date(timestamp as unknown as string);

  const diffMs    = Date.now() - date.getTime();
  const diffMins  = Math.floor(diffMs / 60_000);

  if (diffMins < 1)  return "ahora mismo";
  if (diffMins < 60) return `hace ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays  = Math.floor(diffHours / 24);
  if (diffDays < 7)  return `hace ${diffDays} día${diffDays > 1 ? "s" : ""}`;
  return date.toLocaleDateString("es-MX", {
    day:   "numeric",
    month: "short",
    year:  diffDays > 365 ? "numeric" : undefined,
  });
}
