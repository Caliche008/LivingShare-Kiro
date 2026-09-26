"use client";

export const dynamic = "force-dynamic";

import { useParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ui/ProtectedRoute";
import RoomForm from "@/components/rooms/RoomForm";
import type { Room } from "@/types";

export default function NewRoomPage() {
  const params = useParams<{ propertyId: string }>();
  const router = useRouter();

  function handleSuccess(_room: Room) {
    router.push(`/properties/${params.propertyId}`);
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm">
          <div className="mx-auto max-w-2xl px-4 py-4">
            <a href={`/properties/${params.propertyId}`} className="text-sm text-indigo-600 hover:underline">← Propiedad</a>
            <h1 className="text-xl font-bold text-gray-900">Nueva habitación</h1>
          </div>
        </div>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <RoomForm
              propertyId={params.propertyId}
              onSuccess={handleSuccess}
              onCancel={() => router.push(`/properties/${params.propertyId}`)}
            />
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
