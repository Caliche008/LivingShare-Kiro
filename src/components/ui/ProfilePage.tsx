"use client";

/**
 * ProfilePage.tsx
 *
 * Página de perfil del usuario autenticado.
 *
 * Funcionalidades:
 *   - Editar displayName (Auth + Firestore users/{uid})
 *   - Subir / cambiar foto de perfil (Storage → photoURL en Auth + Firestore)
 *   - Mostrar rol(es) actual(es)
 *   - Llamar refreshProfile() tras guardar para reflejar cambios en el sidebar
 *
 * No se exponen datos sensibles. El email es solo lectura.
 * Las escrituras en Firestore están sujetas a las Security Rules
 * (un usuario solo puede actualizar su propio documento).
 */

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/lib/firebase/AuthContext";
import { uploadPhoto } from "@/lib/firebase/storageService";
import { db } from "@/lib/firebase/config";
import { z } from "zod";

// ─── Validación ───────────────────────────────────────────────────────────────

const displayNameSchema = z
  .string()
  .min(2, "El nombre debe tener al menos 2 caracteres")
  .max(80, "El nombre no puede superar los 80 caracteres");

// ─── Constantes ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  owner:    "Propietario",
  admin:    "Administrador",
  resident: "Residente",
  visitor:  "Visitante",
};

const ROLE_COLORS: Record<string, string> = {
  owner:    "bg-purple-100 text-purple-700",
  admin:    "bg-blue-100 text-blue-700",
  resident: "bg-green-100 text-green-700",
  visitor:  "bg-gray-100 text-gray-600",
};

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ─── Componente ───────────────────────────────────────────────────────────────

interface ProfilePageProps {
  userId: string;
}

