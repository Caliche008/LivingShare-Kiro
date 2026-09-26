"use client";

export const dynamic = "force-dynamic";

import { useAuth } from "@/lib/firebase/AuthContext";
import ProfilePage from "@/components/ui/ProfilePage";

/**
 * Página /profile.
 *
 * El layout, navbar, sidebar y campanita los provee
 * src/app/(private)/layout.tsx. Esta página solo renderiza
 * el contenido de perfil del usuario.
 */
export default function ProfileRoute() {
  const { user } = useAuth();

  // El layout ya maneja la carga y redirección.
  if (!user) return null;

  return <ProfilePage userId={user.uid} />;
}
