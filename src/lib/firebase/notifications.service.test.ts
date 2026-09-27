/**
 * Pruebas unitarias de notificationsService
 *
 * Verifica:
 * - getNotifications: construye la query correcta y mapea ids
 * - getUnreadCount: filtra solo read=false
 * - markAsRead: llama a updateDoc con read=true (idempotente)
 * - markAllAsRead: usa writeBatch para actualizar todas las no-leídas
 * - subscribeToNotifications: ordena unread-first en memoria
 */

// ─── Mocks de firebase/firestore ──────────────────────────────────────────────

const mockGetDocs    = jest.fn();
const mockUpdateDoc  = jest.fn();
const mockOnSnapshot = jest.fn();
const mockWriteBatch = jest.fn();
const mockCollection  = jest.fn();
const mockDoc         = jest.fn();
const mockQuery       = jest.fn();
const mockWhere       = jest.fn();
const mockOrderBy     = jest.fn();
const mockLimit       = jest.fn();
const mockServerTimestamp = jest.fn(() => "SERVER_TS");

jest.mock("firebase/firestore", () => ({
  collection:      mockCollection,
  doc:             mockDoc,
  getDocs:         mockGetDocs,
  updateDoc:       mockUpdateDoc,
  writeBatch:      mockWriteBatch,
  onSnapshot:      mockOnSnapshot,
  query:           mockQuery,
  where:           mockWhere,
  orderBy:         mockOrderBy,
  limit:           mockLimit,
  serverTimestamp: mockServerTimestamp,
}));

jest.mock("@/lib/firebase/config", () => ({ db: {} }));

// ─── Importar el servicio bajo prueba ─────────────────────────────────────────

import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  subscribeToNotifications,
} from "./notificationsService";

import type { Notification } from "@/types";
import type { Timestamp } from "firebase/firestore";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = "user-001";

function makeNotif(
  id: string,
  read: boolean,
  createdAtOffset = 0
): Notification {
  return {
    id,
    userId:    USER_ID,
    type:      "bill_split",
    title:     `Notificación ${id}`,
    body:      "Cuerpo de prueba",
    actionUrl: `/bills/${id}`,
    read,
    createdAt: { seconds: 1_000_000 + createdAtOffset } as unknown as Timestamp,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockCollection.mockReturnValue("col_ref");
  mockDoc.mockReturnValue("doc_ref");
  mockQuery.mockReturnValue("query_ref");
  mockWhere.mockReturnThis();
  mockOrderBy.mockReturnThis();
  mockLimit.mockReturnThis();
  mockUpdateDoc.mockResolvedValue(undefined);
});

// ═══════════════════════════════════════════════════════════════════════════════
// getNotifications
// ═══════════════════════════════════════════════════════════════════════════════

