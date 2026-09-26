/**
 * e2e/auth.setup.ts
 *
 * Setup global de autenticación para Playwright.
 * Se ejecuta UNA VEZ antes de todos los tests y guarda el estado
 * de sesión en e2e/.auth/user.json para que los demás proyectos
 * lo reutilicen sin tener que hacer login en cada test.
 *
 * Estrategia:
 * 1. Intenta registrar el usuario de prueba (puede fallar si ya existe → ok)
 * 2. Hace login con las credenciales de prueba
 * 3. Verifica que llegamos al dashboard (sesión válida)
 * 4. Guarda el storageState (cookies + localStorage) en .auth/user.json
 *
 * NOTA: Este archivo se ejecuta como proyecto "setup" separado en
 * playwright.config.ts. No es un test normal.
 */

import { test as setup, expect } from "@playwright/test";
import * as path from "path";
import { TEST_USER } from "./helpers/test-data";

const AUTH_FILE = path.join(__dirname, ".auth", "user.json");

setup("autenticar usuario E2E", async ({ page }) => {
  // ── Paso 1: intentar registro (si el usuario no existe aún) ────────────
  await page.goto("/register");
  await page.waitForLoadState("networkidle");

  // Solo registrar si la página de registro está disponible
  const isRegisterPage =
    (await page.locator("#displayName").count()) > 0;

  if (isRegisterPage) {
    await page.locator("#displayName").fill(TEST_USER.displayName);
    await page.locator("#email").fill(TEST_USER.email);
    await page.locator("#password").fill(TEST_USER.password);
    await page.locator("#confirmPassword").fill(TEST_USER.password);
    await page.getByRole("button", { name: /crear cuenta/i }).click();

    // Esperar la redirección al dashboard o el error "ya existe"
    await Promise.race([
      page.waitForURL("**/dashboard", { timeout: 15_000 }),
      page.getByRole("alert").waitFor({ timeout: 8_000 }),
    ]).catch(() => {
      // Si ninguno ocurre en el tiempo, continuamos (puede ser lento)
    });
  }

  // ── Paso 2: ir a login si no estamos en el dashboard ───────────────────
  const currentUrl = page.url();
  if (!currentUrl.includes("/dashboard")) {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.locator("#email").fill(TEST_USER.email);
    await page.locator("#password").fill(TEST_USER.password);
    await page.getByRole("button", { name: /ingresar/i }).click();

    // Esperar redirección al dashboard
    await page.waitForURL("**/dashboard", { timeout: 20_000 });
  }

  // ── Paso 3: verificar que la sesión es válida ──────────────────────────
  await expect(page).toHaveURL(/\/dashboard/);

  // El dashboard debe tener contenido (no redirigir a login otra vez)
  await expect(
    page.getByRole("heading").or(page.locator("main"))
  ).toBeVisible({ timeout: 10_000 });

  // ── Paso 4: guardar el estado de sesión ───────────────────────────────
  await page.context().storageState({ path: AUTH_FILE });

  console.log(`✅ Sesión E2E guardada en ${AUTH_FILE}`);
});
