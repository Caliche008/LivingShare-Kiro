/**
 * schemas.test.ts — Pruebas de validación Zod para todos los schemas del proyecto
 *
 * Cubre:
 *   registerSchema       — registro de usuario
 *   loginSchema          — inicio de sesión
 *   resetPasswordSchema  — recuperación de contraseña
 *   questionnaireSchema  — cuestionario de compatibilidad
 *   propertySchema       — propiedades
 *   roomSchema           — habitaciones
 *   billSchema           — facturas (con refinements de fechas)
 *   billSplitRequestSchema — reparto (con superRefine de reglas)
 */

import {
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  questionnaireSchema,
  propertySchema,
  roomSchema,
  billSchema,
  billSplitRequestSchema,
} from "./schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// registerSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe("registerSchema", () => {
  const valid = {
    displayName:     "María López",
    email:           "maria@example.com",
    password:        "Segura123",
    confirmPassword: "Segura123",
  };

  test("acepta datos válidos", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  test("rechaza nombre demasiado corto", () => {
    const r = registerSchema.safeParse({ ...valid, displayName: "A" });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("2 caracteres");
  });

  test("rechaza nombre demasiado largo (>80 chars)", () => {
    const r = registerSchema.safeParse({ ...valid, displayName: "A".repeat(81) });
    expect(r.success).toBe(false);
  });

  test("rechaza email inválido", () => {
    const r = registerSchema.safeParse({ ...valid, email: "no-es-email" });
    expect(r.success).toBe(false);
  });

  test("rechaza contraseña sin mayúscula", () => {
    const r = registerSchema.safeParse({ ...valid, password: "segura123", confirmPassword: "segura123" });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("mayúscula");
  });

  test("rechaza contraseña sin número", () => {
    const r = registerSchema.safeParse({ ...valid, password: "Seguraaaa", confirmPassword: "Seguraaaa" });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("número");
  });

  test("rechaza contraseña menor a 8 caracteres", () => {
    const r = registerSchema.safeParse({ ...valid, password: "Seg1", confirmPassword: "Seg1" });
    expect(r.success).toBe(false);
  });

  test("rechaza contraseñas que no coinciden", () => {
    const r = registerSchema.safeParse({ ...valid, confirmPassword: "OtraContraseña1" });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("no coinciden");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// loginSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe("loginSchema", () => {
  test("acepta email y contraseña válidos", () => {
    expect(loginSchema.safeParse({ email: "u@x.com", password: "abc" }).success).toBe(true);
  });

  test("rechaza email inválido", () => {
    expect(loginSchema.safeParse({ email: "noemail", password: "abc" }).success).toBe(false);
  });

  test("rechaza contraseña vacía", () => {
    expect(loginSchema.safeParse({ email: "u@x.com", password: "" }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// resetPasswordSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe("resetPasswordSchema", () => {
  test("acepta email válido", () => {
    expect(resetPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });

  test("rechaza email inválido", () => {
    expect(resetPasswordSchema.safeParse({ email: "nomail" }).success).toBe(false);
  });

  test("rechaza email vacío", () => {
    expect(resetPasswordSchema.safeParse({ email: "" }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// questionnaireSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe("questionnaireSchema", () => {
  test("acepta objeto vacío (todos los campos son opcionales)", () => {
    expect(questionnaireSchema.safeParse({}).success).toBe(true);
  });

  test("acepta respuestas completas válidas", () => {
    const r = questionnaireSchema.safeParse({
      sleepSchedule:     "early",
      workFromHome:      true,
      workHours:         "morning",
      cleanlinessLevel:  4,
      cleaningFrequency: "weekly",
      noiseLevel:        "moderate",
      guestsFrequency:   "rarely",
      overnightGuests:   false,
      hasPets:           false,
      acceptsPets:       true,
      smokes:            false,
      acceptsSmoking:    false,
      drinksAlcohol:     true,
      maxBudgetCents:    500000,
      moveInDate:        "2026-10-01",
      stayDuration:      "medium",
    });
    expect(r.success).toBe(true);
  });

  test("rechaza sleepSchedule con valor desconocido", () => {
    const r = questionnaireSchema.safeParse({ sleepSchedule: "afternoon" });
    expect(r.success).toBe(false);
  });

  test("rechaza cleanlinessLevel fuera de rango (0)", () => {
    const r = questionnaireSchema.safeParse({ cleanlinessLevel: 0 });
    expect(r.success).toBe(false);
  });

  test("rechaza cleanlinessLevel fuera de rango (6)", () => {
    const r = questionnaireSchema.safeParse({ cleanlinessLevel: 6 });
    expect(r.success).toBe(false);
  });

  test("rechaza cleanlinessLevel no entero", () => {
    const r = questionnaireSchema.safeParse({ cleanlinessLevel: 2.5 });
    expect(r.success).toBe(false);
  });

  test("rechaza moveInDate con formato inválido", () => {
    const r = questionnaireSchema.safeParse({ moveInDate: "01-10-2026" });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("inválida");
  });

  test("rechaza maxBudgetCents negativo", () => {
    const r = questionnaireSchema.safeParse({ maxBudgetCents: -100 });
    expect(r.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// propertySchema
// ═══════════════════════════════════════════════════════════════════════════════

describe("propertySchema", () => {
  const valid = {
    name:        "Casa Condesa",
    address:     "Calle Ámsterdam 123, CDMX",
    description: "Propiedad amplia cerca del parque",
    totalRooms:  3,
    commonAreas: ["cocina", "sala"],
  };

  test("acepta datos válidos", () => {
    expect(propertySchema.safeParse(valid).success).toBe(true);
  });

  test("acepta sin descripción y sin commonAreas (usan defaults)", () => {
    const r = propertySchema.safeParse({
      name: "Mi Casa", address: "Calle X 10, CDMX", totalRooms: 1,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.commonAreas).toEqual([]);
    }
  });

  test("rechaza nombre demasiado corto", () => {
    const r = propertySchema.safeParse({ ...valid, name: "A" });
    expect(r.success).toBe(false);
  });

  test("rechaza dirección demasiado corta", () => {
    const r = propertySchema.safeParse({ ...valid, address: "abc" });
    expect(r.success).toBe(false);
  });

  test("rechaza totalRooms de 0", () => {
    const r = propertySchema.safeParse({ ...valid, totalRooms: 0 });
    expect(r.success).toBe(false);
  });

  test("rechaza totalRooms negativo", () => {
    const r = propertySchema.safeParse({ ...valid, totalRooms: -2 });
    expect(r.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// roomSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe("roomSchema", () => {
  const valid = {
    title:         "Habitación principal",
    description:   "Con baño propio y vista al jardín",
    priceCents:    1500000,
    depositCents:  1500000,
    availableFrom: "2026-10-01",
    amenities:     ["wifi", "calefacción"],
    rules:         ["no mascotas"],
  };

  test("acepta habitación válida", () => {
    expect(roomSchema.safeParse(valid).success).toBe(true);
  });

  test("acepta sin amenities y reglas (defaults a [])", () => {
    const r = roomSchema.safeParse({
      title: "Cuarto", priceCents: 500000, depositCents: 0, availableFrom: "2026-11-01",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.amenities).toEqual([]);
      expect(r.data.rules).toEqual([]);
    }
  });

  test("rechaza priceCents de 0", () => {
    const r = roomSchema.safeParse({ ...valid, priceCents: 0 });
    expect(r.success).toBe(false);
  });

  test("rechaza priceCents negativo", () => {
    const r = roomSchema.safeParse({ ...valid, priceCents: -500 });
    expect(r.success).toBe(false);
  });

  test("rechaza depositCents negativo", () => {
    const r = roomSchema.safeParse({ ...valid, depositCents: -1 });
    expect(r.success).toBe(false);
  });

  test("rechaza availableFrom con formato inválido", () => {
    const r = roomSchema.safeParse({ ...valid, availableFrom: "2026/10/01" });
    expect(r.success).toBe(false);
  });

  test("rechaza título vacío", () => {
    const r = roomSchema.safeParse({ ...valid, title: "A" });
    expect(r.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// billSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe("billSchema", () => {
  const valid = {
    serviceType:      "Electricidad",
    provider:         "CFE",
    periodStart:      "2026-01-01",
    periodEnd:        "2026-01-31",
    dueDate:          "2026-02-15",
    totalAmountCents: 85000,
  };

  test("acepta factura válida", () => {
    expect(billSchema.safeParse(valid).success).toBe(true);
  });

  test("acepta sin provider (opcional)", () => {
    const { provider: _provider, ...noProvider } = valid;
    expect(billSchema.safeParse(noProvider).success).toBe(true);
  });

  test("rechaza periodEnd anterior a periodStart", () => {
    const r = billSchema.safeParse({
      ...valid,
      periodEnd: "2025-12-31",
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("posterior");
  });

  test("rechaza dueDate anterior a periodStart", () => {
    const r = billSchema.safeParse({
      ...valid,
      dueDate: "2025-12-01",
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("posterior");
  });

  test("rechaza totalAmountCents de 0", () => {
    const r = billSchema.safeParse({ ...valid, totalAmountCents: 0 });
    expect(r.success).toBe(false);
  });

  test("rechaza totalAmountCents negativo", () => {
    const r = billSchema.safeParse({ ...valid, totalAmountCents: -100 });
    expect(r.success).toBe(false);
  });

  test("rechaza totalAmountCents con decimales (debe ser entero)", () => {
    const r = billSchema.safeParse({ ...valid, totalAmountCents: 100.5 });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("entero");
  });

  test("rechaza serviceType vacío", () => {
    const r = billSchema.safeParse({ ...valid, serviceType: "" });
    expect(r.success).toBe(false);
  });

  test("acepta periodEnd igual a periodStart (mismo día)", () => {
    const r = billSchema.safeParse({
      ...valid,
      periodEnd: "2026-01-01",
      dueDate:   "2026-01-15",
    });
    expect(r.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// billSplitRequestSchema
// ═══════════════════════════════════════════════════════════════════════════════

describe("billSplitRequestSchema — rule=equal", () => {
  const base = {
    billId:    "bill-001",
    rule:      "equal" as const,
    residents: [{ residentId: "r1" }, { residentId: "r2" }],
  };

  test("acepta reparto igual con 2 residentes", () => {
    expect(billSplitRequestSchema.safeParse(base).success).toBe(true);
  });

  test("rechaza sin residentes", () => {
    const r = billSplitRequestSchema.safeParse({ ...base, residents: [] });
    expect(r.success).toBe(false);
  });

  test("rechaza billId vacío", () => {
    const r = billSplitRequestSchema.safeParse({ ...base, billId: "" });
    expect(r.success).toBe(false);
  });

  test("rechaza rule desconocida", () => {
    const r = billSplitRequestSchema.safeParse({ ...base, rule: "unknown" });
    expect(r.success).toBe(false);
  });
});

describe("billSplitRequestSchema — rule=percentage", () => {
  test("acepta cuando los porcentajes suman 100", () => {
    const r = billSplitRequestSchema.safeParse({
      billId:    "bill-002",
      rule:      "percentage",
      residents: [
        { residentId: "r1", percentage: 60 },
        { residentId: "r2", percentage: 40 },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("rechaza cuando los porcentajes no suman 100 (suma=90)", () => {
    const r = billSplitRequestSchema.safeParse({
      billId:    "bill-003",
      rule:      "percentage",
      residents: [
        { residentId: "r1", percentage: 50 },
        { residentId: "r2", percentage: 40 },
      ],
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("100");
  });

  test("los excluidos no cuentan en la suma de porcentajes", () => {
    const r = billSplitRequestSchema.safeParse({
      billId:    "bill-004",
      rule:      "percentage",
      residents: [
        { residentId: "r1", percentage: 100 },
        { residentId: "r2", excluded: true }, // excluido, no suma
      ],
    });
    expect(r.success).toBe(true);
  });

  test("rechaza porcentaje mayor a 100 en un residente", () => {
    const r = billSplitRequestSchema.safeParse({
      billId:    "bill-005",
      rule:      "percentage",
      residents: [{ residentId: "r1", percentage: 110 }],
    });
    expect(r.success).toBe(false);
  });
});

describe("billSplitRequestSchema — rule=days_occupied", () => {
  test("acepta con totalDays y daysOccupied válidos", () => {
    const r = billSplitRequestSchema.safeParse({
      billId:    "bill-006",
      rule:      "days_occupied",
      totalDays: 30,
      residents: [
        { residentId: "r1", daysOccupied: 20 },
        { residentId: "r2", daysOccupied: 10 },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("rechaza sin totalDays", () => {
    const r = billSplitRequestSchema.safeParse({
      billId:    "bill-007",
      rule:      "days_occupied",
      residents: [{ residentId: "r1", daysOccupied: 15 }],
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("totalDays");
  });

  test("rechaza totalDays de 0", () => {
    const r = billSplitRequestSchema.safeParse({
      billId:    "bill-008",
      rule:      "days_occupied",
      totalDays: 0,
      residents: [{ residentId: "r1", daysOccupied: 0 }],
    });
    expect(r.success).toBe(false);
  });

  test("rechaza residente sin daysOccupied", () => {
    const r = billSplitRequestSchema.safeParse({
      billId:    "bill-009",
      rule:      "days_occupied",
      totalDays: 30,
      residents: [
        { residentId: "r1", daysOccupied: 20 },
        { residentId: "r2" }, // sin daysOccupied
      ],
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("daysOccupied");
  });

  test("los excluidos no necesitan daysOccupied", () => {
    const r = billSplitRequestSchema.safeParse({
      billId:    "bill-010",
      rule:      "days_occupied",
      totalDays: 30,
      residents: [
        { residentId: "r1", daysOccupied: 30 },
        { residentId: "r2", excluded: true }, // excluido, no se valida
      ],
    });
    expect(r.success).toBe(true);
  });
});

describe("billSplitRequestSchema — rule=exclude", () => {
  test("acepta reparto con excluidos", () => {
    const r = billSplitRequestSchema.safeParse({
      billId:    "bill-011",
      rule:      "exclude",
      residents: [
        { residentId: "r1" },
        { residentId: "r2", excluded: true },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("no requiere campos especiales para rule=exclude", () => {
    const r = billSplitRequestSchema.safeParse({
      billId:    "bill-012",
      rule:      "exclude",
      residents: [{ residentId: "r1" }],
    });
    expect(r.success).toBe(true);
  });
});
