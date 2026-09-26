"use client";

/**
 * Providers.tsx
 * Componente de cliente que inicializa todos los providers de la aplicación.
 * Al ser "use client", Next.js no lo ejecutará en el servidor durante el
 * prerendering estático, evitando errores de Firebase con variables de entorno
 * no disponibles en tiempo de build.
 */

import { AuthProvider } from "@/lib/firebase/AuthContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
