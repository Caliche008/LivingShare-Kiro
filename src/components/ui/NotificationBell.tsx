"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  subscribeToNotifications,
  markAsRead,
  markAllAsRead,
} from "@/lib/firebase/notificationsService";
import type { Notification } from "@/types";

// ─── Íconos por tipo ──────────────────────────────────────────────────────────

const TYPE_ICON: Record<Notification["type"], string> = {
  match_calculated:    "🤝",
  bill_split:          "📄",
  bill_due_soon:       "⚠️",
  payment_confirmed:   "✅",
  payment_failed:      "❌",
  room_status_changed: "🛏️",
  admin_request:       "🔔",
};

// ─── Componente ───────────────────────────────────────────────────────────────

interface NotificationBellProps {
  userId: string;
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Suscripción en tiempo real
  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToNotifications(userId, setNotifications);
    return unsub;
  }, [userId]);

  // Cerrar el panel al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleOpen() {
    setOpen((prev) => !prev);
  }

  async function handleMarkAsRead(notification: Notification) {
    if (notification.read) return;
    await markAsRead(notification.id);
  }

  async function handleMarkAllAsRead() {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await markAllAsRead(userId);
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="relative">
      {/* Botón campanita */}
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {/* Icono */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0
               0 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 0-2.312
               6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0
               1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>

        {/* Badge de no leídas */}
        {unreadCount > 0 && (
          <span
            className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center
                       rounded-full bg-red-500 text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel desplegable */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Panel de notificaciones"
          className="absolute right-0 top-12 z-50 w-80 rounded-xl border bg-white shadow-lg
                     sm:w-96"
        >
          {/* Cabecera */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">
              Notificaciones
              {unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5
                                 text-xs font-medium text-indigo-700">
                  {unreadCount} nueva{unreadCount > 1 ? "s" : ""}
                </span>
              )}
            </h2>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={markingAll}
                className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
              >
                {markingAll ? "Marcando…" : "Marcar todas"}
              </button>
            )}
          </div>

          {/* Lista */}
          <ul
            className="max-h-96 overflow-y-auto divide-y"
            role="list"
            aria-label="Lista de notificaciones"
          >
            {notifications.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-500">
                No tienes notificaciones
              </li>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={() => handleMarkAsRead(n)}
                  onClose={() => setOpen(false)}
                />
              ))
            )}
          </ul>

          {/* Pie */}
          {notifications.length > 0 && (
            <div className="border-t px-4 py-2 text-center">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="text-xs text-indigo-600 hover:underline"
              >
                Ver todas las notificaciones
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Item individual ──────────────────────────────────────────────────────────

function NotificationItem({
  notification: n,
  onRead,
  onClose,
}: {
  notification: Notification;
  onRead: () => void;
  onClose: () => void;
}) {
  const icon = TYPE_ICON[n.type] ?? "🔔";

  const inner = (
    <div
      className={[
        "flex items-start gap-3 px-4 py-3",
        !n.read ? "bg-indigo-50" : "hover:bg-gray-50",
      ].join(" ")}
    >
      <span className="mt-0.5 text-xl" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${!n.read ? "text-gray-900" : "text-gray-700"}`}>
          {n.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{n.body}</p>
        <p className="mt-1 text-[10px] text-gray-400">
          {formatRelativeDate(n.createdAt)}
        </p>
      </div>
      {!n.read && (
        <span
          className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500"
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
          onClick={() => { onRead(); onClose(); }}
          className="block focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-inset focus-visible:ring-indigo-500"
          aria-label={`${n.title}${!n.read ? " (sin leer)" : ""}`}
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
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-inset focus-visible:ring-indigo-500"
        aria-label={`${n.title}${!n.read ? " (sin leer)" : ""}`}
      >
        {inner}
      </button>
    </li>
  );
}

// ─── Utilidad: fecha relativa ─────────────────────────────────────────────────

function formatRelativeDate(
  timestamp: Notification["createdAt"] | undefined
): string {
  if (!timestamp) return "";
  // Firebase Timestamp tiene .toDate()
  const date =
    typeof (timestamp as { toDate?: () => Date }).toDate === "function"
      ? (timestamp as { toDate: () => Date }).toDate()
      : new Date(timestamp as unknown as string);

  const diffMs   = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1)  return "ahora mismo";
  if (diffMins < 60) return `hace ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7)  return `hace ${diffDays} día${diffDays > 1 ? "s" : ""}`;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}
