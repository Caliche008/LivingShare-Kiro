"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ui/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import ErrorMessage from "@/components/ui/ErrorMessage";
import RoomCard from "@/components/rooms/RoomCard";
import { getPublishedRooms, type RoomFilters } from "@/lib/firebase/roomsService";
import type { Room } from "@/types";

export default function RoomsSearchPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filtros
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const filters: RoomFilters = {};
      if (minPrice) filters.minPriceCents = parseFloat(minPrice) * 100;
      if (maxPrice) filters.maxPriceCents = parseFloat(maxPrice) * 100;
      if (availableFrom) filters.availableFrom = availableFrom;
      const data = await getPublishedRooms(filters);
      setRooms(data);
    } catch {
      setError("No se pudieron cargar las habitaciones.");
    } finally {
      setLoading(false);
    }
  }, [minPrice, maxPrice, availableFrom]);

  useEffect(() => { load(); }, [load]);

  function clearFilters() {
    setMinPrice("");
    setMaxPrice("");
    setAvailableFrom("");
  }

  const hasFilters = minPrice || maxPrice || availableFrom;

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <a href="/dashboard" className="text-sm text-indigo-600 hover:underline">← Dashboard</a>
            <h1 className="text-xl font-bold text-gray-900">Habitaciones disponibles</h1>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-8 lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
          {/* Sidebar de filtros */}
          <aside className="mb-6 lg:mb-0">
            <div className="sticky top-4 rounded-2xl bg-white p-5 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-700">Filtros</h2>

              <div>
                <label htmlFor="min-price" className="block text-sm text-gray-600">
                  Precio mínimo (MXN)
                </label>
                <input
                  id="min-price" type="number" min={0} value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                             focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="max-price" className="block text-sm text-gray-600">
                  Precio máximo (MXN)
                </label>
                <input
                  id="max-price" type="number" min={0} value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Sin límite"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                             focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="avail-date" className="block text-sm text-gray-600">
                  Disponible desde
                </label>
                <input
                  id="avail-date" type="date" value={availableFrom}
                  onChange={(e) => setAvailableFrom(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                             focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </aside>

          {/* Resultados */}
          <section>
            {loading ? (
              <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
            ) : error ? (
              <ErrorMessage message={error} onRetry={load} />
            ) : rooms.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="No hay habitaciones disponibles"
                description={
                  hasFilters
                    ? "Prueba ajustando los filtros de búsqueda."
                    : "Aún no hay habitaciones publicadas."
                }
                actionLabel={hasFilters ? "Limpiar filtros" : undefined}
                onAction={hasFilters ? clearFilters : undefined}
              />
            ) : (
              <>
                <p className="mb-4 text-sm text-gray-500">{rooms.length} habitación{rooms.length !== 1 ? "es" : ""} encontrada{rooms.length !== 1 ? "s" : ""}</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {rooms.map((room) => (
                    <RoomCard key={room.id} room={room} />
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}
