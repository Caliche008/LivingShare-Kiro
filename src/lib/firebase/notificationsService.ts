/**
 * notificationsService.ts
 *
 * Servicio cliente para la colección `notifications` de Firestore.
 *
 * Operaciones:
 *   getNotifications         — leer las últimas N notificaciones del usuario
 *   getNotificationsPage     — paginación cursor-based con filtros opcionales
 *   markAsRead               — marcar una notificación individual como leída
 *   markAllAsRead            — marcar todas las notificaciones no leídas como leídas
 *   subscribeToNotifications — suscripción en tiempo real (unread-first)
 *   getUnreadCount           — conteo de no leídas para el badge
 *
 * Reglas de autorización:
 *   - Solo el propio usuario puede leer y actualizar sus notificaciones.
 *   - La escritura (creación) es exclusiva de Cloud Functions (Admin SDK).
 */

import {
  collection,
  doc,
  getDocs,
  updateDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { Notification, NotificationType } from "@/types";

const COL = "notifications";
const DEFAULT_PAGE_SIZE = 20;

// ─── Tipos para paginación ────────────────────────────────────────────────────

export interface NotificationsPageOptions {
  /** Cursor del último documento de la página anterior. Omitir para la primera página. */
  lastDoc?: QueryDocumentSnapshot<DocumentData>;
  /** Filtrar por tipo de notificación. Omitir para mostrar todos. */
  filterType?: NotificationType;
  /** Filtrar por estado de lectura. Omitir para mostrar todos. */
  filterRead?: boolean;
  /** Número máximo de resultados. Default: 20 */
  pageSize?: number;
}

export interface NotificationsPageResult {
  notifications: Notification[];
  /** Cursor para la siguiente página. undefined si no hay más resultados. */
  lastDoc: QueryDocumentSnapshot<DocumentData> | undefined;
  /** true si hay más páginas después de esta */
  hasMore: boolean;
}

// ─── Paginación cursor-based ──────────────────────────────────────────────────

/**
 * Devuelve una página de notificaciones con soporte de cursor y filtros opcionales.
 *
 * Usa `startAfter` para la paginación, estrategia recomendada por Firestore.
 * Solicita pageSize+1 documentos para detectar si hay más páginas sin una
 * query adicional.
 *
 * Nota: combinar `where("type",...)` + `orderBy("createdAt")` requiere un
 * índice compuesto en Firestore. El índice {userId, type, createdAt desc}
 * debe estar en firestore.indexes.json para que la combinación funcione.
 * El filtro de solo `read` solo requiere {userId, read, createdAt desc}.
 *
 * @example
 * // Primera página sin filtros
 * const page1 = await getNotificationsPage(uid);
 *
 * // Siguiente página
 * const page2 = await getNotificationsPage(uid, { lastDoc: page1.lastDoc });
 *
 * // Solo no leídas del tipo "bill_split"
 * const filtered = await getNotificationsPage(uid, {
 *   filterType: "bill_split",
 *   filterRead: false,
 * });
 */
export async function getNotificationsPage(
  userId: string,
  options: NotificationsPageOptions = {}
): Promise<NotificationsPageResult> {
  const {
    lastDoc,
    filterType,
    filterRead,
    pageSize = DEFAULT_PAGE_SIZE,
  } = options;

  // Solicitar pageSize+1 para saber si hay más páginas
  const fetchSize = pageSize + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const constraints: any[] = [
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
  ];

  if (filterType !== undefined) {
    constraints.push(where("type", "==", filterType));
  }
  if (filterRead !== undefined) {
    constraints.push(where("read", "==", filterRead));
  }
  if (lastDoc !== undefined) {
    constraints.push(startAfter(lastDoc));
  }

  constraints.push(limit(fetchSize));

  const q = query(collection(db, COL), ...constraints);
  const snap = await getDocs(q);

  const docs = snap.docs;
  const hasMore = docs.length === fetchSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;

  return {
    notifications: pageDocs.map((d) => ({ id: d.id, ...d.data() }) as Notification),
    lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : undefined,
    hasMore,
  };
}

// ─── Leer notificaciones (sin paginación) ─────────────────────────────────────

/**
 * Devuelve las últimas notificaciones del usuario ordenadas por fecha descendente.
 * Incluye leídas y no leídas. Para UI con paginación usar `getNotificationsPage`.
 */
export async function getNotifications(
  userId: string,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<Notification[]> {
  const q = query(
    collection(db, COL),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification);
}

// ─── Conteo de no leídas ──────────────────────────────────────────────────────

/**
 * Retorna el número de notificaciones no leídas del usuario.
 * Útil para el badge de la campanita sin traer el cuerpo completo.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const q = query(
    collection(db, COL),
    where("userId", "==", userId),
    where("read", "==", false)
  );
  const snap = await getDocs(q);
  return snap.size;
}

// ─── Suscripción en tiempo real ───────────────────────────────────────────────

/**
 * Suscribe al listener de notificaciones en tiempo real.
 * Las notificaciones no leídas aparecen primero; luego por fecha descendente.
 *
 * Retorna la función `unsubscribe` para limpiar el listener en el desmontaje.
 *
 * @example
 * const unsub = subscribeToNotifications(uid, (notifs) => setNotifications(notifs));
 * return () => unsub();
 */
export function subscribeToNotifications(
  userId: string,
  onUpdate: (notifications: Notification[]) => void,
  pageSize = DEFAULT_PAGE_SIZE
): Unsubscribe {
  // Firestore no permite ordenar por dos campos distintos en campos diferentes
  // sin un índice compuesto. Ordenamos solo por createdAt desc y ordenamos
  // unread-first en memoria para evitar requerir un índice adicional.
  const q = query(
    collection(db, COL),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );

  return onSnapshot(
    q,
    (snap) => {
      const notifs = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Notification
      );
      // No leídas primero, luego por fecha
      notifs.sort((a, b) => {
        if (a.read !== b.read) return a.read ? 1 : -1;
        return 0;
      });
      onUpdate(notifs);
    },
    (error) => {
      // No propagar el error: si la consulta falla (p. ej. un índice de
      // Firestore que aún se esta construyendo), mostramos la lista vacía en
      // lugar de tumbar toda el area privada que envuelve este componente.
      console.warn("subscribeToNotifications: no se pudieron cargar notificaciones", error);
      onUpdate([]);
    }
  );
}

// ─── Marcar como leída ────────────────────────────────────────────────────────

/**
 * Marca una notificación individual como leída.
 * No lanza error si ya estaba leída (operación idempotente).
 */
export async function markAsRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, COL, notificationId), {
    read: true,
    updatedAt: serverTimestamp(),
  });
}

// ─── Marcar todas como leídas ─────────────────────────────────────────────────

/**
 * Marca todas las notificaciones no leídas del usuario como leídas.
 * Usa un batch para atomicidad. Firestore permite hasta 500 ops por batch.
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const q = query(
    collection(db, COL),
    where("userId", "==", userId),
    where("read", "==", false),
    limit(500) // límite de seguridad del batch
  );
  const snap = await getDocs(q);
  if (snap.empty) return 0;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { read: true, updatedAt: serverTimestamp() });
  });
  await batch.commit();

  return snap.size;
}