export default function ProfilePage({ userId }: ProfilePageProps) {
  const { user, profile, refreshProfile } = useAuth();

  // ── Estado de nombre ────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(
    profile?.displayName ?? user?.displayName ?? ""
  );
  const [nameError, setNameError]         = useState("");
  const [savingName, setSavingName]       = useState(false);
  const [nameSaved, setNameSaved]         = useState(false);

  // ── Estado de foto ──────────────────────────────────────────────────────────
  const [photoPreview, setPhotoPreview]   = useState<string | null>(null);
  const [photoFile, setPhotoFile]         = useState<File | null>(null);
  const [photoError, setPhotoError]       = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [savingPhoto, setSavingPhoto]     = useState(false);
  const [photoSaved, setPhotoSaved]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Estado global de error ──────────────────────────────────────────────────
  const [globalError, setGlobalError] = useState("");

  // ── Foto actual ─────────────────────────────────────────────────────────────
  const currentPhotoURL = photoPreview ?? profile?.photoURL ?? user?.photoURL ?? null;
  const initials = (profile?.displayName ?? user?.displayName ?? "U")[0]?.toUpperCase();

  // ─── Cambio de nombre ─────────────────────────────────────────────────────

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDisplayName(e.target.value);
    setNameError("");
    setNameSaved(false);
  }

  const handleSaveName = useCallback(async () => {
    if (!user) return;
    const result = displayNameSchema.safeParse(displayName.trim());
    if (!result.success) {
      setNameError(result.error.issues[0]?.message ?? "Nombre inválido");
      return;
    }

    setSavingName(true);
    setGlobalError("");
    try {
      const trimmed = result.data;

      // Actualizar en Firebase Auth
      await updateProfile(user, { displayName: trimmed });

      // Actualizar en Firestore
      await updateDoc(doc(db, "users", userId), {
        displayName: trimmed,
        updatedAt:   serverTimestamp(),
      });

      // Refrescar contexto (actualiza el sidebar inmediatamente)
      await refreshProfile();
      setNameSaved(true);
    } catch {
      setGlobalError("No se pudo guardar el nombre. Intenta de nuevo.");
    } finally {
      setSavingName(false);
    }
  }, [user, userId, displayName, refreshProfile]);

  // ─── Selección de foto ─────────────────────────────────────────────────────

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError("");
    setPhotoSaved(false);

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError("Solo se permiten imágenes JPG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("La imagen no puede superar los 2 MB.");
      return;
    }

    // Vista previa local antes de subir
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setPhotoFile(file);
  }

  const handleSavePhoto = useCallback(async () => {
    if (!user || !photoFile) return;

    setSavingPhoto(true);
    setUploadProgress(0);
    setGlobalError("");

    try {
      const path = `users/${userId}/avatar/${Date.now()}_${photoFile.name}`;
      const downloadURL = await uploadPhoto(path, photoFile, setUploadProgress);

      // Actualizar en Firebase Auth
      await updateProfile(user, { photoURL: downloadURL });

      // Actualizar en Firestore
      await updateDoc(doc(db, "users", userId), {
        photoURL:  downloadURL,
        updatedAt: serverTimestamp(),
      });

      // Refrescar contexto
      await refreshProfile();
      setPhotoSaved(true);
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch {
      setGlobalError("No se pudo subir la foto. Intenta de nuevo.");
    } finally {
      setSavingPhoto(false);
      setUploadProgress(null);
    }
  }, [user, userId, photoFile, refreshProfile]);

  function handleCancelPhoto() {
    setPhotoPreview(null);
    setPhotoFile(null);
    setPhotoError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Mi perfil</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Gestiona tu nombre, foto de perfil y revisa tus roles.
        </p>
      </div>

      {/* Error global */}
      {globalError && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-red-200
                     bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span aria-hidden="true">❌</span>
          <p className="flex-1">{globalError}</p>
          <button
            onClick={() => setGlobalError("")}
            className="text-red-500 hover:text-red-700 rounded
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Foto de perfil ── */}
      <section
        className="rounded-xl border bg-white p-6 shadow-sm"
        aria-labelledby="photo-section-title"
      >
        <h2
          id="photo-section-title"
          className="mb-4 text-sm font-semibold text-gray-800"
        >
          Foto de perfil
        </h2>

        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Avatar actual / preview */}
          <div className="relative flex-shrink-0">
            {currentPhotoURL ? (
              <Image
                src={currentPhotoURL}
                alt="Foto de perfil"
                width={96}
                height={96}
                className="h-24 w-24 rounded-full object-cover ring-2 ring-gray-200"
                unoptimized={currentPhotoURL.startsWith("data:")}
              />
            ) : (
              <div
                className="flex h-24 w-24 items-center justify-center rounded-full
                           bg-indigo-100 text-3xl font-semibold text-indigo-700"
                aria-hidden="true"
              >
                {initials}
              </div>
            )}
            {photoFile && (
              <span
                className="absolute -bottom-1 -right-1 rounded-full bg-amber-400
                           px-1.5 py-0.5 text-[10px] font-bold text-white shadow"
              >
                Nuevo
              </span>
            )}
          </div>

          <div className="flex-1 space-y-3 w-full">
            {/* Input de archivo oculto */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_PHOTO_TYPES.join(",")}
              onChange={handleFileSelect}
              className="sr-only"
              aria-label="Seleccionar nueva foto de perfil"
              id="photo-input"
            />

            {/* Botones */}
            <div className="flex flex-wrap gap-2">
              <label
                htmlFor="photo-input"
                className="cursor-pointer rounded-lg border border-gray-300 bg-white
                           px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50
                           focus-within:ring-2 focus-within:ring-indigo-500"
              >
                {currentPhotoURL ? "Cambiar foto" : "Subir foto"}
              </label>

              {photoFile && (
                <>
                  <button
                    onClick={handleSavePhoto}
                    disabled={savingPhoto}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium
                               text-white hover:bg-indigo-700 disabled:opacity-60
                               disabled:cursor-not-allowed
                               focus-visible:outline-none focus-visible:ring-2
                               focus-visible:ring-indigo-500"
                  >
                    {savingPhoto ? "Subiendo…" : "Guardar foto"}
                  </button>
                  <button
                    onClick={handleCancelPhoto}
                    disabled={savingPhoto}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm
                               font-medium text-gray-600 hover:bg-gray-50
                               disabled:opacity-60 focus-visible:outline-none
                               focus-visible:ring-2 focus-visible:ring-gray-400"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>

            {/* Barra de progreso */}
            {uploadProgress !== null && (
              <div className="space-y-1">
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200"
                  role="progressbar"
                  aria-valuenow={uploadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progreso de subida"
                >
                  <div
                    className="h-full bg-indigo-500 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">{uploadProgress}%</p>
              </div>
            )}

            {photoError && (
              <p role="alert" className="text-xs text-red-600">{photoError}</p>
            )}
            {photoSaved && !photoFile && (
              <p className="text-xs text-green-600">✓ Foto actualizada correctamente</p>
            )}

            <p className="text-xs text-gray-400">
              JPG, PNG o WebP · máximo 2 MB
            </p>
          </div>
        </div>
      </section>

      {/* ── Nombre ── */}
      <section
        className="rounded-xl border bg-white p-6 shadow-sm"
        aria-labelledby="name-section-title"
      >
        <h2
          id="name-section-title"
          className="mb-4 text-sm font-semibold text-gray-800"
        >
          Nombre para mostrar
        </h2>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="display-name"
              className="block text-sm font-medium text-gray-700"
            >
              Nombre
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={handleNameChange}
              maxLength={80}
              aria-describedby={nameError ? "name-error" : undefined}
              aria-invalid={!!nameError}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2
                         text-sm shadow-sm focus:border-indigo-500 focus:outline-none
                         focus:ring-1 focus:ring-indigo-500
                         aria-[invalid=true]:border-red-400"
            />
            {nameError && (
              <p id="name-error" role="alert" className="mt-1 text-xs text-red-600">
                {nameError}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveName}
              disabled={savingName || displayName.trim() === (profile?.displayName ?? "")}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium
                         text-white hover:bg-indigo-700 disabled:opacity-60
                         disabled:cursor-not-allowed focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {savingName ? "Guardando…" : "Guardar nombre"}
            </button>
            {nameSaved && (
              <p className="text-xs text-green-600">✓ Nombre actualizado</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Email (solo lectura) ── */}
      <section
        className="rounded-xl border bg-white p-6 shadow-sm"
        aria-labelledby="email-section-title"
      >
        <h2
          id="email-section-title"
          className="mb-4 text-sm font-semibold text-gray-800"
        >
          Correo electrónico
        </h2>
        <p className="text-sm text-gray-700">
          {profile?.email ?? user?.email ?? "—"}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          El correo no puede modificarse desde aquí.
        </p>
      </section>

      {/* ── Roles ── */}
      <section
        className="rounded-xl border bg-white p-6 shadow-sm"
        aria-labelledby="roles-section-title"
      >
        <h2
          id="roles-section-title"
          className="mb-4 text-sm font-semibold text-gray-800"
        >
          Roles asignados
        </h2>

        {profile?.roles && profile.roles.length > 0 ? (
          <div className="flex flex-wrap gap-2" role="list" aria-label="Roles del usuario">
            {profile.roles.map((role) => (
              <span
                key={role}
                role="listitem"
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  ROLE_COLORS[role] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {ROLE_LABELS[role] ?? role}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Sin roles asignados.</p>
        )}

        <p className="mt-3 text-xs text-gray-400">
          Los roles son asignados por un propietario o administrador.
        </p>
      </section>
    </div>
  );
}
