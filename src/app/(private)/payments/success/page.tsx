"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ui/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session_id");
    setSessionId(sid);

    // Dar tiempo al webhook de Stripe para procesar el evento (≈2s)
    const timer = setTimeout(() => setChecking(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ProtectedRoute>
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm text-center space-y-5">
          {checking ? (
            <>
              <LoadingSpinner size="lg" />
              <p className="text-gray-600">Confirmando tu pago…</p>
            </>
          ) : (
            <>
              <div className="text-5xl">✅</div>
              <h1 className="text-2xl font-bold text-gray-900">¡Pago completado!</h1>
              <p className="text-gray-500">
                Tu pago ha sido procesado correctamente. El estado de tu participación
                se actualizará en unos momentos.
              </p>

              {sessionId && (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-400 font-mono break-all">
                  Sesión: {sessionId}
                </p>
              )}

              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={() => router.push("/bills")}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold
                             text-white hover:bg-indigo-700"
                >
                  Ver mis facturas
                </button>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm
                             font-medium text-gray-700 hover:bg-gray-50"
                >
                  Ir al dashboard
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
