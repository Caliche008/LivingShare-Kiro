"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ui/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorMessage from "@/components/ui/ErrorMessage";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import RoomCard from "@/components/rooms/RoomCard";
import { getProperty } from "@/lib/firebase/propertiesService";
import { getRoomsByProperty } from "@/lib/firebase/roomsService";
import type { Property, Room } from "@/types";

export default function PropertyDetailPage() {
  const params = useParams<{ propertyId: string }>();
  const router = useRouter();
  const propertyId = params.propertyId;

  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [prop, rms] = await Promise.all([
        getProperty(propertyId),
        getRoomsByProperty(propertyId),
      ]);
      if (!prop) { setError("Propiedad no encontrada."); return; }
      setProperty(prop);
      setRooms(rms);
    } catch {
      setError("No se pudo cargar la propiedad.");
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  // Carga inicial de datos: setState dentro del fetch es intencional.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <div>
              <Link href="/properties" className="text-sm text-indigo-600 hover:underline">← Propiedades</Link>
              <h1 className="text-xl font-bold text-gray-900">
                {property?.name ?? "Propiedad"}
              </h1>
            </div>
            {property && (
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/properties/${propertyId}/edit`)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Editar
                </button>
                <button
                  onClick={() => router.push(`/bills?propertyId=${propertyId}`)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  Facturas
                </button>
                <button
                  onClick={() => router.push(`/properties/${propertyId}/rooms/new`)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  + Habitación
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
          {loading ? (
            <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
          ) : error ? (
            <ErrorMessage message={error} onRetry={load} />
          ) : property ? (
            <>
              {/* Info de la propiedad */}
              <div className="rounded-2xl bg-white p-6 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Badge status={property.status} />
                  <span className="text-sm text-gray-500">{property.totalRooms} habitaciones</span>
                </div>
                <p className="text-gray-600">📍 {property.address}</p>
                {property.description && (
                  <p className="text-sm text-gray-700">{property.description}</p>
                )}
                {property.commonAreas.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {property.commonAreas.map((area) => (
                      <span key={area} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {area}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Habitaciones */}
              <div>
                <h2 className="mb-4 text-lg font-semibold text-gray-800">Habitaciones</h2>
                {rooms.length === 0 ? (
                  <EmptyState
                    icon="🛏️"
                    title="Sin habitaciones aún"
                    description="Agrega la primera habitación a esta propiedad."
                    actionLabel="Agregar habitación"
                    onAction={() => router.push(`/properties/${propertyId}/rooms/new`)}
                  />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {rooms.map((room) => (
                      <RoomCard
                        key={room.id}
                        room={room}
                        onClick={() => router.push(`/properties/${propertyId}/rooms/${room.id}/edit`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </main>
    </ProtectedRoute>
  );
}
