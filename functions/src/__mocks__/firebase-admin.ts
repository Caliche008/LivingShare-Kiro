/**
 * Mock de firebase-admin para pruebas de Cloud Functions.
 * Simula Firestore con Maps en memoria para verificar lógica sin infraestructura real.
 *
 * Colecciones soportadas:
 *   - bills/{billId}
 *   - bills/{billId}/shares/{shareId}  → enrutado a _state.shares
 *   - payments/{paymentId}
 *   - _stripeEvents/{eventId}
 *   - auditLogs  (append-only)
 *   - properties/{propertyId}
 *   - notifications/{notifId}  (append-only, con soporte de idempotencyKey)
 *   - users/{userId}
 *   - questionnaires/{userId}
 *   - matches/{matchId}
 */

// ─── Estado en memoria ────────────────────────────────────────────────────────

export const _state = {
  payments:      new Map<string, Record<string, unknown>>(),
  shares:        new Map<string, Record<string, unknown>>(),
  bills:         new Map<string, Record<string, unknown>>(),
  stripeEvents:  new Map<string, Record<string, unknown>>(),
  properties:    new Map<string, Record<string, unknown>>(),
  notifications: new Map<string, Record<string, unknown>>(),
  users:         new Map<string, Record<string, unknown>>(),
  questionnaires: new Map<string, Record<string, unknown>>(),
  matches:       new Map<string, Record<string, unknown>>(),
  /** Habitaciones publicadas para el collectionGroup de rooms */
  rooms:         new Map<string, Record<string, unknown>>(),
  auditLogs:     [] as Record<string, unknown>[],
};

