import type { Room } from "@/types";
import Badge from "@/components/ui/Badge";
import { getCompatibilityLabel } from "@/lib/domain/matching";

interface RoomCardProps {
  room: Room;
  propertyName?: string;
  showCompatibility?: boolean;
  compatibilityScore?: number;
  onClick?: () => void;
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

const compatibilityColor = (score: number) => {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-lime-500";
  if (score >= 40) return "bg-yellow-400";
  return "bg-red-400";
};

export default function RoomCard({
  room,
  propertyName,
  showCompatibility,
  compatibilityScore,
  onClick,
}: RoomCardProps) {
  const photo = room.photoURLs?.[0];
  const visibleAmenities = room.amenities.slice(0, 3);
  const extraAmenities = room.amenities.length - 3;

  return (
    <div
      onClick={onClick}
      className={`rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden
                  ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
    >
      {/* Imagen */}
      <div className="aspect-video bg-gray-100 relative">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={room.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-gray-300">🛏️</div>
        )}
        <div className="absolute top-2 right-2">
          <Badge status={room.status} />
        </div>

        {/* Badge de compatibilidad */}
        {showCompatibility && compatibilityScore !== undefined && (
          <div className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold shadow">
            {compatibilityScore}% — {getCompatibilityLabel(compatibilityScore)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-gray-900 truncate">{room.title}</h3>
        {propertyName && (
          <p className="text-xs text-gray-400">📍 {propertyName}</p>
        )}

        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-indigo-600">
            {formatPrice(room.priceCents)}
          </span>
          <span className="text-xs text-gray-400">/mes</span>
        </div>

        {room.depositCents > 0 && (
          <p className="text-xs text-gray-500">
            Depósito: {formatPrice(room.depositCents)}
          </p>
        )}

        <p className="text-xs text-gray-500">
          Disponible desde: {room.availableFrom}
        </p>

        {/* Amenidades */}
        {room.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleAmenities.map((a) => (
              <span
                key={a}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {a}
              </span>
            ))}
            {extraAmenities > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
                +{extraAmenities} más
              </span>
            )}
          </div>
        )}

        {/* Barra de compatibilidad */}
        {showCompatibility && compatibilityScore !== undefined && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Compatibilidad</span>
              <span className="font-medium">{compatibilityScore}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-200">
              <div
                className={`h-1.5 rounded-full transition-all ${compatibilityColor(compatibilityScore)}`}
                style={{ width: `${compatibilityScore}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
