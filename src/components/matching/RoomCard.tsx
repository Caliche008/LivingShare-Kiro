/**
 * RoomCard — displays a room summary.
 *
 * When showCompatibility=true, renders the compatibility score and top factors.
 * Never exposes private questionnaire answers from other users —
 * it only shows aggregated, anonymous factors.
 */

import type { Match, MatchFactor } from '@/types';
import CompatibilityBadge from '@/components/matching/CompatibilityBadge';

interface RoomCardProps {
  match: Match;
  /** Show the compatibility score and factors panel */
  showCompatibility?: boolean;
}

/** Format cents as Mexican pesos (MXN) */
function formatMXN(cents: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Pick the top N factors by weight × similarity (ignoring warning factor) */
function topFactors(factors: MatchFactor[], n = 3): MatchFactor[] {
  return [...factors]
    .filter((f) => f.criterion !== '_coverage_warning')
    .sort((a, b) => b.weight * b.similarity - a.weight * a.similarity)
    .slice(0, n);
}

/** A simple progress bar for a similarity value (0–1) */
function SimilarityBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const colorClass =
    pct >= 80
      ? 'bg-green-500'
      : pct >= 60
      ? 'bg-teal-500'
      : pct >= 40
      ? 'bg-yellow-500'
      : 'bg-red-400';

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-medium text-gray-500">
        {pct}%
      </span>
    </div>
  );
}

export default function RoomCard({
  match,
  showCompatibility = false,
}: RoomCardProps) {
  const top = topFactors(match.factors);

  return (
    <article
      className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm
                 transition hover:shadow-md hover:border-indigo-200 overflow-hidden"
    >
      {/* Placeholder photo strip */}
      <div className="flex h-36 items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100 text-4xl text-gray-300">
        🛏️
      </div>

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">
              Habitación
            </p>
            <h3 className="mt-0.5 text-base font-semibold text-gray-900 leading-tight line-clamp-1">
              ID: {match.targetId}
            </h3>
          </div>
          {showCompatibility && (
            <CompatibilityBadge score={match.score} showScore />
          )}
        </div>

        {/* Compatibility factors */}
        {showCompatibility && top.length > 0 && (
          <div className="space-y-2 rounded-xl bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Factores principales
            </p>
            {top.map((factor) => (
              <div key={factor.criterion} className="space-y-1">
                <p className="text-xs text-gray-600">{factor.label}</p>
                <SimilarityBar value={factor.similarity} />
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <a
          href={`/rooms/${match.targetId}`}
          className="block w-full rounded-lg bg-indigo-600 py-2 text-center text-sm
                     font-medium text-white shadow-sm transition
                     hover:bg-indigo-700 focus:outline-none focus:ring-2
                     focus:ring-indigo-500 focus:ring-offset-2"
        >
          Ver habitación →
        </a>
      </div>
    </article>
  );
}
