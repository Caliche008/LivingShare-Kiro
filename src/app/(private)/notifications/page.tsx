"use client";

export const dynamic = "force-dynamic";

import { useAuth } from "@/lib/firebase/AuthContext";
import NotificationsPage from "@/components/ui/NotificationsPage";

/**
 * Página /notifications.
 *
 * El layout, navbar, sidebar y campanita los provee
 * src/app/(private)/layout.tsx. Esta página solo renderiza
 * el contenido de la lista de notificaciones.
 */
export default function NotificationsRoute() {
  const { user } = useAuth();

  // El layout ya maneja la carga y redirección.
  // Si llegamos aquí, user siempre está presente.
  if (!user) return null;

  return <NotificationsPage userId={user.uid} />;
}
