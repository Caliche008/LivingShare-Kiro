/**
 * CompatibilityBadge — displays a color-coded compatibility label.
 * Score thresholds match getCompatibilityLabel() from matching.ts:
 *   >= 80 → Excelente (green)
 *   >= 60 → Buena     (teal)
 *   >= 40 → Regular   (yellow)
 *   <  40 → Baja      (red)
 */

import { getCompatibilityLabel } from '@/lib/domain/matching';

interface CompatibilityBadgeProps {
  score: number;
  /** When true, also renders the numeric score next to the label */
  showScore?: boolean;
}

function badgeClasses(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800 ring-green-200';
  if (score >= 60) return 'bg-teal-100 text-teal-800 ring-teal-200';
  if (score >= 40) return 'bg-yellow-100 text-yellow-800 ring-yellow-200';
  return 'bg-red-100 text-red-800 ring-red-200';
}

export default function CompatibilityBadge({
  score,
  showScore = false,
}: CompatibilityBadgeProps) {
  const label = getCompatibilityLabel(score);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badgeClasses(score)}`}
      aria-label={`Compatibilidad: ${label}${showScore ? ` (${score}%)` : ''}`}
    >
      {label}
      {showScore && <span className="font-bold">{score}%</span>}
    </span>
  );
}
