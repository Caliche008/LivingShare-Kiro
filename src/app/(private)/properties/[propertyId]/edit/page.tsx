"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ui/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorMessage from "@/components/ui/ErrorMessage";
import PropertyForm from "@/components/properties/PropertyForm";
import { useAuth } from "@/lib/firebase/AuthContext";
import { getProperty, updateProperty, archiveProperty } from "@/lib/firebase/propertiesService";
import type { Property } from "@/types";
import type { PropertyInput } from "@/lib/validation/schemas";

export default function EditPropertyPage() {
  const params = useParams<{ propertyId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const propertyId = params.propertyId;

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const prop = await getProperty(propertyId);
      if (!prop) { setError("Propiedad no encontrada."); return; }
      setProperty(prop);
    } catch {
      setError("No se pudo cargar la propiedad.");
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  // Carga inicial de datos: setState dentro del fetch es intencional.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function handleSubmit(data: PropertyInput) {
    if (!user) return;
    await updateProperty(propertyId, user.uid, data);
    router.push(`/properties/${propertyId}`);
  }

  async function handleArchive() {
    if (!user) return;
    await archiveProperty(propertyId, user.uid);
    router.push("/properties");
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm">
          <div className="mx-auto max-w-2xl px-4 py-4">
            <a href={`/properties/${propertyId}`} className="text-sm text-indigo-600 hover:underline">← Propiedad</a>
            <h1 className="text-xl font-bold text-gray-900">Editar propiedad</h1>
          </div>
        </div>
        <div className="mx-auto max-w-2xl px-4 py-8">
          {loading ? (
            <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
          ) : error ? (
            <ErrorMessage message={error} onRetry={load} />
          ) : property ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <PropertyForm
                initial={property}
                onSubmit={handleSubmit}
                onArchive={handleArchive}
                submitLabel="Guardar cambios"
              />
            </div>
          ) : null}
        </div>
      </main>
    </ProtectedRoute>
  );
}
