"use client";

export const dynamic = "force-dynamic";

/**
 * Página pública de habitación — /rooms/[roomId]
 *
 * Accesible sin autenticación. Muestra la información pública de una
 * habitación publicada. Si el usuario está autenticado y tiene cuestionario
 * enviado, también muestra su score de compatibilidad con esa habitación.
 *
 * Seguridad: las Firestore Security Rules solo permiten leer habitaciones
 * con status='published'. El servidor nunca expone habitaciones en otros estados.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/firebase/AuthContext";
import { getRoomPublic } from "@/lib/firebase/roomsService";
import CompatibilityBadge from "@/components/matching/CompatibilityBadge";
import type { Match, Room } from "@/types";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMXN(cents: number): string {
  return (cents / 100).toLocaleString("es-MX", {
    style:    "currency",
    currency: "MXN",
  });
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-MX", {
    day:   "numeric",
    month: "long",
    year:  "numeric",
  });
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function PublicRoomPage() {
  const params    = useParams();
  const router    = useRouter();
  const roomId    = typeof params?.roomId === "string" ? params.roomId : "";
  const { user, profile } = useAuth();

  const [room, setRoom]         = useState<Room | null>(null);
  const [match, setMatch]       = useState<Match | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);

  // ── Cargar habitación y match del usuario ────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const roomData = await getRoomPublic(roomId);
        if (!roomData) {
          if (!cancelled) {
            setError("Esta habitación no está disponible.");
          }
          return;
        }
        if (!cancelled) setRoom(roomData);

        // Si el usuario tiene sesión y cuestionario enviado, buscar su match
        if (user && profile?.questionnaireStatus === "submitted") {
          const matchId = `${user.uid}_${roomId}`;
          const matchQ = query(
            collection(db, "matches"),
            where("userId", "==", user.uid),
            where("targetId", "==", roomId),
            limit(1)
          );
          const matchSnap = await getDocs(matchQ);
          if (!cancelled && !matchSnap.empty) {
            setMatch({ id: matchSnap.docs[0].id, ...matchSnap.docs[0].data() } as Match);
          }
          void matchId; // usado en lógica pero no en JSX
        }
      } catch {
        if (!cancelled) {
          setError("No se pudo cargar la habitación. Intenta de nuevo.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [roomId, user, profile?.questionnaireStatus]);

  // ── Estados de carga / error / no encontrada ─────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-9 w-9 animate-spin rounded-full border-4
                        border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center
                      gap-4 bg-gray-50 px-4 text-center">
        <span className="text-5xl" aria-hidden="true">🏠</span>
        <h1 className="text-lg font-semibold text-gray-800">
          {error ?? "Habitación no encontrada"}
        </h1>
        <p className="text-sm text-gray-500">
          Es posible que la habitación haya sido retirada o pausada.
        </p>
        <Link
          href="/rooms"
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium
                     text-white hover:bg-indigo-700 focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Ver habitaciones disponibles
        </Link>
      </div>
    );
  }

  const photos = room.photoURLs ?? [];

  // ── Render principal ─────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barra de navegación mínima para visitantes no autenticados */}
      {!user && (
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between
                           border-b bg-white px-4 shadow-sm">
          <Link
            href="/"
            className="text-lg font-bold text-indigo-600
                       focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-indigo-500 rounded"
          >
            LivingShare
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/login"
              className="text-gray-600 hover:text-gray-900
                         focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-indigo-500 rounded"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-1.5 font-medium
                         text-white hover:bg-indigo-700 focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Registrarse
            </Link>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        {/* Botón de vuelta */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800
                     focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-indigo-500 rounded"
          aria-label="Volver a la página anterior"
        >
          ← Volver
        </button>

        {/* Grid principal */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* ── Galería de fotos ── */}
          <section aria-label="Fotos de la habitación">
            {photos.length > 0 ? (
              <div className="space-y-3">
                {/* Foto principal */}
                <div className="relative aspect-video overflow-hidden rounded-2xl
                                bg-gray-200 shadow-sm">
                  <Image
                    src={photos[photoIdx]}
                    alt={`Foto ${photoIdx + 1} de ${room.title}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority={photoIdx === 0}
                  />
                </div>
                {/* Miniaturas */}
                {photos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {photos.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setPhotoIdx(i)}
                        className={[
                          "relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg",
                          "border-2 transition-colors focus-visible:outline-none",
                          "focus-visible:ring-2 focus-visible:ring-indigo-500",
                          i === photoIdx
                            ? "border-indigo-500"
                            : "border-transparent hover:border-gray-300",
                        ].join(" ")}
                        aria-label={`Ver foto ${i + 1}`}
                        aria-pressed={i === photoIdx}
                      >
                        <Image
                          src={url}
                          alt={`Miniatura ${i + 1}`}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Placeholder sin fotos */
              <div className="flex aspect-video items-center justify-center
                              rounded-2xl bg-gray-100 text-5xl text-gray-300"
                   aria-label="Sin fotos disponibles">
                🛏️
              </div>
            )}
          </section>

          {/* ── Información ── */}
          <div className="space-y-6">
            {/* Título y precio */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{room.title}</h1>
              <p className="mt-2 text-2xl font-semibold text-indigo-600">
                {formatMXN(room.priceCents)}
                <span className="text-sm font-normal text-gray-500"> / mes</span>
              </p>
              {room.depositCents > 0 && (
                <p className="mt-0.5 text-sm text-gray-500">
                  Depósito: {formatMXN(room.depositCents)}
                </p>
              )}
            </div>

            {/* Disponibilidad */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Disponible desde:</span>
              <span className="font-medium text-gray-800">
                {formatDate(room.availableFrom)}
              </span>
            </div>

            {/* Badge de compatibilidad */}
            {match && (
              <div
                className="flex items-center gap-3 rounded-xl border border-indigo-100
                           bg-indigo-50 px-4 py-3"
                aria-label={`Tu compatibilidad con esta habitación es ${match.score}%`}
              >
                <span className="text-xl" aria-hidden="true">🤝</span>
                <div>
                  <p className="text-xs text-gray-500">Tu compatibilidad</p>
                  <CompatibilityBadge score={match.score} showScore />
                </div>
                <Link
                  href="/matches"
                  className="ml-auto text-xs text-indigo-600 hover:underline
                             focus-visible:outline-none focus-visible:ring-2
                             focus-visible:ring-indigo-500 rounded"
                >
                  Ver detalle →
                </Link>
              </div>
            )}

            {/* CTA para usuarios sin sesión o sin cuestionario */}
            {!user && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <p className="text-sm text-gray-700">
                  <Link
                    href="/register"
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    Crea una cuenta
                  </Link>{" "}
                  para ver tu compatibilidad con esta habitación.
                </p>
              </div>
            )}
            {user && profile?.questionnaireStatus !== "submitted" && !match && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                <p className="text-sm text-gray-700">
                  <Link
                    href="/questionnaire"
                    className="font-medium text-amber-700 hover:underline"
                  >
                    Completa tu cuestionario
                  </Link>{" "}
                  para ver tu compatibilidad.
                </p>
              </div>
            )}

            {/* Descripción */}
            {room.description && (
              <div>
                <h2 className="mb-1 text-sm font-semibold text-gray-800">
                  Descripción
                </h2>
                <p className="text-sm leading-relaxed text-gray-600">
                  {room.description}
                </p>
              </div>
            )}

            {/* Amenidades */}
            {room.amenities && room.amenities.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-gray-800">
                  Servicios y amenidades
                </h2>
                <ul className="flex flex-wrap gap-2" role="list">
                  {room.amenities.map((a) => (
                    <li
                      key={a}
                      className="rounded-full bg-gray-100 px-3 py-1 text-xs
                                 font-medium text-gray-700"
                    >
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reglas */}
            {room.rules && room.rules.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-gray-800">
                  Reglas
                </h2>
                <ul className="space-y-1" role="list">
                  {room.rules.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-sm text-gray-600">
                      <span aria-hidden="true" className="mt-0.5 text-xs">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTA principal: contactar */}
            {user ? (
              <Link
                href="/dashboard"
                className="block w-full rounded-lg bg-indigo-600 px-4 py-3
                           text-center text-sm font-semibold text-white
                           hover:bg-indigo-700 focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Ver en mi panel
              </Link>
            ) : (
              <Link
                href={`/register?next=/rooms/${roomId}`}
                className="block w-full rounded-lg bg-indigo-600 px-4 py-3
                           text-center text-sm font-semibold text-white
                           hover:bg-indigo-700 focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Registrarse para aplicar
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
