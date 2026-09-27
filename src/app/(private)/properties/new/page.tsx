"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ui/ProtectedRoute";
import PropertyForm from "@/components/properties/PropertyForm";
import { useAuth } from "@/lib/firebase/AuthContext";
import { createProperty } from "@/lib/firebase/propertiesService";
import type { PropertyInput } from "@/lib/validation/schemas";

export default function NewPropertyPage() {
  const { user } = useAuth();
  const router = useRouter();

  async function handleSubmit(data: PropertyInput) {
    if (!user) return;
    const property = await createProperty(user.uid, data);
    router.push(`/properties/${property.id}`);
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm">
          <div className="mx-auto max-w-2xl px-4 py-4">
            <Link href="/properties" className="text-sm text-indigo-600 hover:underline">← Propiedades</Link>
            <h1 className="text-xl font-bold text-gray-900">Nueva propiedad</h1>
          </div>
        </div>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <PropertyForm onSubmit={handleSubmit} submitLabel="Crear propiedad" />
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
