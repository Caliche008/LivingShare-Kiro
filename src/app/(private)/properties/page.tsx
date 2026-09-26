"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ui/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import ErrorMessage from "@/components/ui/ErrorMessage";
import PropertyCard from "@/components/properties/PropertyCard";
import { useAuth } from "@/lib/firebase/AuthContext";
import { getPropertiesByOwner } from "@/lib/firebase/propertiesService";
import type { Property } from "@/types";

export default function PropertiesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const data = await getPropertiesByOwner(user.uid);
      setProperties(data);
    } catch {
      setError("No se pudieron cargar las propiedades. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <div>
              <a href="/dashboard" className="text-sm text-indigo-600 hover:underline">← Dashboard</a>
              <h1 className="text-xl font-bold text-gray-900">Mis propiedades</h1>
            </div>
            <button
              onClick={() => router.push("/properties/new")}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Nueva propiedad
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-8">
          {loading ? (
            <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
          ) : error ? (
            <ErrorMessage message={error} onRetry={load} />
          ) : properties.length === 0 ? (
            <EmptyState
              icon="🏠"
              title="Aún no tienes propiedades"
              description="Crea tu primera propiedad para empezar a publicar habitaciones."
              actionLabel="Crear primera propiedad"
              onAction={() => router.push("/properties/new")}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((p) => (
                <PropertyCard
                  key={p.id}
                  property={p}
                  onClick={() => router.push(`/properties/${p.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
