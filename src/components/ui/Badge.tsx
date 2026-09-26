import type { RoomStatus, PropertyStatus } from "@/types";

type BadgeStatus = RoomStatus | PropertyStatus;

const colorMap: Record<BadgeStatus, string> = {
  draft:      "bg-gray-100 text-gray-700",
  published:  "bg-green-100 text-green-700",
  paused:     "bg-yellow-100 text-yellow-700",
  reserved:   "bg-blue-100 text-blue-700",
  withdrawn:  "bg-red-100 text-red-700",
  active:     "bg-green-100 text-green-700",
  archived:   "bg-gray-100 text-gray-500",
};

const labelMap: Record<BadgeStatus, string> = {
  draft:      "Borrador",
  published:  "Publicada",
  paused:     "Pausada",
  reserved:   "Reservada",
  withdrawn:  "Retirada",
  active:     "Activa",
  archived:   "Archivada",
};

interface BadgeProps {
  status: BadgeStatus;
}

export default function Badge({ status }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {labelMap[status] ?? status}
    </span>
  );
}
