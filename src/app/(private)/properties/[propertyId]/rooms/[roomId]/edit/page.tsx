"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ui/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Badge from "@/components/ui/Badge";
import RoomForm from "@/components/rooms/RoomForm";
import { useAuth } from "@/lib/firebase/AuthContext";
import { getRoom, updateRoomStatus } from "@/lib/firebase/roomsService";
import { ROOM_STATUS_TRANSITIONS } from "@/types";
import type { Room, RoomStatus } from "@/types";

const STATUS_LABELS: Record<RoomStatus, string> = {
  draft:     "Borrador",
  published: "Publicada",
  paused:    "Pausada",
  reserved:  "Reservada",
  withdrawn: "Retirada",
};

const TRANSITION_LABELS: Record<RoomStatus, string> = {
  published: "Publicar",
  paused:    "Pausar",
  reserved:  "Marcar como reservada",
  withdrawn: "Retirar",
  draft:     "Volver a borrador",
};

export default function EditRoomPage() {
  const params = useParams<{ propertyId: string; roomId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { propertyId, roomId } = params;

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await getRoom(propertyId, roomId);
      if (!r) { setError("Habitación no encontrada."); return; }
      setRoom(r);
    } catch {
      setError("No se pudo cargar la habitación.");
    } finally {
      setLoading(false);
    }
  }, [propertyId, roomId]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(newStatus: RoomStatus) {
    if (!user || !room) return;
    const label = STATUS_LABELS[newStatus];
    if (!window.confirm(`¿${TRANSITION_LABELS[newStatus]} esta habitación?`)) return;

    setStatusUpdating(true);
    try {
      await updateRoomStatus(propertyId, roomId, user.uid, newStatus);
      setRoom((prev) => prev ? { ...prev, status: newStatus } : prev);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setStatusUpdating(false);
      void label; // suppress unused warning
    }
  }

  const allowedTransitions = room ? ROOM_STATUS_TRANSITIONS[room.status] : [];

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm">
          <div className="mx-auto max-w-2xl px-4 py-4">
            <a href={`/properties/${propertyId}`} className="text-sm text-indigo-600 hover:underline">← Propiedad</a>
            <h1 className="text-xl font-bold text-gray-900">Editar habitación</h1>
          </div>
        </div>
        <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
          {loading ? (
            <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
          ) : error ? (
            <ErrorMessage message={error} onRetry={load} />
          ) : room ? (
            <>
              {/* Gestión de estado */}
              {allowedTransitions.length > 0 && (
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold text-gray-700">Estado de la publicación</h2>
                  <div className="flex items-center gap-3">
                    <Badge status={room.status} />
                    <span className="text-xs text-gray-400">→</span>
                    <div className="flex gap-2">
                      {allowedTransitions.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(s)}
                          disabled={statusUpdating}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium
                                     hover:bg-gray-50 disabled:opacity-60"
                        >
                          {TRANSITION_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Formulario de edición */}
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <RoomForm
                  propertyId={propertyId}
                  room={room}
                  onSuccess={() => router.push(`/properties/${propertyId}`)}
                  onCancel={() => router.push(`/properties/${propertyId}`)}
                />
              </div>
            </>
          ) : null}
        </div>
      </main>
    </ProtectedRoute>
  );
}
