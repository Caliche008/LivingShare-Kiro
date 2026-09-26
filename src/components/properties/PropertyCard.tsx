import type { Property } from "@/types";
import Badge from "@/components/ui/Badge";

interface PropertyCardProps {
  property: Property;
  onClick: () => void;
}

export default function PropertyCard({ property, onClick }: PropertyCardProps) {
  const photo = property.photoURLs?.[0];

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow
                 overflow-hidden text-left border border-gray-100"
    >
      {/* Imagen */}
      <div className="aspect-video bg-gray-100 relative">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={property.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-gray-300">
            🏠
          </div>
        )}
        <div className="absolute top-2 right-2">
          <Badge status={property.status} />
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate">{property.name}</h3>
        <p className="mt-1 text-sm text-gray-500 truncate">📍 {property.address}</p>
        <p className="mt-1 text-xs text-gray-400">
          {property.totalRooms} habitación{property.totalRooms !== 1 ? "es" : ""}
        </p>
      </div>
    </button>
  );
}
