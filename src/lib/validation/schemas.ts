import { z } from "zod";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const registerSchema = z
  .object({
    displayName: z
      .string()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(80, "El nombre no puede superar los 80 caracteres"),
    email: z.string().email("Correo electrónico inválido"),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .regex(/[A-Z]/, "Debe incluir al menos una letra mayúscula")
      .regex(/[0-9]/, "Debe incluir al menos un número"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
});

// ─── Cuestionario ────────────────────────────────────────────────────────────

export const questionnaireSchema = z.object({
  sleepSchedule: z.enum(["early", "night_owl", "flexible"]).optional(),
  workFromHome: z.boolean().optional(),
  workHours: z.enum(["morning", "afternoon", "night", "variable"]).optional(),
  cleanlinessLevel: z.number().int().min(1).max(5).optional(),
  cleaningFrequency: z.enum(["daily", "weekly", "biweekly"]).optional(),
  noiseLevel: z.enum(["silent", "moderate", "lively"]).optional(),
  guestsFrequency: z.enum(["never", "rarely", "sometimes", "often"]).optional(),
  overnightGuests: z.boolean().optional(),
  hasPets: z.boolean().optional(),
  petTypes: z.array(z.string()).optional(),
  acceptsPets: z.boolean().optional(),
  smokes: z.boolean().optional(),
  acceptsSmoking: z.boolean().optional(),
  drinksAlcohol: z.boolean().optional(),
  maxBudgetCents: z.number().int().positive().optional(),
  moveInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional(),
  stayDuration: z.enum(["short", "medium", "long"]).optional(),
});

// ─── Propiedades ─────────────────────────────────────────────────────────────

export const propertySchema = z.object({
  name: z.string().min(2, "El nombre es requerido").max(120),
  address: z.string().min(5, "La dirección es requerida").max(300),
  description: z.string().max(2000).optional(),
  totalRooms: z.number().int().positive("Debe tener al menos 1 habitación"),
  commonAreas: z.array(z.string()).default([]),
});

export const roomSchema = z.object({
  title: z.string().min(2, "El título es requerido").max(120),
  description: z.string().max(2000).optional(),
  priceCents: z.number().int().positive("El precio debe ser positivo"),
  depositCents: z.number().int().min(0),
  availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  amenities: z.array(z.string()).default([]),
  rules: z.array(z.string()).default([]),
  preferences: questionnaireSchema.optional(),
});

// ─── Facturas ────────────────────────────────────────────────────────────────

export const billSchema = z
  .object({
    serviceType: z.string().min(1, "El tipo de servicio es requerido").max(100),
    provider: z.string().max(100).optional(),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    totalAmountCents: z
      .number()
      .int("El monto debe ser un entero en centavos")
      .positive("El monto debe ser positivo"),
  })
  .refine(
    (d) => d.periodEnd >= d.periodStart,
    { message: "La fecha de fin debe ser posterior al inicio", path: ["periodEnd"] }
  )
  .refine(
    (d) => d.dueDate >= d.periodStart,
    { message: "El vencimiento debe ser posterior al inicio del período", path: ["dueDate"] }
  );

// ─── Reparto de facturas ──────────────────────────────────────────────────────

export const residentSplitInputSchema = z.object({
  residentId: z.string().min(1),
  residentName: z.string().optional(),
  percentage: z.number().min(0).max(100).optional(),
  daysOccupied: z.number().int().min(0).optional(),
  excluded: z.boolean().optional(),
});

export const billSplitRequestSchema = z
  .object({
    billId: z.string().min(1, "billId requerido"),
    rule: z.enum(["equal", "percentage", "days_occupied", "exclude"]),
    residents: z
      .array(residentSplitInputSchema)
      .min(1, "Debe haber al menos un residente"),
    totalDays: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    const active = data.residents.filter((r) => !r.excluded);

    if (data.rule === "percentage") {
      const total = active.reduce((sum, r) => sum + (r.percentage ?? 0), 0);
      if (Math.round(total) !== 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Los porcentajes deben sumar 100 (actual: ${total})`,
          path: ["residents"],
        });
      }
    }

    if (data.rule === "days_occupied") {
      if (!data.totalDays || data.totalDays <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "totalDays es requerido para el reparto por días",
          path: ["totalDays"],
        });
      }
      for (const r of active) {
        if (r.daysOccupied === undefined || r.daysOccupied < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `daysOccupied requerido para el residente ${r.residentId}`,
            path: ["residents"],
          });
        }
      }
    }
  });

// ─── Tipos inferidos ─────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type QuestionnaireInput = z.infer<typeof questionnaireSchema>;
export type PropertyInput = z.infer<typeof propertySchema>;
export type RoomInput = z.infer<typeof roomSchema>;
export type BillInput = z.infer<typeof billSchema>;
export type ResidentSplitInput = z.infer<typeof residentSplitInputSchema>;
export type BillSplitRequestInput = z.infer<typeof billSplitRequestSchema>;
