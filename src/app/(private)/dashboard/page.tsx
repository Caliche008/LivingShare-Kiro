"use client";

export const dynamic = "force-dynamic";

import { useAuth } from "@/lib/firebase/AuthContext";
import DashboardSummary from "@/components/ui/DashboardSummary";

/**
 * Página del dashboard.
 *
 * El layout, la navbar, el sidebar y la campanita de notificaciones los
 * provee src/app/(private)/layout.tsx. Esta página solo renderiza el
 * contenido específico del dashboard.
 */
export default function DashboardPage() {
  const { user, profile } = useAuth();

  // El layout ya maneja la carga y redirección de sesión.
  // Si llegamos aquí, user siempre está presente.
  if (!user) return null;

  return (
    <DashboardSummary
      userId={user.uid}
      displayName={profile?.displayName}
    />
  );
}
