"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import ProtectedRoute from "@/components/ui/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useAuth } from "@/lib/firebase/AuthContext";
import { db, FUNCTIONS_ENABLED, FUNCTIONS_DISABLED_MESSAGE } from "@/lib/firebase/config";
import { getCompatibilityLabel } from "@/lib/domain/matching";
import type { Match } from "@/types";

export default function MatchesPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recalculating, setRecalculating] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const q = query(
        collection(db, "matches"),
        where("userId", "==", user.uid),
        orderBy("score", "desc"),
        limit(20)
      );
      const snap = await getDocs(q);
      setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Match));
    } catch {
      setError("No se pudieron cargar los resultados de compatibilidad.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Carga inicial de datos: setState dentro del fetch es intencional.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function handleRecalculate() {
    if (!user) return;
    if (!FUNCTIONS_ENABLED) {
      setRecalcMsg(`ℹ️ ${FUNCTIONS_DISABLED_MESSAGE}`);
      return;
    }
    setRecalculating(true);
    setRecalcMsg("");
    try {
      const fns = getFunctions();
      const calcFn = httpsCallable<Record<string, never>, { matches: number; calculatedAt?: string }>(
        fns,
        "calculateMatchesForUser"
      );
      const result = await calcFn({});
      setRecalcMsg(`✅ ${result.data.matches} resultado${result.data.matches !== 1 ? "s" : ""} actualizados.`);
      await load();
    } catch {
      setRecalcMsg("❌ Error al actualizar. Intenta más tarde.");
    } finally {
      setRecalculating(false);
    }
  }

  const questionnaireSubmitted = profile?.questionnaireStatus === "submitted";

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <div>
              <a href="/dashboard" className="text-sm text-indigo-600 hover:underline">← Dashboard</a>
              <h1 className="text-xl font-bold text-gray-900">Compatibilidad</h1>
            </div>
            {questionnaireSubmitted && (
              <button
                onClick={handleRecalculate}
                disabled={recalculating}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                           hover:bg-indigo-700 disabled:opacity-60"
              >
                {recalculating ? "Calculando…" : "🔄 Actualizar resultados"}
              </button>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
          {/* Banner: cuestionario pendiente */}
          {!questionnaireSubmitted && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <p className="font-medium text-amber-800">Completa tu cuestionario</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Para ver resultados de compatibilidad necesitas enviar tu cuestionario de convivencia.
                </p>
                <a href="/questionnaire"
                  className="mt-2 inline-block rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                >
                  Ir al cuestionario →
                </a>
              </div>
            </div>
          )}

          {/* Mensaje de recálculo */}
          {recalcMsg && (
            <p className="rounded-lg bg-white px-4 py-3 shadow-sm text-sm">{recalcMsg}</p>
          )}

          {/* Resultados */}
          {loading ? (
            <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
          ) : error ? (
            <ErrorMessage message={error} onRetry={load} />
          ) : matches.length === 0 ? (
            <EmptyState
              icon="🤝"
              title="Aún no tienes resultados"
              description={
                questionnaireSubmitted
                  ? "Haz clic en 'Actualizar resultados' para calcular tu compatibilidad con las habitaciones disponibles."
                  : "Completa tu cuestionario para comenzar."
              }
              actionLabel={questionnaireSubmitted ? "Calcular compatibilidad" : "Ir al cuestionario"}
              onAction={questionnaireSubmitted ? handleRecalculate : () => router.push("/questionnaire")}
            />
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">{matches.length} resultado{matches.length !== 1 ? "s" : ""} encontrado{matches.length !== 1 ? "s" : ""}</p>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {matches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}

// ─── MatchCard ────────────────────────────────────────────────────────────────

function MatchCard({ match }: { match: Match }) {
  const label = getCompatibilityLabel(match.score);
  const topFactors = [...match.factors]
    .filter((f) => f.criterion !== "coverage_warning")
    .sort((a, b) => b.weight * b.similarity - a.weight * a.similarity)
    .slice(0, 3);

  const scoreColor =
    match.score >= 80 ? "text-green-600" :
    match.score >= 60 ? "text-lime-600" :
    match.score >= 40 ? "text-yellow-600" : "text-red-500";

  const barColor =
    match.score >= 80 ? "bg-green-500" :
    match.score >= 60 ? "bg-lime-500" :
    match.score >= 40 ? "bg-yellow-400" : "bg-red-400";

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 space-y-4">
      {/* Score */}
      <div className="flex items-center justify-between">
        <div>
          <span className={`text-3xl font-bold ${scoreColor}`}>{match.score}%</span>
          <span className="ml-2 text-sm text-gray-500">{label}</span>
        </div>
        <span className="text-xs text-gray-400 uppercase tracking-wide">{match.targetType}</span>
      </div>

      {/* Barra */}
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div
          className={`h-2 rounded-full ${barColor} transition-all`}
          style={{ width: `${match.score}%` }}
        />
      </div>

      {/* Factores principales */}
      {topFactors.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Factores principales</p>
          {topFactors.map((f) => (
            <div key={f.criterion} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{f.label}</span>
              <span className={`font-medium ${f.similarity >= 0.7 ? "text-green-600" : f.similarity >= 0.4 ? "text-yellow-600" : "text-red-500"}`}>
                {Math.round(f.similarity * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Warning cobertura baja */}
      {match.factors.some((f) => f.criterion === "coverage_warning") && (
        <p className="text-xs text-amber-600">⚠ Pocos datos para un resultado confiable</p>
      )}

      <p className="text-xs text-gray-400">ID: {match.targetId.slice(0, 8)}…</p>
    </div>
  );
}
