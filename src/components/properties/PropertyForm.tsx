"use client";

import { useState } from "react";
import TagsInput from "@/components/ui/TagsInput";
import { propertySchema, type PropertyInput } from "@/lib/validation/schemas";
import type { Property } from "@/types";

interface PropertyFormProps {
  initial?: Partial<Property>;
  onSubmit: (data: PropertyInput) => Promise<void>;
  onArchive?: () => Promise<void>;
  submitLabel?: string;
}

type FormState = {
  name: string;
  address: string;
  description: string;
  totalRooms: string;
  commonAreas: string[];
};

type FormErrors = Partial<Record<keyof PropertyInput, string>>;

export default function PropertyForm({
  initial,
  onSubmit,
  onArchive,
  submitLabel = "Guardar propiedad",
}: PropertyFormProps) {
  const [form, setForm] = useState<FormState>({
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    description: initial?.description ?? "",
    totalRooms: String(initial?.totalRooms ?? ""),
    commonAreas: initial?.commonAreas ?? [],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);

  function setField(key: keyof FormState, value: string | string[]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setServerError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = propertySchema.safeParse({
      name: form.name,
      address: form.address,
      description: form.description || undefined,
      totalRooms: Number(form.totalRooms),
      commonAreas: form.commonAreas,
    });

    if (!parsed.success) {
      const fe: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof PropertyInput;
        if (!fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }

    setLoading(true);
    try {
      await onSubmit(parsed.data);
    } catch {
      setServerError("Error al guardar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive() {
    if (!onArchive) return;
    if (!window.confirm("¿Archivar esta propiedad? No aparecerá en nuevas búsquedas.")) return;
    setArchiving(true);
    try {
      await onArchive();
    } catch {
      setServerError("Error al archivar. Intenta de nuevo.");
    } finally {
      setArchiving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Nombre */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Nombre <span className="text-red-500">*</span>
        </label>
        <input
          id="name" type="text" value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          aria-invalid={!!errors.name}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm
                     focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
                     aria-[invalid=true]:border-red-400"
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
      </div>

      {/* Dirección */}
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700">
          Dirección <span className="text-red-500">*</span>
        </label>
        <input
          id="address" type="text" value={form.address}
          onChange={(e) => setField("address", e.target.value)}
          aria-invalid={!!errors.address}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm
                     focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
                     aria-[invalid=true]:border-red-400"
        />
        {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address}</p>}
      </div>

      {/* Descripción */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Descripción
        </label>
        <textarea
          id="description" rows={3} value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm
                     focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
        />
      </div>

      {/* Total habitaciones */}
      <div>
        <label htmlFor="totalRooms" className="block text-sm font-medium text-gray-700">
          Número de habitaciones <span className="text-red-500">*</span>
        </label>
        <input
          id="totalRooms" type="number" min={1} value={form.totalRooms}
          onChange={(e) => setField("totalRooms", e.target.value)}
          aria-invalid={!!errors.totalRooms}
          className="mt-1 w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm
                     focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
                     aria-[invalid=true]:border-red-400"
        />
        {errors.totalRooms && <p className="mt-1 text-xs text-red-600">{errors.totalRooms}</p>}
      </div>

      {/* Áreas comunes */}
      <TagsInput
        id="commonAreas"
        label="Áreas comunes"
        values={form.commonAreas}
        onChange={(v) => setField("commonAreas", v)}
        placeholder="Ej: cocina, sala, jardín…"
      />

      {serverError && (
        <p role="alert" className="text-sm text-red-600">{serverError}</p>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white
                     hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Guardando…" : submitLabel}
        </button>

        {onArchive && (
          <button
            type="button"
            onClick={handleArchive}
            disabled={archiving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600
                       hover:bg-gray-50 disabled:opacity-60"
          >
            {archiving ? "Archivando…" : "Archivar propiedad"}
          </button>
        )}
      </div>
    </form>
  );
}
