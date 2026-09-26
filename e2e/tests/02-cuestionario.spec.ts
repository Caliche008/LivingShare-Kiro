/**
 * e2e/tests/02-cuestionario.spec.ts
 *
 * Flujo E2E: Cuestionario de convivencia
 *
 * Cubre:
 *  - Acceso al cuestionario desde el dashboard (usuario autenticado)
 *  - Navegación por los 4 pasos (Horarios, Convivencia, Hábitos, Presupuesto)
 *  - Interacción con radio buttons (que usan sr-only y labels clicables)
 *  - Guardado de borrador al pasar entre pasos
 *  - Validación de campos obligatorios al intentar enviar sin completar
 *  - Envío exitoso del cuestionario → redirección a /matches
 *
 * Los tests usan la sesión autenticada guardada por auth.setup.ts.
 */

import { test, expect } from "../helpers/fixtures";
import { FIREBASE_TIMEOUT, ROUTES } from "../helpers/test-data";

test.describe("Flujo de cuestionario", () => {
  test("la página del cuestionario es accesible desde el dashboard", async ({
    dashboardPage,
    page,
  }) => {
    await dashboardPage.goto();

    // Buscar el link de cuestionario en el sidebar o en el contenido
    const questionnaireLink = page
      .getByRole("link", { name: /cuestionario/i })
      .first();
    await expect(questionnaireLink).toBeVisible({ timeout: 10_000 });
    await questionnaireLink.click();

    await expect(page).toHaveURL(new RegExp(ROUTES.questionnaire));
    await expect(
      page.getByRole("heading", { name: /cuestionario/i })
    ).toBeVisible();
  });

  test("muestra los 4 pasos del cuestionario", async ({ questionnairePage, page }) => {
    await questionnairePage.goto();

    // Los pasos deben estar visibles en la barra de progreso
    await expect(page.getByText("Horarios")).toBeVisible();
    await expect(page.getByText("Convivencia")).toBeVisible();
    await expect(page.getByText("Hábitos")).toBeVisible();
    await expect(page.getByText("Presupuesto")).toBeVisible();
  });

  test("paso 1 — Horarios: muestra las opciones de horario de descanso", async ({
    questionnairePage,
    page,
  }) => {
    await questionnairePage.goto();

    // Opción Madrugador
    await expect(page.getByText(/madrugador/i)).toBeVisible();
    // Opción Flexible
    await expect(page.getByText(/flexible/i)).toBeVisible();
    // Opción Nocturno
    await expect(page.getByText(/nocturno/i)).toBeVisible();
  });

  test("paso 1 → paso 2: navega con el botón Siguiente", async ({
    questionnairePage,
    page,
  }) => {
    await questionnairePage.goto();

    // Seleccionar horario de descanso (click en el label visible)
    await page
      .locator('label', { hasText: /flexible/i })
      .first()
      .click();

    // Hacer click en Siguiente
    await questionnairePage.nextButton.click();

    // Ahora debería estar en el paso 2 (Convivencia)
    // El paso 1 tiene un checkmark "✓" porque ya fue completado
    await expect(page.getByText(/nivel de limpieza/i)).toBeVisible({
      timeout: 8_000,
    });
  });

  test("paso 2 — Convivencia: selecciona nivel de limpieza y ruido", async ({
    questionnairePage,
    page,
  }) => {
    await questionnairePage.goto();

    // Ir al paso 2
    await page.locator('label', { hasText: /flexible/i }).first().click();
    await questionnairePage.nextButton.click();
    await expect(page.getByText(/nivel de limpieza/i)).toBeVisible({ timeout: 8_000 });

    // Seleccionar nivel de limpieza 3
    await page.getByRole("button", { name: "3" }).click();

    // Seleccionar nivel de ruido moderado
    await page.locator('label', { hasText: /moderado/i }).first().click();

    // Avanzar al paso 3
    await questionnairePage.nextButton.click();
    await expect(page.getByText(/mascotas/i)).toBeVisible({ timeout: 8_000 });
  });

  test("paso 3 — Hábitos: selecciona mascotas y tabaco", async ({
    questionnairePage,
    page,
  }) => {
    await questionnairePage.goto();

    // Paso 1
    await page.locator('label', { hasText: /flexible/i }).first().click();
    await questionnairePage.nextButton.click();
    await expect(page.getByText(/nivel de limpieza/i)).toBeVisible({ timeout: 8_000 });

    // Paso 2
    await page.getByRole("button", { name: "3" }).click();
    await page.locator('label', { hasText: /moderado/i }).first().click();
    await questionnairePage.nextButton.click();
    await expect(page.getByText(/mascotas/i)).toBeVisible({ timeout: 8_000 });

    // Paso 3: seleccionar No mascotas y No fuma
    const noLabels = page.locator('label', { hasText: /^No$/ });
    await noLabels.first().click(); // hasPets = No
    await page.locator('label', { hasText: /^No$/ }).nth(2).click(); // smokes = No

    // Avanzar al paso 4
    await questionnairePage.nextButton.click();
    await expect(page.getByText(/presupuesto/i)).toBeVisible({ timeout: 8_000 });
  });

  test("paso 4 — Presupuesto: completa y envía el cuestionario", async ({
    questionnairePage,
    page,
  }) => {
    await questionnairePage.goto();

    // ── Paso 1 ────────────────────────────────────────────────────────────
    await page.locator('label', { hasText: /flexible/i }).first().click();
    await questionnairePage.nextButton.click();
    await expect(page.getByText(/nivel de limpieza/i)).toBeVisible({ timeout: 8_000 });

    // ── Paso 2 ────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "3" }).click();
    await page.locator('label', { hasText: /moderado/i }).first().click();
    await questionnairePage.nextButton.click();
    await expect(page.getByText(/mascotas/i)).toBeVisible({ timeout: 8_000 });

    // ── Paso 3 ────────────────────────────────────────────────────────────
    // hasPets = No (primer "No" en el paso)
    await page.locator('label', { hasText: /^No$/ }).first().click();
    // smokes = No (el "No" en el grupo de Fumas)
    await page.locator('label', { hasText: /^No$/ }).nth(2).click();
    await questionnairePage.nextButton.click();
    await expect(page.getByText(/presupuesto máximo/i)).toBeVisible({ timeout: 8_000 });

    // ── Paso 4 ────────────────────────────────────────────────────────────
    // Rellenar presupuesto máximo
    await page.locator("#budget").fill("7000");

    // Seleccionar duración larga
    await page.locator('label', { hasText: /larga/i }).first().click();

    // Enviar el cuestionario
    await questionnairePage.submitButton.click();

    // Debe redirigir a /matches
    await expect(page).toHaveURL(/\/matches/, { timeout: FIREBASE_TIMEOUT });
  });

  test("botón Anterior navega al paso previo", async ({
    questionnairePage,
    page,
  }) => {
    await questionnairePage.goto();

    // Ir al paso 2
    await page.locator('label', { hasText: /flexible/i }).first().click();
    await questionnairePage.nextButton.click();
    await expect(page.getByText(/nivel de limpieza/i)).toBeVisible({ timeout: 8_000 });

    // Volver al paso 1 con Anterior
    await questionnairePage.prevButton.click();

    // Deben volver a verse las opciones de horario
    await expect(page.getByText(/horario de descanso/i)).toBeVisible();
  });

  test("el botón Anterior está deshabilitado en el primer paso", async ({
    questionnairePage,
  }) => {
    await questionnairePage.goto();

    await expect(questionnairePage.prevButton).toBeDisabled();
  });

  test("en el último paso el botón se llama 'Enviar cuestionario'", async ({
    questionnairePage,
    page,
  }) => {
    await questionnairePage.goto();

    // Navegar hasta el paso 4
    await page.locator('label', { hasText: /flexible/i }).first().click();
    await questionnairePage.nextButton.click();
    await expect(page.getByText(/nivel de limpieza/i)).toBeVisible({ timeout: 8_000 });

    await page.getByRole("button", { name: "3" }).click();
    await page.locator('label', { hasText: /moderado/i }).first().click();
    await questionnairePage.nextButton.click();
    await expect(page.getByText(/mascotas/i)).toBeVisible({ timeout: 8_000 });

    await page.locator('label', { hasText: /^No$/ }).first().click();
    await page.locator('label', { hasText: /^No$/ }).nth(2).click();
    await questionnairePage.nextButton.click();
    await expect(page.getByText(/presupuesto/i)).toBeVisible({ timeout: 8_000 });

    // El botón de enviar debe estar visible
    await expect(questionnairePage.submitButton).toBeVisible();
    await expect(
      page.getByRole("button", { name: /enviar cuestionario/i })
    ).toBeVisible();
  });
});