describe("getNotifications", () => {
  test("retorna las notificaciones con id del snapshot", async () => {
    const notifs = [makeNotif("n1", false), makeNotif("n2", true)];
    mockGetDocs.mockResolvedValueOnce({
      docs: notifs.map((n) => ({ id: n.id, data: () => n })),
    });

    const result = await getNotifications(USER_ID);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("n1");
    expect(result[1].id).toBe("n2");
  });

  test("retorna array vacío si no hay notificaciones", async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const result = await getNotifications(USER_ID);
    expect(result).toHaveLength(0);
  });

  test("filtra por userId correcto", async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    await getNotifications(USER_ID);
    expect(mockWhere).toHaveBeenCalledWith("userId", "==", USER_ID);
  });

  test("ordena por createdAt descendente", async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    await getNotifications(USER_ID);
    expect(mockOrderBy).toHaveBeenCalledWith("createdAt", "desc");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getUnreadCount
// ═══════════════════════════════════════════════════════════════════════════════

describe("getUnreadCount", () => {
  test("retorna el número de documentos no leídos", async () => {
    mockGetDocs.mockResolvedValueOnce({ size: 3 });
    const count = await getUnreadCount(USER_ID);
    expect(count).toBe(3);
  });

  test("filtra por read=false", async () => {
    mockGetDocs.mockResolvedValueOnce({ size: 0 });
    await getUnreadCount(USER_ID);
    expect(mockWhere).toHaveBeenCalledWith("read", "==", false);
  });

  test("retorna 0 si no hay no-leídas", async () => {
    mockGetDocs.mockResolvedValueOnce({ size: 0 });
    const count = await getUnreadCount(USER_ID);
    expect(count).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// markAsRead
// ═══════════════════════════════════════════════════════════════════════════════

describe("markAsRead", () => {
  test("llama a updateDoc con read=true y updatedAt", async () => {
    await markAsRead("notif-001");

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      "doc_ref",
      expect.objectContaining({ read: true, updatedAt: "SERVER_TS" })
    );
  });

  test("puede llamarse dos veces sin error (idempotente)", async () => {
    await markAsRead("notif-001");
    await markAsRead("notif-001");

    expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// markAllAsRead
// ═══════════════════════════════════════════════════════════════════════════════

describe("markAllAsRead", () => {
  test("retorna 0 si no hay notificaciones no leídas", async () => {
    mockGetDocs.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });

    const count = await markAllAsRead(USER_ID);
    expect(count).toBe(0);
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  test("usa writeBatch para actualizar todas las no-leídas", async () => {
    const mockBatchUpdate = jest.fn();
    const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    });

    const notifs = [makeNotif("n1", false), makeNotif("n2", false)];
    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      size:  2,
      docs:  notifs.map((n) => ({ ref: `ref_${n.id}`, data: () => n })),
    });

    const count = await markAllAsRead(USER_ID);

    expect(count).toBe(2);
    expect(mockWriteBatch).toHaveBeenCalled();
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  test("filtra solo las no-leídas del usuario", async () => {
    mockGetDocs.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });

    await markAllAsRead(USER_ID);

    expect(mockWhere).toHaveBeenCalledWith("userId", "==", USER_ID);
    expect(mockWhere).toHaveBeenCalledWith("read", "==", false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// subscribeToNotifications — orden unread-first
// ═══════════════════════════════════════════════════════════════════════════════

describe("subscribeToNotifications — orden unread-first", () => {
  test("las notificaciones no leídas aparecen antes que las leídas", () => {
    const readNotif   = makeNotif("n-read",   true,  200); // más reciente
    const unreadNotif = makeNotif("n-unread", false, 100); // más antigua

    // Firestore nos da: [readNotif (reciente), unreadNotif (antiguo)] — orden por fecha
    mockOnSnapshot.mockImplementationOnce(
      (_q: unknown, callback: (snap: unknown) => void) => {
        callback({
          docs: [
            { id: readNotif.id,   data: () => readNotif   },
            { id: unreadNotif.id, data: () => unreadNotif },
          ],
        });
        return jest.fn(); // unsub
      }
    );

    const received: Notification[][] = [];
    const unsub = subscribeToNotifications(USER_ID, (notifs) => {
      received.push(notifs);
    });

    expect(received).toHaveLength(1);
    // La no-leída debe ir primero aunque sea más antigua
    expect(received[0][0].id).toBe("n-unread");
    expect(received[0][1].id).toBe("n-read");

    unsub();
  });

  test("retorna la función unsubscribe", () => {
    const mockUnsub = jest.fn();
    mockOnSnapshot.mockReturnValueOnce(mockUnsub);

    const unsub = subscribeToNotifications(USER_ID, jest.fn());
    unsub();

    expect(mockUnsub).toHaveBeenCalled();
  });

  test("múltiples no-leídas mantienen su orden por fecha descendente", () => {
    // Tres no-leídas: n3 (más reciente), n2, n1 (más antigua)
    const n1 = makeNotif("n1", false, 100);
    const n2 = makeNotif("n2", false, 200);
    const n3 = makeNotif("n3", false, 300);

    // Firestore ya las devuelve en orden desc: n3, n2, n1
    mockOnSnapshot.mockImplementationOnce(
      (_q: unknown, callback: (snap: unknown) => void) => {
        callback({
          docs: [
            { id: n3.id, data: () => n3 },
            { id: n2.id, data: () => n2 },
            { id: n1.id, data: () => n1 },
          ],
        });
        return jest.fn();
      }
    );

    const received: Notification[][] = [];
    subscribeToNotifications(USER_ID, (notifs) => received.push(notifs));

    // El orden original (ya desc) se conserva porque todas son unread
    expect(received[0].map((n) => n.id)).toEqual(["n3", "n2", "n1"]);
  });
});