export function _resetState() {
  _state.payments.clear();
  _state.shares.clear();
  _state.bills.clear();
  _state.stripeEvents.clear();
  _state.properties.clear();
  _state.notifications.clear();
  _state.users.clear();
  _state.questionnaires.clear();
  _state.matches.clear();
  _state.rooms.clear();
  _state.auditLogs = [];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMap(collectionId: string): Map<string, Record<string, unknown>> {
  switch (collectionId) {
    case "payments":       return _state.payments;
    case "shares":         return _state.shares;
    case "bills":          return _state.bills;
    case "_stripeEvents":  return _state.stripeEvents;
    case "properties":     return _state.properties;
    case "notifications":  return _state.notifications;
    case "users":          return _state.users;
    case "questionnaires": return _state.questionnaires;
    case "matches":        return _state.matches;
    case "rooms":          return _state.rooms;
    default:               return new Map(); // descartado
  }
}

// ─── Referencia de documento ──────────────────────────────────────────────────

function makeDocRef(mapName: string, docId: string) {
  const map = getMap(mapName);
  return {
    id: docId,
    async get() {
      const data = map.get(docId);
      return {
        exists: data !== undefined,
        id:     docId,
        data:   () => data,
        ref:    this,
      };
    },
    async set(data: Record<string, unknown>) {
      map.set(docId, { ...data });
    },
    async update(updates: Record<string, unknown>) {
      const existing = map.get(docId) ?? {};
      map.set(docId, { ...existing, ...updates });
    },
  };
}

// ─── Referencia de colección de nivel raíz ────────────────────────────────────

function makeCollectionRef(collectionId: string) {
  const map = getMap(collectionId);

  return {
    doc(docId: string) {
      const docRef = makeDocRef(collectionId, docId);
      return {
        ...docRef,
        // Subcollección: bills/{billId}/shares
        collection(subId: string) {
          // Para bills/{billId}/shares usamos el mapa _state.shares
          const subMapName = collectionId === "bills" && subId === "shares" ? "shares" : subId;
          const subMap = getMap(subMapName);

          return {
            doc(subDocId: string) {
              return makeDocRef(subMapName, subDocId);
            },
            async get() {
              // Retorna todos los shares que pertenecen a este billId
              const docs = [...subMap.entries()]
                .filter(([, d]) => d.billId === docId)
                .map(([sid, d]) => ({
                  id:  sid,
                  ref: makeDocRef(subMapName, sid),
                  data: () => d,
                }));
              return { empty: docs.length === 0, docs };
            },
          };
        },
      };
    },

    async add(data: Record<string, unknown>) {
      const newId = `auto_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      if (collectionId === "auditLogs") {
        _state.auditLogs.push({ id: newId, ...data });
      } else {
        map.set(newId, { ...data });
      }
      return { id: newId };
    },

    // where(...).limit(n).get() — para búsquedas simples por campo==valor o campo in [...]
    where(field: string, op: string, value: unknown) {
      return makeQueryRef(collectionId, [{ field, op, value }]);
    },
  };
}

// ─── Query builder ────────────────────────────────────────────────────────────

interface Filter { field: string; op: string; value: unknown }

function makeQueryRef(collectionId: string, filters: Filter[]) {
  const map = getMap(collectionId);

  function applyFilters(): Array<{ id: string; ref: ReturnType<typeof makeDocRef>; data: () => Record<string, unknown> }> {
    const results: Array<{ id: string; ref: ReturnType<typeof makeDocRef>; data: () => Record<string, unknown> }> = [];
    for (const [id, doc] of map.entries()) {
      const matches = filters.every(({ field, op, value }) => {
        const v = doc[field];
        if (op === "==") return v === value;
        if (op === "in") return Array.isArray(value) && value.includes(v);
        return false;
      });
      if (matches) results.push({ id, ref: makeDocRef(collectionId, id), data: () => doc });
    }
    return results;
  }

  return {
    where(field: string, op: string, value: unknown) {
      return makeQueryRef(collectionId, [...filters, { field, op, value }]);
    },
    limit(n: number) {
      return {
        async get() {
          const docs = applyFilters().slice(0, n);
          return { empty: docs.length === 0, docs };
        },
      };
    },
    async get() {
      const docs = applyFilters();
      return { empty: docs.length === 0, docs };
    },
  };
}

// ─── Batch ────────────────────────────────────────────────────────────────────

function makeBatch() {
  const ops: Array<() => Promise<void>> = [];

  return {
    set(ref: { set: (d: Record<string, unknown>) => Promise<void> }, data: Record<string, unknown>) {
      ops.push(() => ref.set(data));
      return this;
    },
    update(ref: { update: (d: Record<string, unknown>) => Promise<void> }, data: Record<string, unknown>) {
      ops.push(() => ref.update(data));
      return this;
    },
    async commit() {
      for (const op of ops) await op();
      ops.length = 0;
    },
  };
}

// ─── Mock principal de Firestore ──────────────────────────────────────────────

const mockFirestore = {
  collection(id: string) {
    return makeCollectionRef(id);
  },
  batch() {
    return makeBatch();
  },
  /**
   * collectionGroup — simula una consulta a través de subcollecciones.
   * Soporta "rooms": devuelve los documentos de _state.rooms.
   * Para cualquier otro id devuelve una colección vacía.
   */
  collectionGroup(groupId: string) {
    const map = groupId === "rooms" ? _state.rooms : new Map<string, Record<string, unknown>>();
    return {
      where(field: string, op: string, value: unknown) {
        return {
          async get() {
            const docs: Array<{
              id: string;
              ref: ReturnType<typeof makeDocRef>;
              data: () => Record<string, unknown>;
            }> = [];
            for (const [id, doc] of map.entries()) {
              const v = doc[field];
              const matches =
                op === "==" ? v === value :
                op === "in"  ? Array.isArray(value) && value.includes(v) :
                false;
              if (matches) {
                docs.push({ id, ref: makeDocRef(groupId, id), data: () => doc });
              }
            }
            return { empty: docs.length === 0, docs };
          },
        };
      },
    };
  },
  FieldValue: {
    serverTimestamp: () => "SERVER_TS",
  },
};

// ─── Exports del módulo firebase-admin ───────────────────────────────────────

const admin = {
  apps: [] as unknown[],
  firestore: Object.assign(
    jest.fn(() => mockFirestore),
    {
      FieldValue: mockFirestore.FieldValue,
    }
  ),
  initializeApp: jest.fn(),
  app: jest.fn(),
};

(admin.firestore as unknown as jest.Mock).mockReturnValue(mockFirestore);

export default admin;
export const firestore = admin.firestore;
// Named exports para cuando se hace `import * as admin from "firebase-admin"`
export const apps         = admin.apps;
export const initializeApp = admin.initializeApp;
export const app           = admin.app;
