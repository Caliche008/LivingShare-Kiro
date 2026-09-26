import {
  collection,
  collectionGroup,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { Room, RoomStatus } from "@/types";
import { ROOM_STATUS_TRANSITIONS } from "@/types";
import type { RoomInput } from "@/lib/validation/schemas";

export interface RoomFilters {
  maxPriceCents?: number;
  minPriceCents?: number;
  availableFrom?: string;
}

function roomsCol(propertyId: string) {
  return collection(db, "properties", propertyId, "rooms");
}

function roomDoc(propertyId: string, roomId: string) {
  return doc(db, "properties", propertyId, "rooms", roomId);
}

// ─── Funciones públicas ───────────────────────────────────────────────────────

/**
 * Busca una habitación publicada por su roomId sin conocer el propertyId de antemano.
 *
 * Estrategia: usamos collectionGroup con where(status=published) y filtramos
 * por documentId en cliente. Esto es aceptable porque:
 * - Solo se llama desde la página pública de habitación (1 habitación a la vez)
 * - Las habitaciones publicadas son relativamente pocas
 * - El límite de 500 documentos protege contra lecturas masivas
 *
 * Alternativa futura: añadir una colección plana `publicRooms/{roomId}` que se
 * mantenga sincronizada mediante Cloud Functions para lecturas O(1).
 *
 * Retorna null si no existe o no está publicada.
 */
export async function getRoomPublic(roomId: string): Promise<Room | null> {
  const q = query(
    collectionGroup(db, "rooms"),
    where("status", "==", "published"),
    limit(500)
  );
  const snap = await getDocs(q);
  const roomSnap = snap.docs.find((d) => d.id === roomId);
  if (!roomSnap) return null;
  return { id: roomSnap.id, ...roomSnap.data() } as Room;
}

/**
 * Crea una habitación en una propiedad. Estado inicial: 'draft'.
 */
export async function createRoom(
  propertyId: string,
  actorId: string,
  data: RoomInput
): Promise<Room> {
  const payload = {
    propertyId,
    title: data.title,
    description: data.description ?? "",
    priceCents: data.priceCents,
    depositCents: data.depositCents,
    availableFrom: data.availableFrom,
    amenities: data.amenities ?? [],
    rules: data.rules ?? [],
    preferences: data.preferences ?? {},
    photoURLs: [] as string[],
    status: "draft" as RoomStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(roomsCol(propertyId), payload);
  return { id: ref.id, ...payload } as unknown as Room;
}

/**
 * Obtiene una habitación. Retorna null si no existe.
 */
export async function getRoom(
  propertyId: string,
  roomId: string
): Promise<Room | null> {
  const snap = await getDoc(roomDoc(propertyId, roomId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Room;
}

/**
 * Lista todas las habitaciones de una propiedad, ordenadas por creación descendente.
 */
export async function getRoomsByProperty(propertyId: string): Promise<Room[]> {
  const q = query(roomsCol(propertyId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Room);
}

/**
 * Busca habitaciones publicadas con filtros opcionales.
 * Usa collectionGroup para buscar en todas las propiedades a la vez.
 */
export async function getPublishedRooms(filters?: RoomFilters): Promise<Room[]> {
  const roomsGroup = collection(db, "rooms");
  // collectionGroup requiere un índice en Firestore. Usamos query simple por ahora.
  const q = query(
    roomsGroup,
    where("status", "==", "published"),
    orderBy("priceCents", "asc")
  );
  const snap = await getDocs(q);
  let rooms = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Room);

  // Filtros en cliente (Firestore no permite múltiples where en campos distintos
  // sin índice compuesto)
  if (filters?.minPriceCents !== undefined) {
    rooms = rooms.filter((r) => r.priceCents >= filters.minPriceCents!);
  }
  if (filters?.maxPriceCents !== undefined) {
    rooms = rooms.filter((r) => r.priceCents <= filters.maxPriceCents!);
  }
  if (filters?.availableFrom) {
    rooms = rooms.filter((r) => r.availableFrom <= filters.availableFrom!);
  }

  return rooms;
}

/**
 * Actualiza los datos de una habitación.
 */
export async function updateRoom(
  propertyId: string,
  roomId: string,
  _actorId: string,
  data: Partial<RoomInput>
): Promise<void> {
  await updateDoc(roomDoc(propertyId, roomId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Cambia el estado de una habitación. Valida que la transición sea válida.
 */
export async function updateRoomStatus(
  propertyId: string,
  roomId: string,
  actorId: string,
  newStatus: RoomStatus
): Promise<void> {
  const room = await getRoom(propertyId, roomId);
  if (!room) throw new Error("Habitación no encontrada");

  const allowed = ROOM_STATUS_TRANSITIONS[room.status];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Transición inválida: ${room.status} → ${newStatus}. Permitidas: ${allowed.join(", ")}`
    );
  }

  await updateDoc(roomDoc(propertyId, roomId), {
    status: newStatus,
    updatedAt: serverTimestamp(),
  });

  // Auditoría
  await addDoc(collection(db, "auditLogs"), {
    actorId,
    action: "ROOM_STATUS_CHANGED",
    resourceType: "rooms",
    resourceId: roomId,
    metadata: { propertyId, from: room.status, to: newStatus },
    createdAt: serverTimestamp(),
  });
}

/**
 * Actualiza las fotos de una habitación.
 */
export async function updateRoomPhotos(
  propertyId: string,
  roomId: string,
  photoURLs: string[]
): Promise<void> {
  await updateDoc(roomDoc(propertyId, roomId), {
    photoURLs,
    updatedAt: serverTimestamp(),
  });
}
