"use client";

import { useRef, useState } from "react";
import { uploadPhoto, deletePhoto } from "@/lib/firebase/storageService";

interface PhotoUploaderProps {
  photoURLs: string[];
  onAdd: (url: string) => void;
  onRemove: (url: string) => void;
  storagePath: (fileName: string) => string;
  maxPhotos?: number;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export default function PhotoUploader({
  photoURLs,
  onAdd,
  onRemove,
  storagePath,
  maxPhotos = 5,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setError("");

    if (!ACCEPTED.includes(file.type)) {
      setError("Solo se aceptan imágenes JPEG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("El archivo supera los 10 MB permitidos.");
      return;
    }
    if (photoURLs.length >= maxPhotos) {
      setError(`Máximo ${maxPhotos} fotos.`);
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const path = storagePath(file.name);
      const url = await uploadPhoto(path, file, (pct) => setProgress(pct));
      onAdd(url);
    } catch {
      setError("Error al subir la foto. Intenta de nuevo.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function handleRemove(url: string) {
    try {
      await deletePhoto(url);
    } catch {
      // Si el archivo ya no existe en Storage, igual removemos de la UI
    }
    onRemove(url);
  }

  return (
    <div className="space-y-3">
      {/* Zona de drop */}
      {photoURLs.length < maxPhotos && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors
            ${dragOver ? "border-indigo-500 bg-indigo-50" : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"}`}
        >
          <span className="text-2xl">📷</span>
          <p className="mt-2 text-sm text-gray-600">
            Arrastra una foto o{" "}
            <span className="font-medium text-indigo-600">haz clic para seleccionar</span>
          </p>
          <p className="mt-1 text-xs text-gray-400">
            JPEG, PNG, WebP · Máx. 10 MB · {photoURLs.length}/{maxPhotos} fotos
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            onChange={handleInputChange}
            className="sr-only"
            aria-hidden
          />
        </div>
      )}

      {/* Barra de progreso */}
      {uploading && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Subiendo… {progress}%</p>
          <div className="h-1.5 w-full rounded-full bg-gray-200">
            <div
              className="h-1.5 rounded-full bg-indigo-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Grid de fotos */}
      {photoURLs.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photoURLs.map((url) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Foto de habitación"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                className="absolute right-1 top-1 hidden rounded-full bg-red-500 p-0.5 text-white group-hover:flex
                           items-center justify-center h-5 w-5 text-xs leading-none"
                aria-label="Eliminar foto"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
