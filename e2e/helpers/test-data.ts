/**
 * e2e/helpers/test-data.ts
 *
 * Datos de prueba centralizados para todos los tests E2E de LivingShare.
 * Las credenciales apuntan al Firebase Emulator (no a producción).
 *
 * Para usar con el emulador, asegúrate de que está corriendo:
 *   firebase emulators:start --only auth,firestore,storage,functions
 *
 * Usuario E2E dedicado: se crea en auth.setup.ts si no existe.
 */

/** Cuenta de prueba E2E — solo existe en el emulador */
export const TEST_USER = {
  email: "e2e-test@livingshare.test",
  password: "TestPass123!",
  displayName: "Usuario E2E",
} as const;

/** Cuenta adicional para flujos de propietario */
export const OWNER_USER = {
  email: "e2e-owner@livingshare.test",
  password: "OwnerPass123!",
  displayName: "Propietario E2E",
} as const;

/** Datos de propiedad de prueba */
export const TEST_PROPERTY = {
  name: "Propiedad E2E Test",
  address: "Calle Prueba 123, Ciudad de México",
  type: "apartment",
  totalRooms: 3,
} as const;

/** Datos de habitación de prueba */
export const TEST_ROOM = {
  name: "Habitación Principal E2E",
  description: "Habitación de prueba para tests E2E",
  price: 5000,
  deposit: 10000,
  area: 15,
} as const;

/** Datos de factura de prueba */
export const TEST_BILL = {
  title: "Internet - Octubre E2E",
  amount: 60000, // 600.00 MXN en centavos — se muestra como $600
  category: "internet",
  description: "Factura de internet mes de prueba E2E",
  dueDate: "2026-12-31",
} as const;

/** Respuestas del cuestionario de compatibilidad */
export const TEST_QUESTIONNAIRE = {
  sleepSchedule: "night_owl",         // trasnochador
  cleanlinessLevel: "moderately_clean",
  noiseLevel: "moderate",
  hasPets: "false",
  smokes: "false",
  guestFrequency: "occasionally",
  workSchedule: "remote",
  budgetMin: "3000",
  budgetMax: "7000",
} as const;

/** Rutas principales de la aplicación */
export const ROUTES = {
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  dashboard: "/dashboard",
  questionnaire: "/questionnaire",
  matches: "/matches",
  properties: "/properties",
  bills: "/bills",
  notifications: "/notifications",
  profile: "/profile",
} as const;

/** Tiempo máximo de espera para operaciones con Firebase (ms) */
export const FIREBASE_TIMEOUT = 15_000;
