"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/AuthContext";
import { logoutUser } from "@/lib/firebase/auth";
import NotificationBell from "@/components/ui/NotificationBell";
import Logo from "@/components/ui/Logo";

// ─── Definición de la navegación ─────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Dashboard",       href: "/dashboard",    icon: "🏠" },
  { label: "Cuestionario",    href: "/questionnaire", icon: "📋" },
  { label: "Compatibilidad",  href: "/matches",       icon: "🤝" },
  { label: "Propiedades",     href: "/properties",    icon: "🏢" },
  { label: "Habitaciones",    href: "/rooms",         icon: "🛏️" },
  { label: "Facturas",        href: "/bills",         icon: "📄" },
];

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirigir si no hay sesión
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Pantalla de carga inicial
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  // No renderizar nada mientras ocurre la redirección
  if (!user) return null;

  async function handleLogout() {
    await logoutUser();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* ── Overlay para cerrar sidebar en móvil ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-gray-900 shadow-md ring-1 ring-gray-800",
          "transition-transform duration-200 ease-in-out",
          "lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        aria-label="Navegación principal"
      >
        {/* Logo */}
        <div className="flex h-16 flex-shrink-0 items-center overflow-hidden border-b border-gray-800 px-4">
          <Link href="/dashboard" onClick={() => setSidebarOpen(false)} aria-label="Ir al dashboard" className="flex items-center gap-2">
            <Logo size={44} className="p-1" />
            <span className="text-base font-bold text-gray-100">LivingShare</span>
          </Link>
        </div>

        {/* Links de navegación */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1" role="list">
            {NAV_ITEMS.map(({ label, href, icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className={[
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                      "transition-colors focus-visible:outline-none focus-visible:ring-2",
                      "focus-visible:ring-indigo-500",
                      isActive
                        ? "bg-indigo-500/15 text-indigo-300"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white",
                    ].join(" ")}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span aria-hidden="true" className="text-lg">
                      {icon}
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Perfil + cierre de sesión */}
        <div className="border-t border-gray-800 p-4">
          <Link
            href="/profile"
            onClick={() => setSidebarOpen(false)}
            className="mb-3 flex items-center gap-3 rounded-lg px-2 py-1.5
                       hover:bg-gray-800 focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Ver perfil de usuario"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center
                            rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-300">
              {profile?.displayName?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-100">
                {profile?.displayName ?? "Usuario"}
              </p>
              <p className="truncate text-xs text-gray-400">
                {profile?.email ?? user.email ?? ""}
              </p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-gray-700 py-1.5 text-sm
                       text-gray-300 hover:bg-gray-800 hover:text-white
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Columna principal ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Navbar superior */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between
                           border-b border-gray-800 bg-gray-900 px-4 shadow-sm">
          {/* Botón hamburguesa (solo móvil) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-800
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                       lg:hidden"
            aria-label="Abrir menú de navegación"
          >
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
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>

          {/* Título de la página activa */}
          <span className="hidden text-sm font-medium text-gray-300 lg:block">
            {NAV_ITEMS.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"))
              ?.label ?? "LivingShare"}
          </span>

          {/* Campanita de notificaciones */}
          <div className="ml-auto">
            {user && <NotificationBell userId={user.uid} />}
          </div>
        </header>

        {/* Contenido de la página */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
