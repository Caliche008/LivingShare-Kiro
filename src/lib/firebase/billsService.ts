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
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { Bill, BillStatus } from "@/types";
import type { BillInput } from "@/lib/validation/schemas";

const COL = "bills";

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
    resourceType: "bills",
    resourceId,
    metadata: metadata ?? null,
    createdAt: serverTimestamp(),
  });
}

// ─── Crear factura ────────────────────────────────────────────────────────────

/**
 * Crea una nueva factura asociada a una propiedad.
 * El importe se guarda en centavos (ya validado por el caller con billSchema).
 */
export async function createBill(
  propertyId: string,
  createdBy: string,
  data: BillInput,
  attachmentPath?: string
): Promise<Bill> {
  const payload = {
    propertyId,
    serviceType: data.serviceType,
    provider: data.provider ?? "",
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    dueDate: data.dueDate,
    totalAmountCents: data.totalAmountCents,
    attachmentPath: attachmentPath ?? null,
    status: "pending" as BillStatus,
    splitVersion: 0,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COL), payload);
  await audit(createdBy, "BILL_CREATED", ref.id, { propertyId });

  return { id: ref.id, ...payload } as unknown as Bill;
}

// ─── Leer factura ─────────────────────────────────────────────────────────────

export async function getBill(billId: string): Promise<Bill | null> {
  const snap = await getDoc(doc(db, COL, billId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Bill;
}

// ─── Listar facturas por propiedad ────────────────────────────────────────────

export async function getBillsByProperty(propertyId: string): Promise<Bill[]> {
  const q = query(
    collection(db, COL),
    where("propertyId", "==", propertyId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Bill);
}

// ─── Actualizar factura ───────────────────────────────────────────────────────

/**
 * Actualiza una factura. Solo permitido si status === "pending".
 * Si el reparto ya fue confirmado (status !== "pending"), lanza error.
 */
export async function updateBill(
  billId: string,
  actorId: string,
  data: Partial<BillInput>
): Promise<void> {
  const existing = await getBill(billId);
  if (!existing) throw new Error("Factura no encontrada");
  if (existing.status !== "pending") {
    throw new Error(
      "No se puede modificar una factura con reparto confirmado. Crea un ajuste."
    );
  }

  await updateDoc(doc(db, COL, billId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  await audit(actorId, "BILL_UPDATED", billId, { fields: Object.keys(data) });
}

// ─── Actualizar estado ────────────────────────────────────────────────────────

/**
 * Actualiza el estado de una factura.
 * Solo el backend (Cloud Function) debería llamar esto para "split" y "settled".
 */
export async function updateBillStatus(
  billId: string,
  actorId: string,
  status: BillStatus,
  splitVersion?: number
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (splitVersion !== undefined) {
    updates.splitVersion = splitVersion;
  }

  await updateDoc(doc(db, COL, billId), updates);
  await audit(actorId, "BILL_STATUS_UPDATED", billId, { status, splitVersion });
}

// ─── Listar facturas pendientes de un residente ───────────────────────────────

/**
 * Retorna facturas de propiedades donde el residente tiene participaciones pendientes.
 * Se usa para la vista de residente en el dashboard.
 */
export async function getPendingBillsForProperty(
  propertyId: string
): Promise<Bill[]> {
  const q = query(
    collection(db, COL),
    where("propertyId", "==", propertyId),
    where("status", "in", ["pending", "split"]),
    orderBy("dueDate", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Bill);
}
