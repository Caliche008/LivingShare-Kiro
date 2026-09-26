"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Ruta de redirección cuando no hay sesión (default: /login) */
  redirectTo?: string;
}

/**
 * Envuelve contenido que requiere autenticación.
 * Redirige a /login si el usuario no está autenticado.
 */
export default function ProtectedRoute({
  children,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(redirectTo);
    }
  }, [user, loading, router, redirectTo]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    // Mientras ocurre la redirección, no renderizar nada
    return null;
  }

  return <>{children}</>;
}
