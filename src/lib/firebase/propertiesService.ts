import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { Property } from "@/types";
import type { PropertyInput } from "@/lib/validation/schemas";

const COL = "properties";

// ─── Helper: auditoría ────────────────────────────────────────────────────────
async function audit(
  actorId: string,
  action: string,
  resourceId: string,
  metadata?: Record<string, unknown>
) {
  await addDoc(collection(db, "auditLogs"), {
    actorId,
    action,
    resourceType: "properties",
    resourceId,
    metadata: metadata ?? null,
    createdAt: serverTimestamp(),
  });
}

// ─── Funciones públicas ───────────────────────────────────────────────────────

/**
 * Crea una nueva propiedad. Retorna el objeto completo con el id asignado.
 */
export async function createProperty(
  ownerId: string,
  data: PropertyInput
): Promise<Property> {
  const payload = {
    ownerId,
    managerIds: [] as string[],
    name: data.name,
    address: data.address,
    description: data.description ?? "",
    photoURLs: [] as string[],
    totalRooms: data.totalRooms,
    commonAreas: data.commonAreas ?? [],
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COL), payload);
  await audit(ownerId, "PROPERTY_CREATED", ref.id);

  return {
    id: ref.id,
    ...(payload as Omit<typeof payload, "createdAt" | "updatedAt">),
    status: "active",
  } as unknown as Property;
}

/**
 * Obtiene una propiedad por su id. Retorna null si no existe.
 */
export async function getProperty(propertyId: string): Promise<Property | null> {
  const snap = await getDoc(doc(db, COL, propertyId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Property;
}

/**
 * Lista las propiedades activas de un owner, ordenadas por creación descendente.
 */
export async function getPropertiesByOwner(ownerId: string): Promise<Property[]> {
  const q = query(
    collection(db, COL),
    where("ownerId", "==", ownerId),
    where("status", "!=", "archived"),
    orderBy("status"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Property);
}

/**
 * Actualiza los datos de una propiedad.
 */
export async function updateProperty(
  propertyId: string,
  actorId: string,
  data: Partial<PropertyInput>
): Promise<void> {
  await updateDoc(doc(db, COL, propertyId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  await audit(actorId, "PROPERTY_UPDATED", propertyId, { fields: Object.keys(data) });
}

/**
 * Archiva una propiedad (soft delete — no se puede revertir desde el cliente).
 */
export async function archiveProperty(
  propertyId: string,
  actorId: string
): Promise<void> {
  await updateDoc(doc(db, COL, propertyId), {
    status: "archived",
    updatedAt: serverTimestamp(),
  });
  await audit(actorId, "PROPERTY_ARCHIVED", propertyId);
}

/**
 * Agrega un manager a la propiedad.
 */
export async function addManagerToProperty(
  propertyId: string,
  actorId: string,
  managerUid: string
): Promise<void> {
  await updateDoc(doc(db, COL, propertyId), {
    managerIds: arrayUnion(managerUid),
    updatedAt: serverTimestamp(),
  });
  await audit(actorId, "MANAGER_ADDED", propertyId, { managerUid });
}

/**
 * Actualiza las fotos de una propiedad.
 */
export async function updatePropertyPhotos(
  propertyId: string,
  photoURLs: string[]
): Promise<void> {
  await updateDoc(doc(db, COL, propertyId), {
    photoURLs,
    updatedAt: serverTimestamp(),
  });
}
