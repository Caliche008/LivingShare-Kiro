/**
 * e2e/tests/01-registro.spec.ts
 *
 * Flujo E2E: Registro de usuario
 *
 * Cubre:
 *  - Acceso a la página de registro
 *  - Validaciones del formulario (campos vacíos, contraseñas no coinciden, email inválido)
 *  - Registro exitoso con email único → redirección al dashboard
 *  - Intento de registro con email ya existente → mensaje de error
 *  - Navegación hacia login y forgot-password
 *
 * NOTA: Estos tests NO usan la sesión persistida (storageState) porque
 * su propósito es probar el flujo de registro sin estar autenticado.
 * Por eso no figuran en el proyecto "chromium" que usa storageState —
 * se anotan con use: { storageState: undefined }.
 */

import { test, expect } from "../helpers/fixtures";
import { ROUTES } from "../helpers/test-data";

// Sobrescribir storageState para este archivo (tests sin sesión)
test.use({ storageState: { cookies: [], origins: [] } });

// ── Utilidad: email único por ejecución ──────────────────────────────────────
function uniqueEmail(): string {
  return `test-register-${Date.now()}@livingshare.test`;
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("Flujo de registro", () => {
  test("muestra la página de registro correctamente", async ({ registerPage }) => {
    await registerPage.goto();

    // Cabecera con el nombre de la app
    await expect(registerPage.page.getByText("LivingShare")).toBeVisible();

    // Todos los campos están presentes
    await expect(registerPage.displayNameInput).toBeVisible();
    await expect(registerPage.emailInput).toBeVisible();
    await expect(registerPage.passwordInput).toBeVisible();
    await expect(registerPage.confirmPasswordInput).toBeVisible();
    await expect(registerPage.submitButton).toBeVisible();

    // Link a login
    await expect(registerPage.loginLink).toBeVisible();
  });

  test("muestra errores si el formulario se envía vacío", async ({
    registerPage,
  }) => {
    await registerPage.goto();
    await registerPage.submitButton.click();

    // Deben aparecer mensajes de validación
    const errors = registerPage.page.locator("[id$='-error'], .text-red-600");
    await expect(errors.first()).toBeVisible();
  });

  test("valida que las contraseñas coincidan", async ({ registerPage }) => {
    await registerPage.goto();

    await registerPage.displayNameInput.fill("Test User");
    await registerPage.emailInput.fill(uniqueEmail());
    await registerPage.passwordInput.fill("ValidPass123!");
    await registerPage.confirmPasswordInput.fill("DiferentPass456!");
    await registerPage.submitButton.click();

    // Debe mostrar error de contraseñas no coinciden
    await expect(
      registerPage.page.getByText(/contraseñas no coinciden|no coincide/i)
    ).toBeVisible();
  });

  test("valida formato de email incorrecto", async ({ registerPage }) => {
    await registerPage.goto();

    await registerPage.displayNameInput.fill("Test User");
    await registerPage.emailInput.fill("no-es-un-email");
    await registerPage.passwordInput.fill("ValidPass123!");
    await registerPage.confirmPasswordInput.fill("ValidPass123!");
    await registerPage.submitButton.click();

    // Error de formato de email
    await expect(
      registerPage.page.getByText(/email|correo.*válido|inválido/i)
    ).toBeVisible();
  });

  test("valida contraseña demasiado corta", async ({ registerPage }) => {
    await registerPage.goto();

    await registerPage.displayNameInput.fill("Test User");
    await registerPage.emailInput.fill(uniqueEmail());
    await registerPage.passwordInput.fill("123");
    await registerPage.confirmPasswordInput.fill("123");
    await registerPage.submitButton.click();

    // Error de longitud mínima de contraseña
    await expect(
      registerPage.page.getByText(/caracteres|contraseña.*corta|mínimo/i)
    ).toBeVisible();
  });

  test("registro exitoso redirige al dashboard", async ({ registerPage, page }) => {
    await registerPage.goto();

    const email = uniqueEmail();
    await registerPage.register("Usuario Registro E2E", email, "ValidPass123!");

    // Esperar la redirección al dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    // El dashboard debe cargarse correctamente
    await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
  });

  test("muestra error si el email ya está registrado", async ({
    registerPage,
  }) => {
    await registerPage.goto();

    // Usar un email que ya existe (el usuario E2E creado en auth.setup.ts)
    await registerPage.register(
      "Usuario Duplicado",
      "e2e-test@livingshare.test",
      "ValidPass123!"
    );

    // Esperar el mensaje de error del servidor
    await expect(registerPage.serverError).toBeVisible({ timeout: 10_000 });
    await expect(registerPage.serverError).toContainText(
      /ya existe|en uso|registrado/i
    );
  });

  test("el link 'ya tienes cuenta' lleva al login", async ({ registerPage, page }) => {
    await registerPage.goto();
    await registerPage.loginLink.click();

    await expect(page).toHaveURL(new RegExp(ROUTES.login));
  });
});

test.describe("Flujo de login", () => {
  test("muestra la página de login correctamente", async ({ loginPage }) => {
    await loginPage.goto();

    await expect(loginPage.page.getByText("LivingShare")).toBeVisible();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
    await expect(loginPage.registerLink).toBeVisible();
    await expect(loginPage.forgotPasswordLink).toBeVisible();
  });

  test("muestra error con credenciales incorrectas", async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login("nadie@livingshare.test", "ContraseñaWrong123!");

    await expect(loginPage.serverError).toBeVisible({ timeout: 10_000 });
    await expect(loginPage.serverError).toContainText(
      /incorrecto|inválido|no encontrado/i
    );
  });

  test("login exitoso redirige al dashboard", async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.login("e2e-test@livingshare.test", "TestPass123!");

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    await expect(page.locator("main")).toBeVisible();
  });

  test("el link 'olvidaste contraseña' lleva a forgot-password", async ({
    loginPage,
    page,
  }) => {
    await loginPage.goto();
    await loginPage.forgotPasswordLink.click();

    await expect(page).toHaveURL(new RegExp(ROUTES.forgotPassword));
  });

  test("el link 'regístrate' lleva al registro", async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.registerLink.click();

    await expect(page).toHaveURL(new RegExp(ROUTES.register));
  });
});
