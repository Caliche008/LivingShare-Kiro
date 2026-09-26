import type { Timestamp } from "firebase/firestore";

// ─── Roles ───────────────────────────────────────────────────────────────────

export type UserRole = "owner" | "admin" | "resident" | "visitor";

// ─── Usuarios ────────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  roles: UserRole[];
  questionnaireStatus: "pending" | "in_progress" | "submitted";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Cuestionarios ───────────────────────────────────────────────────────────

export interface QuestionnaireAnswers {
  // Horarios
  sleepSchedule?: "early" | "night_owl" | "flexible";
  workFromHome?: boolean;
  workHours?: "morning" | "afternoon" | "night" | "variable";

  // Limpieza y orden
  cleanlinessLevel?: 1 | 2 | 3 | 4 | 5; // 1=muy relajado, 5=muy estricto
  cleaningFrequency?: "daily" | "weekly" | "biweekly";

  // Ruido
  noiseLevel?: "silent" | "moderate" | "lively";

  // Visitas
  guestsFrequency?: "never" | "rarely" | "sometimes" | "often";
  overnightGuests?: boolean;

  // Mascotas
  hasPets?: boolean;
  petTypes?: string[];
  acceptsPets?: boolean;

  // Hábitos
  smokes?: boolean;
  acceptsSmoking?: boolean;
  drinksAlcohol?: boolean;

  // Presupuesto y mudanza
  maxBudgetCents?: number; // en centavos
  moveInDate?: string; // ISO 8601
  stayDuration?: "short" | "medium" | "long"; // <3m, 3-12m, >12m
}

export interface Questionnaire {
  userId: string;
  answers: QuestionnaireAnswers;
  version: number;
  completedAt?: Timestamp;
  updatedAt: Timestamp;
}

// ─── Propiedades y habitaciones ──────────────────────────────────────────────

export type PropertyStatus = "active" | "archived";

export interface Property {
  id: string;
  ownerId: string;
  managerIds: string[];
  name: string;
  address: string;
  description: string;
  photoURLs: string[];
  totalRooms: number;
  commonAreas: string[];
  status: PropertyStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type RoomStatus = "draft" | "published" | "paused" | "reserved" | "withdrawn";

/** Transiciones de estado permitidas */
export const ROOM_STATUS_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  draft:     ["published"],
  published: ["paused", "reserved"],
  paused:    ["published", "withdrawn"],
  reserved:  ["withdrawn"],
  withdrawn: [],
};

export interface Room {
  id: string;
  propertyId: string;
  title: string;
  description: string;
  priceCents: number; // en centavos
  depositCents: number;
  availableFrom: string; // ISO 8601
  amenities: string[];
  rules: string[];
  photoURLs: string[];
  /** Preferencias de convivencia del propietario para el matching */
  preferences?: Partial<QuestionnaireAnswers>;
  status: RoomStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Matching ────────────────────────────────────────────────────────────────

export type MatchTargetType = "room" | "property" | "user";

export interface Match {
  id: string;
  userId: string;
  targetType: MatchTargetType;
  targetId: string;
  score: number; // 0-100
  factors: MatchFactor[];
  algorithmVersion: string;
  createdAt: Timestamp;
}

export interface MatchFactor {
  criterion: string;
  weight: number;
  similarity: number;
  label: string;
}

// ─── Facturas y reparto ──────────────────────────────────────────────────────

export type BillStatus = "pending" | "split" | "settled";

export interface Bill {
  id: string;
  propertyId: string;
  serviceType: string;
  provider?: string;
  periodStart: string; // ISO 8601
  periodEnd: string;
  dueDate: string;
  totalAmountCents: number; // en centavos
  attachmentPath?: string;
  status: BillStatus;
  createdBy: string;
  splitVersion?: number; // incrementa con cada nuevo reparto
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SplitRule = "equal" | "percentage" | "days_occupied" | "exclude";
export type ShareStatus = "pending" | "paid" | "overdue";

export interface BillShare {
  id: string;
  billId: string;
  residentId: string;
  residentName?: string;
  rule: SplitRule;
  proportion: number; // 0-1
  amountCents: number; // en centavos
  daysOccupied?: number; // solo para rule="days_occupied"
  totalDays?: number;   // solo para rule="days_occupied"
  percentageValue?: number; // 0-100, solo para rule="percentage"
  status: ShareStatus;
  splitVersion: number;
  calculatedAt: Timestamp;
  paidAt?: Timestamp;
}

// ─── Inputs para Cloud Functions ─────────────────────────────────────────────

/** Datos de un residente para calcular su participación */
export interface ResidentSplitInput {
  residentId: string;
  residentName?: string;
  /** Porcentaje (0-100) solo si rule=percentage */
  percentage?: number;
  /** Días ocupados solo si rule=days_occupied */
  daysOccupied?: number;
  /** Si true, se excluye del reparto (rule=exclude a nivel individual) */
  excluded?: boolean;
}

/** Payload para la Cloud Function calculateBillSplit */
export interface BillSplitRequest {
  billId: string;
  rule: SplitRule;
  residents: ResidentSplitInput[];
  /** Total de días del período (requerido para days_occupied) */
  totalDays?: number;
}

// ─── Pagos ───────────────────────────────────────────────────────────────────

export type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "refunded"
  | "canceled";

export interface Payment {
  id: string;
  userId: string;
  billShareId: string;
  billId: string;
  provider: "stripe";
  providerPaymentId: string;
  providerSessionId?: string; // Stripe Checkout Session ID
  amountCents: number;
  currency: string; // ISO 4217, e.g. "mxn"
  status: PaymentStatus;
  idempotencyKey: string; // para evitar pagos duplicados
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Auditoría ───────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}

// ─── Notificaciones ──────────────────────────────────────────────────────────

/**
 * Tipos de notificación soportados.
 * Cada tipo corresponde a un evento de negocio relevante para el usuario.
 */
export type NotificationType =
  | "match_calculated"       // nuevo resultado de compatibilidad
  | "bill_split"             // factura repartida
  | "bill_due_soon"          // factura próxima a vencer (≤3 días)
  | "payment_confirmed"      // pago confirmado por webhook
  | "payment_failed"         // pago fallido
  | "room_status_changed"    // cambio de estado de publicación
  | "admin_request";         // solicitud o actualización administrativa

export interface Notification {
  id: string;
  /** Usuario destinatario */
  userId: string;
  type: NotificationType;
  /** Título corto visible en el panel */
  title: string;
  /** Cuerpo con el detalle */
  body: string;
  /** Ruta Next.js a la que navega al hacer clic, e.g. "/bills/bill-001" */
  actionUrl?: string;
  /** false = no leída (badge rojo), true = ya vista */
  read: boolean;
  /** Referencia al recurso que originó la notificación */
  resourceType?: string;
  resourceId?: string;
  createdAt: Timestamp;
}
