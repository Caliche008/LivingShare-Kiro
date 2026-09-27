"use client";

import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ui/ProtectedRoute";

export default function PaymentCancelPage() {
  const router = useRouter();

  return (
    <ProtectedRoute>
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm text-center space-y-5">
          <div className="text-5xl">❌</div>
          <h1 className="text-2xl font-bold text-gray-900">Pago cancelado</h1>
          <p className="text-gray-500">
            Cancelaste el proceso de pago. Tu participación sigue pendiente y
            puedes intentarlo de nuevo cuando quieras.
          </p>

          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            No se realizó ningún cargo. Tu participación no ha cambiado.
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={() => router.back()}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold
                         text-white hover:bg-indigo-700"
            >
              Volver e intentar de nuevo
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm
                         font-medium text-gray-700 hover:bg-gray-50"
            >
              Ir al dashboard
            </button>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
