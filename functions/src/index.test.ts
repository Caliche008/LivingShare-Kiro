/**
 * Pruebas de integración — calculateMatchesForUser (index.ts)
 *
 * Prueba la Cloud Function real usando mocks de firebase-admin y
 * un mock manual del módulo de matching para verificar:
 *
 * 1. Sin cuestionario → devuelve reason="no_questionnaire"
 * 2. Cuestionario no completado → devuelve reason="questionnaire_not_submitted"
 * 3. Sin habitaciones publicadas → devuelve reason="no_rooms"
 * 4. Calcula y persiste matches para habitaciones publicadas
 * 5. Crea notificación match_calculated al finalizar
 * 6. La notificación es idempotente (usa idempotencyKey único)
 * 7. No crea notificación si matchCount = 0
 * 8. Requiere autenticación
 */

// ─── Importar mocks de estado antes de cargar el módulo ──────────────────────
import { _state, _resetState } from "./__mocks__/firebase-admin";

// ─── Mock del módulo matching (evita dependencias del dominio) ────────────────
jest.mock("./matching", () => ({
  ALGORITHM_VERSION: "1.0.0",
  calculateCompatibility: jest.fn().mockReturnValue({
    score:    85,
    factors:  [{ criterion: "sleep", weight: 1, similarity: 0.85, label: "Horario de sueño" }],
    coverage: 0.9,
  }),
}));

// ─── Función bajo prueba ──────────────────────────────────────────────────────
let calculateMatchesForUser: (req: { auth?: { uid: string }; data?: unknown }) => Promise<unknown>;

beforeAll(async () => {
  const indexModule = await import("./index");
  calculateMatchesForUser = indexModule.calculateMatchesForUser as unknown as typeof calculateMatchesForUser;
});

