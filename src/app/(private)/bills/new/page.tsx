"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ui/ProtectedRoute";
import BillForm from "@/components/bills/BillForm";
import { useAuth } from "@/lib/firebase/AuthContext";
import { createBill } from "@/lib/firebase/billsService";
import type { BillInput } from "@/lib/validation/schemas";

export default function NewBillPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [propertyId, setPropertyId] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPropertyId(params.get("propertyId") ?? "");
  }, []);

  async function handleSubmit(data: BillInput, attachmentFile?: File) {
    if (!user || !propertyId) return;
    setLoading(true);

    try {
      let attachmentPath: string | undefined;

      // Subir adjunto si existe
      if (attachmentFile) {
        const { getFirebaseStorage } = await import("@/lib/firebase/config");
        const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
        const storage = getFirebaseStorage();
        const storageRef = ref(
          storage,
          `bills/${propertyId}/${Date.now()}_${attachmentFile.name}`
        );
        await uploadBytes(storageRef, attachmentFile);
        attachmentPath = await getDownloadURL(storageRef);
      }

      const bill = await createBill(propertyId, user.uid, data, attachmentPath);
      setSuccess(true);

      // Redirigir al detalle tras un breve delay
      setTimeout(() => {
        router.push(`/bills/${bill.id}`);
      }, 1200);
    } finally {
      setLoading(false);
    }
  }

  if (!propertyId) {
    return (
      <ProtectedRoute>
        <main className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="rounded-xl bg-white p-8 shadow-sm text-center max-w-sm w-full">
            <p className="text-2xl">⚠️</p>
            <p className="mt-2 font-semibold text-gray-800">Propiedad no especificada</p>
            <p className="mt-1 text-sm text-gray-500">
              Accede a esta página desde el detalle de una propiedad.
            </p>
            <button
              onClick={() => router.push("/properties")}
              className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium
                         text-white hover:bg-indigo-700"
            >
              Ir a propiedades
            </button>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="mx-auto max-w-2xl px-4 py-4">
            <button
              onClick={() => router.back()}
              className="text-sm text-indigo-600 hover:underline"
            >
              ← Volver
            </button>
            <h1 className="text-xl font-bold text-gray-900">Nueva factura</h1>
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4 py-8">
          {success ? (
            <div className="rounded-2xl bg-white p-8 shadow-sm text-center space-y-3">
              <p className="text-4xl">✅</p>
              <p className="text-lg font-semibold text-gray-800">
                Factura registrada correctamente
              </p>
              <p className="text-sm text-gray-500">Redirigiendo al detalle…</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <BillForm
                propertyId={propertyId}
                onSubmit={handleSubmit}
                onCancel={() => router.back()}
                isLoading={loading}
              />
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
