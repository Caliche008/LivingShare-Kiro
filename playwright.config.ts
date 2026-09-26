import { defineConfig, devices } from "@playwright/test";

/**
 * Configuración de Playwright para LivingShare.
 *
 * Los tests E2E corren contra la app levantada localmente (next start o next dev).
 * Playwright levanta el servidor automáticamente antes de la suite y lo apaga al terminar.
 *
 * Variables de entorno relevantes:
 *   BASE_URL   – URL del servidor Next.js (por defecto http://localhost:3000)
 *   CI         – desactiva headed y paralelismo en pipelines de CI
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/test-results",

  /* Cada test tiene un timeout de 30 s; la acción individual 10 s */
  timeout: 30_000,
  expect: { timeout: 10_000 },

  /* Reintentar solo en CI */
  retries: process.env.CI ? 2 : 0,

  /* En local se ejecutan en serie para que los tests que comparten estado de
     Firebase Emulator no choquen. En CI, paralelo por archivo. */
  workers: process.env.CI ? "50%" : 1,

  reporter: [
    ["list"],
    ["html", { outputFolder: "e2e/playwright-report", open: "never" }],
  ],

  use: {
    baseURL: BASE_URL,
    /* Capturas en caso de fallo */
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    /* Locale español para que los mensajes de validación coincidan */
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
  },

  projects: [
    /* ── Paso 0: setup de autenticación ──────────────────────────────────
       Crea los ficheros de estado de sesión que reutilizan los demás tests.
       Se ejecuta en serie y siempre antes que cualquier otro proyecto. */
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    /* ── Tests principales en Chrome ─────────────────────────────────── */
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        /* Reutiliza la sesión autenticada creada en "setup" */
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },

    /* ── Tests en Firefox (solo en CI) ───────────────────────────────── */
    ...(process.env.CI
      ? [
          {
            name: "firefox",
            use: {
              ...devices["Desktop Firefox"],
              storageState: "e2e/.auth/user.json",
            },
            dependencies: ["setup"],
            testIgnore: /auth\.setup\.ts/,
          },
        ]
      : []),

    /* ── Tests móvil (solo en CI) ────────────────────────────────────── */
    ...(process.env.CI
      ? [
          {
            name: "mobile-chrome",
            use: {
              ...devices["Pixel 5"],
              storageState: "e2e/.auth/user.json",
            },
            dependencies: ["setup"],
            testIgnore: /auth\.setup\.ts/,
          },
        ]
      : []),
  ],

  /* Levanta Next.js antes de los tests si no hay un servidor corriendo */
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