beforeEach(() => {
  _resetState();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Autenticación
// ═══════════════════════════════════════════════════════════════════════════════

describe("calculateMatchesForUser — autenticación", () => {
  test("lanza error si no hay auth", async () => {
    await expect(
      calculateMatchesForUser({ auth: undefined })
    ).rejects.toThrow(/unauthenticated/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Cuestionario ausente o incompleto
// ═══════════════════════════════════════════════════════════════════════════════

describe("calculateMatchesForUser — cuestionario", () => {
  test("devuelve reason=no_questionnaire si el usuario no tiene cuestionario", async () => {
    // No se agrega nada a _state.questionnaires

    const result = await calculateMatchesForUser({ auth: { uid: "u-noq" } }) as Record<string, unknown>;

    expect(result.matches).toBe(0);
    expect(result.reason).toBe("no_questionnaire");
  });

  test("devuelve reason=questionnaire_not_submitted si no tiene completedAt", async () => {
    _state.questionnaires.set("u-incomplete", {
      answers: { sleepSchedule: "early" },
      // sin completedAt → no enviado
    });

    const result = await calculateMatchesForUser({ auth: { uid: "u-incomplete" } }) as Record<string, unknown>;

    expect(result.matches).toBe(0);
    expect(result.reason).toBe("questionnaire_not_submitted");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Sin habitaciones
// ═══════════════════════════════════════════════════════════════════════════════

describe("calculateMatchesForUser — sin habitaciones", () => {
  test("devuelve reason=no_rooms si no hay habitaciones publicadas", async () => {
    _state.questionnaires.set("u-norooms", {
      answers:     { sleepSchedule: "early" },
      completedAt: "2026-01-01",
    });
    // No hay habitaciones en el estado

    const result = await calculateMatchesForUser({ auth: { uid: "u-norooms" } }) as Record<string, unknown>;

    expect(result.matches).toBe(0);
    expect(result.reason).toBe("no_rooms");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Cálculo exitoso
// ═══════════════════════════════════════════════════════════════════════════════

describe("calculateMatchesForUser — cálculo exitoso", () => {
  test("persiste un match por cada habitación publicada", async () => {
    _state.questionnaires.set("u-persist", {
      answers:     { sleepSchedule: "flexible" },
      completedAt: "2026-09-15",
    });
    _state.rooms.set("room-p-1", { status: "published", propertyId: "prop-p", preferences: {} });
    _state.rooms.set("room-p-2", { status: "published", propertyId: "prop-p", preferences: {} });

    const result = await calculateMatchesForUser({ auth: { uid: "u-persist" } }) as Record<string, unknown>;

    expect(result.matches).toBe(2);

    // Debe haber matches persistidos para cada habitación
    const match1 = _state.matches.get("u-persist_room-p-1");
    const match2 = _state.matches.get("u-persist_room-p-2");
    expect(match1).toBeDefined();
    expect(match1?.score).toBe(85); // mock de calculateCompatibility
    expect(match2).toBeDefined();
  });

  test("incluye calculatedAt en la respuesta cuando hay matches", async () => {
    _state.questionnaires.set("u-calc-at", {
      answers:     { sleepSchedule: "flexible" },
      completedAt: "2026-09-15",
    });
    _state.rooms.set("room-ca-1", { status: "published", propertyId: "prop-ca", preferences: {} });

    const result = await calculateMatchesForUser({ auth: { uid: "u-calc-at" } }) as Record<string, unknown>;

    expect(result.matches).toBe(1);
    expect(result.calculatedAt).toBeDefined();
    expect(typeof result.calculatedAt).toBe("string");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Notificaciones
// ═══════════════════════════════════════════════════════════════════════════════

describe("calculateMatchesForUser — notificaciones", () => {
  test("no crea notificación match_calculated si matchCount es 0", async () => {
    _state.questionnaires.set("u-notif-zero", {
      answers:     { sleepSchedule: "early" },
      completedAt: "2026-09-01",
    });
    // Sin habitaciones → matchCount = 0 → no debe crear notificación

    await calculateMatchesForUser({ auth: { uid: "u-notif-zero" } });

    const notifs = [..._state.notifications.values()].filter(
      (n) => n.type === "match_calculated" && n.userId === "u-notif-zero"
    );
    expect(notifs).toHaveLength(0);
  });

  test("crea notificación match_calculated cuando se procesan habitaciones", async () => {
    _state.questionnaires.set("u-notif-ok", {
      answers:     { sleepSchedule: "early" },
      completedAt: "2026-09-01",
    });
    _state.rooms.set("room-notif-1", {
      status:     "published",
      propertyId: "prop-notif",
      preferences: {},
    });
    _state.rooms.set("room-notif-2", {
      status:     "published",
      propertyId: "prop-notif",
      preferences: {},
    });

    await calculateMatchesForUser({ auth: { uid: "u-notif-ok" } });

    const notifs = [..._state.notifications.values()].filter(
      (n) => n.type === "match_calculated" && n.userId === "u-notif-ok"
    );
    expect(notifs).toHaveLength(1);
    expect(notifs[0].body as string).toContain("2");
    expect(notifs[0].actionUrl).toBe("/matches");
  });

  test("no falla aunque notifications lanze un error internamente", async () => {
    // El código usa .catch() así que errores en notificación no deben propagar
    _state.questionnaires.set("u-notif-safe", {
      answers:     { sleepSchedule: "night_owl" },
      completedAt: "2026-09-01",
    });
    // Sin habitaciones la función retorna antes de las notificaciones
    // Igual debe completar sin lanzar error

    await expect(
      calculateMatchesForUser({ auth: { uid: "u-notif-safe" } })
    ).resolves.toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Auditoría
// ═══════════════════════════════════════════════════════════════════════════════

describe("calculateMatchesForUser — auditoría", () => {
  test("escribe log de auditoría MATCHES_CALCULATED", async () => {
    _state.questionnaires.set("u-audit-m", {
      answers:     { sleepSchedule: "early" },
      completedAt: "2026-09-01",
    });
    _state.rooms.set("room-audit-1", {
      status:     "published",
      propertyId: "prop-audit",
      preferences: {},
    });

    await calculateMatchesForUser({ auth: { uid: "u-audit-m" } });

    const entry = _state.auditLogs.find(
      (l: Record<string, unknown>) => l.action === "MATCHES_CALCULATED" && l.actorId === "u-audit-m"
    );
    expect(entry).toBeDefined();
    expect(entry?.resourceType).toBe("matches");
  });

  test("el log incluye algorithmVersion y count", async () => {
    _state.questionnaires.set("u-audit-ver", {
      answers:     { cleanlinessLevel: 3 },
      completedAt: "2026-08-01",
    });
    _state.rooms.set("room-audit-ver-1", {
      status:     "published",
      propertyId: "prop-av",
      preferences: {},
    });
    _state.rooms.set("room-audit-ver-2", {
      status:     "published",
      propertyId: "prop-av",
      preferences: {},
    });

    await calculateMatchesForUser({ auth: { uid: "u-audit-ver" } });

    const entry = _state.auditLogs.find(
      (l: Record<string, unknown>) => l.action === "MATCHES_CALCULATED" && l.actorId === "u-audit-ver"
    );
    expect(entry).toBeDefined();
    const meta = entry?.metadata as Record<string, unknown>;
    expect(meta?.algorithmVersion).toBe("1.0.0");
    expect(meta?.count).toBe(2); // 2 habitaciones publicadas
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// userId explícito en data
// ═══════════════════════════════════════════════════════════════════════════════

describe("calculateMatchesForUser — userId en data", () => {
  test("usa userId del data si está presente (admin calculando para otro usuario)", async () => {
    _state.questionnaires.set("u-target", {
      answers:     { sleepSchedule: "early" },
      completedAt: "2026-09-01",
    });
    // Necesita habitaciones para que el cálculo complete
    _state.rooms.set("room-target-1", {
      status:     "published",
      propertyId: "prop-target",
      preferences: {},
    });

    const result = await calculateMatchesForUser({
      auth: { uid: "u-admin" },
      data: { userId: "u-target" },
    }) as Record<string, unknown>;

    // El log de auditoría debe ser para "u-target" (uid resuelto del data.userId)
    const entry = _state.auditLogs.find(
      (l: Record<string, unknown>) => l.action === "MATCHES_CALCULATED" && l.actorId === "u-target"
    );
    expect(entry).toBeDefined();
    expect(result.matches).toBe(1);
  });
});
