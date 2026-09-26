"use client";

import { useState } from "react";
import TagsInput from "@/components/ui/TagsInput";
import PhotoUploader from "@/components/rooms/PhotoUploader";
import { roomSchema, type RoomInput } from "@/lib/validation/schemas";
import { createRoom, updateRoom, updateRoomPhotos } from "@/lib/firebase/roomsService";
import { generateRoomPhotoPath } from "@/lib/firebase/storageService";
import { useAuth } from "@/lib/firebase/AuthContext";
import type { Room } from "@/types";

interface RoomFormProps {
  propertyId: string;
  room?: Room;
  onSuccess: (room: Room) => void;
  onCancel: () => void;
}

type FormState = {
  title: string;
  description: string;
  priceInPesos: string;
  depositInPesos: string;
  availableFrom: string;
  amenities: string[];
  rules: string[];
  photoURLs: string[];
};

type FormErrors = Partial<Record<keyof RoomInput, string>>;

export default function RoomForm({ propertyId, room, onSuccess, onCancel }: RoomFormProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>({
    title: room?.title ?? "",
    description: room?.description ?? "",
    priceInPesos: room ? String(room.priceCents / 100) : "",
    depositInPesos: room ? String(room.depositCents / 100) : "",
    availableFrom: room?.availableFrom ?? "",
    amenities: room?.amenities ?? [],
    rules: room?.rules ?? [],
    photoURLs: room?.photoURLs ?? [],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  function setField(key: keyof FormState, value: string | string[]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key !== "photoURLs") setErrors((prev) => ({ ...prev, [key]: undefined }));
    setServerError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const payload: RoomInput = {
      title: form.title,
      description: form.description || undefined,
      priceCents: Math.round(parseFloat(form.priceInPesos || "0") * 100),
      depositCents: Math.round(parseFloat(form.depositInPesos || "0") * 100),
      availableFrom: form.availableFrom,
      amenities: form.amenities,
      rules: form.rules,
    };

    const parsed = roomSchema.safeParse(payload);
    if (!parsed.success) {
      const fe: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof RoomInput;
        if (!fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }

    setLoading(true);
    try {
      if (room) {
        // Edición
        await updateRoom(propertyId, room.id, user.uid, parsed.data);
        await updateRoomPhotos(propertyId, room.id, form.photoURLs);
        onSuccess({ ...room, ...parsed.data, photoURLs: form.photoURLs } as Room);
      } else {
        // Creación
        const newRoom = await createRoom(propertyId, user.uid, parsed.data);
        if (form.photoURLs.length > 0) {
          await updateRoomPhotos(propertyId, newRoom.id, form.photoURLs);
        }
        onSuccess({ ...newRoom, photoURLs: form.photoURLs });
      }
    } catch {
      setServerError("Error al guardar la habitación. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = (hasError?: boolean) =>
    `mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm
     focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
     ${hasError ? "border-red-400" : "border-gray-300"}`;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Título */}
      <div>
        <label htmlFor="r-title" className="block text-sm font-medium text-gray-700">
          Título <span className="text-red-500">*</span>
        </label>
        <input
          id="r-title" type="text" value={form.title}
          onChange={(e) => setField("title", e.target.value)}
          aria-invalid={!!errors.title}
          className={inputCls(!!errors.title)}
        />
        {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
      </div>

      {/* Descripción */}
      <div>
        <label htmlFor="r-desc" className="block text-sm font-medium text-gray-700">Descripción</label>
        <textarea
          id="r-desc" rows={3} value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          className={inputCls(false) + " resize-none"}
        />
      </div>

      {/* Precio y depósito */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="r-price" className="block text-sm font-medium text-gray-700">
            Precio/mes (MXN) <span className="text-red-500">*</span>
          </label>
          <input
            id="r-price" type="number" min={0} step={0.01} value={form.priceInPesos}
            onChange={(e) => setField("priceInPesos", e.target.value)}
            aria-invalid={!!errors.priceCents}
            className={inputCls(!!errors.priceCents)}
          />
          {errors.priceCents && <p className="mt-1 text-xs text-red-600">{errors.priceCents}</p>}
        </div>
        <div>
          <label htmlFor="r-deposit" className="block text-sm font-medium text-gray-700">Depósito (MXN)</label>
          <input
            id="r-deposit" type="number" min={0} step={0.01} value={form.depositInPesos}
            onChange={(e) => setField("depositInPesos", e.target.value)}
            className={inputCls(false)}
          />
        </div>
      </div>

      {/* Disponible desde */}
      <div>
        <label htmlFor="r-date" className="block text-sm font-medium text-gray-700">
          Disponible desde <span className="text-red-500">*</span>
        </label>
        <input
          id="r-date" type="date" value={form.availableFrom}
          onChange={(e) => setField("availableFrom", e.target.value)}
          aria-invalid={!!errors.availableFrom}
          className={inputCls(!!errors.availableFrom) + " w-48"}
        />
        {errors.availableFrom && <p className="mt-1 text-xs text-red-600">{errors.availableFrom}</p>}
      </div>

      {/* Amenidades y reglas */}
      <TagsInput
        id="r-amenities"
        label="Amenidades"
        values={form.amenities}
        onChange={(v) => setField("amenities", v)}
        placeholder="Ej: WiFi, agua caliente, clóset…"
      />

      <TagsInput
        id="r-rules"
        label="Reglas de convivencia"
        values={form.rules}
        onChange={(v) => setField("rules", v)}
        placeholder="Ej: No fumar, no mascotas…"
      />

      {/* Fotos */}
      {room && (
        <div>
          <p className="mb-2 block text-sm font-medium text-gray-700">Fotografías</p>
          <PhotoUploader
            photoURLs={form.photoURLs}
            onAdd={(url) => setField("photoURLs", [...form.photoURLs, url])}
            onRemove={(url) => setField("photoURLs", form.photoURLs.filter((u) => u !== url))}
            storagePath={(fileName) => generateRoomPhotoPath(propertyId, room.id, fileName)}
          />
        </div>
      )}

      {serverError && <p role="alert" className="text-sm text-red-600">{serverError}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit" disabled={loading}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white
                     hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Guardando…" : "Guardar habitación"}
        </button>
        <button
          type="button" onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
