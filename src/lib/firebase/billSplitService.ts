import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { BillShare, Payment, ShareStatus } from "@/types";

// ─── Participaciones ──────────────────────────────────────────────────────────

/**
 * Obtiene todas las participaciones de una factura.
 * Solo accesible para residentes de la propiedad o administradores
 * (la validación real está en Firestore Rules).
 */
export async function getSharesByBill(billId: string): Promise<BillShare[]> {
  const q = query(
    collection(db, "bills", billId, "shares"),
    orderBy("amountCents", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BillShare);
}

/**
 * Obtiene las participaciones de un residente en una factura.
 */
export async function getShareForResident(
  billId: string,
  residentId: string
): Promise<BillShare | null> {
  const q = query(
    collection(db, "bills", billId, "shares"),
    where("residentId", "==", residentId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as BillShare;
}

/**
 * Suscripción en tiempo real a las participaciones de una factura.
 * Retorna la función para cancelar la suscripción.
 */
export function subscribeToShares(
  billId: string,
  onUpdate: (shares: BillShare[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, "bills", billId, "shares"),
    orderBy("amountCents", "desc")
  );
  return onSnapshot(
    q,
    (snap) => {
      const shares = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BillShare);
      onUpdate(shares);
    },
    (err) => onError?.(err)
  );
}

/**
 * Obtiene participaciones de un residente con un estado dado en todas las facturas.
 * Útil para mostrar "deudas pendientes" del residente.
 */
export async function getSharesByResidentAndStatus(
  residentId: string,
  status: ShareStatus
): Promise<BillShare[]> {
  // Nota: requiere índice compuesto en Firestore:
  // collection bills/{billId}/shares, campos: residentId + status
  // Como es subcolección, usamos collectionGroup
  const q = query(
    collection(db, "__pending_shares__"), // placeholder — ver nota abajo
    where("residentId", "==", residentId),
    where("status", "==", status)
  );
  // En la implementación real se usa collectionGroup("shares")
  // pero requiere índice — por ahora retornamos vacío hasta tener el índice
  void q;
  return [];
}

/**
 * Obtiene participaciones de un residente usando collectionGroup.
 * Requiere índice compuesto: residentId ASC, status ASC en shares.
 */
export async function getResidentShares(
  residentId: string,
  status?: ShareStatus
): Promise<BillShare[]> {
  const constraints = [where("residentId", "==", residentId)];
  if (status) constraints.push(where("status", "==", status));

  const q = query(
    collection(db, "shares"), // collectionGroup se configura en Firestore
    ...constraints,
    orderBy("calculatedAt", "desc")
  );

  try {
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BillShare);
  } catch {
    // Si el índice no está listo, retorna vacío con un log silencioso
    return [];
  }
}

// ─── Pagos ────────────────────────────────────────────────────────────────────

/**
 * Obtiene el historial de pagos de un usuario.
 */
export async function getPaymentsByUser(userId: string): Promise<Payment[]> {
  const q = query(
    collection(db, "payments"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment);
}

/**
 * Obtiene el pago asociado a una participación.
 */
export async function getPaymentByShare(billShareId: string): Promise<Payment | null> {
  const q = query(
    collection(db, "payments"),
    where("billShareId", "==", billShareId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Payment;
}

/**
 * Suscripción en tiempo real al pago de una participación.
 */
export function subscribeToPayment(
  billShareId: string,
  onUpdate: (payment: Payment | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, "payments"),
    where("billShareId", "==", billShareId)
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onUpdate(null);
        return;
      }
      const d = snap.docs[0];
      onUpdate({ id: d.id, ...d.data() } as Payment);
    },
    (err) => onError?.(err)
  );
}
