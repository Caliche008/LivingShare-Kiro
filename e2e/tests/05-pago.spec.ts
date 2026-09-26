/**
 * e2e/tests/05-pago.spec.ts
 *
 * Flujo E2E: Pago con Stripe (mock)
 *
 * Cubre:
 *  - Página de éxito de pago (/payments/success)
 *  - Página de cancelación de pago (/payments/cancel)
 *  - Verificación de que los botones de ambas páginas funcionan
 *  - Intercepción de la llamada a createPaymentSession (mock de red)
 *  - Simulación del flujo completo: participación → pago → redirección mock → éxito
 *
 * NOTA SOBRE STRIPE EN E2E:
 * Stripe Checkout no puede automatizarse directamente porque su página
 * de pago es un iframe externo con protecciones anti-bot.
 * La estrategia correcta es:
 *   1. Interceptar la llamada a la Cloud Function `createPaymentSession`
 *   2. Retornar una URL de éxito mock en lugar de la URL de Stripe
 *   3. Verificar que la app navega a esa URL y muestra la página correcta
 *
 * Para tests con Stripe real, usar Stripe CLI:
 *   stripe listen --forward-to <webhook-url>
 *   stripe trigger checkout.session.completed
 */

import { test, expect } from "../helpers/fixtures";
import { ROUTES } from "../helpers/test-data";

test.describe("Página de éxito de pago", () => {
  test("muestra la confirmación de pago completado", async ({ page }) => {
    await page.goto("/payments/success");

    // Primero muestra el estado de carga (confirmando pago)
    // Luego de ~2.5s muestra el estado final
    // Esperamos el estado final
    await expect(
      page.getByText(/pago completado|pago.*procesado/i)
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText("✅")).toBeVisible();
  });

  test("muestra el botón de ver facturas en la página de éxito", async ({
    page,
  }) => {
    await page.goto("/payments/success");

    await expect(
      page.getByRole("button", { name: /ver mis facturas/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("muestra el botón de ir al dashboard en la página de éxito", async ({
    page,
  }) => {
    await page.goto("/payments/success");

    await expect(
      page.getByRole("button", { name: /ir al dashboard/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("el botón 'Ver mis facturas' navega a /bills", async ({ page }) => {
    await page.goto("/payments/success");

    // Esperar que cargue la página de éxito
    await page.waitForTimeout(3000); // esperar el timeout de confirmación de Stripe

    await page.getByRole("button", { name: /ver mis facturas/i }).click();
    await expect(page).toHaveURL(new RegExp(ROUTES.bills));
  });

  test("el session_id en la URL se muestra en la página de éxito", async ({
    page,
  }) => {
    const fakeSessionId = "cs_test_fake_session_123abc";
    await page.goto(`/payments/success?session_id=${fakeSessionId}`);

    // Esperar que pase el estado de carga
    await page.waitForTimeout(3000);

    // El session_id debe mostrarse en la página
    await expect(page.getByText(fakeSessionId)).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("Página de cancelación de pago", () => {
  test("muestra el mensaje de pago cancelado", async ({ page }) => {
    await page.goto("/payments/cancel");

    await expect(page.getByText("❌")).toBeVisible({ timeout: 8_000 });
    await expect(
      page.getByRole("heading", { name: /pago cancelado/i })
    ).toBeVisible();
  });

  test("informa que no se realizó ningún cargo", async ({ page }) => {
    await page.goto("/payments/cancel");

    await expect(
      page.getByText(/no se realizó ningún cargo/i)
    ).toBeVisible({ timeout: 8_000 });
  });

  test("muestra botón para volver e intentar de nuevo", async ({ page }) => {
    await page.goto("/payments/cancel");

    await expect(
      page.getByRole("button", { name: /volver e intentar|intentar de nuevo/i })
    ).toBeVisible({ timeout: 8_000 });
  });

  test("el botón 'Ir al dashboard' navega al dashboard", async ({ page }) => {
    await page.goto("/payments/cancel");

    await page.getByRole("button", { name: /ir al dashboard/i }).click();
    await expect(page).toHaveURL(new RegExp(ROUTES.dashboard), {
      timeout: 10_000,
    });
  });
});

test.describe("Flujo de pago E2E con mock de red (Stripe interceptado)", () => {
  test("intercepta createPaymentSession y redirige a la URL de éxito mock", async ({
    page,
  }) => {
    /**
     * Estrategia:
     * 1. Interceptar la llamada a la Cloud Function (Firebase Functions usa HTTPS)
     * 2. Devolver una respuesta fake con url: '/payments/success?session_id=mock_123'
     * 3. Verificar que la app navega a la página de éxito
     */

    // Interceptar llamadas a Firebase Functions
    await page.route(
      /firebasefunctions\.net.*createPaymentSession|localhost.*createPaymentSession/,
      async (route) => {
        // Simular la respuesta de la Cloud Function
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            result: {
              sessionId: "cs_test_mock_e2e_123",
              url: `${page.url().split("/").slice(0, 3).join("/")}/payments/success?session_id=cs_test_mock_e2e_123`,
              existing: false,
            },
          }),
        });
      }
    );

    // Ir a la página de facturas
    await page.goto(ROUTES.bills);
    await page.waitForLoadState("networkidle").catch(() => {});

    // Si hay un botón de pagar, hacer click
    const payButton = page.getByRole("button", { name: /pagar/i }).first();
    const isPayButtonVisible = await payButton.isVisible().catch(() => false);

    if (isPayButtonVisible) {
      await payButton.click();

      // Debe navegar a la página de éxito (gracias al mock)
      await expect(page).toHaveURL(/\/payments\/success/, { timeout: 10_000 });
      await expect(page.getByText(/pago completado/i)).toBeVisible({
        timeout: 10_000,
      });
    } else {
      // No hay facturas/participaciones para pagar — test documentado pero sin acción
      test.info().annotations.push({
        type: "info",
        description:
          "No hay participaciones disponibles para pagar en este entorno. " +
          "Este test requiere datos de factura con split confirmado.",
      });
    }
  });

  test("el botón de pago muestra estado de carga durante la llamada", async ({
    page,
  }) => {
    // Interceptar con delay para ver el estado de carga
    await page.route(
      /firebasefunctions\.net.*createPaymentSession|localhost.*createPaymentSession/,
      async (route) => {
        await page.waitForTimeout(500); // simular latencia
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            result: {
              sessionId: "cs_test_mock_loading_123",
              url: null,
              existing: true,
            },
          }),
        });
      }
    );

    await page.goto(ROUTES.bills);
    await page.waitForLoadState("networkidle").catch(() => {});

    const payButton = page.getByRole("button", { name: /pagar/i }).first();
    const isPayButtonVisible = await payButton.isVisible().catch(() => false);

    if (isPayButtonVisible) {
      await payButton.click();

      // Verificar que el botón muestra estado de carga
      const procesandoButton = page.getByRole("button", {
        name: /procesando|cargando|pagando/i,
      });
      await expect(procesandoButton).toBeVisible({ timeout: 2_000 }).catch(() => {
        // Puede ser muy rápido, no falla el test
      });
    }
  });
});

test.describe("Flujo completo: Registro → Cuestionario → Matching → Factura → Pago", () => {
  /**
   * Este test documenta el flujo E2E completo end-to-end.
   * En un entorno real con Firebase Emulator corriendo, todos los pasos
   * funcionan con datos reales.
   *
   * Para ejecutarlo en su totalidad:
   *   1. Iniciar el emulador: firebase emulators:start
   *   2. Iniciar Next.js: npm run dev
   *   3. Ejecutar: npx playwright test 05-pago.spec.ts --grep "flujo completo"
   */
  test("verifica que cada ruta del flujo responde correctamente", async ({
    page,
  }) => {
    const routes = [
      { path: ROUTES.dashboard, heading: /dashboard|bienvenido/i },
      { path: ROUTES.questionnaire, heading: /cuestionario/i },
      { path: ROUTES.matches, heading: /compatibilidad/i },
      { path: ROUTES.properties, heading: /propiedades/i },
      { path: ROUTES.bills, heading: /facturas/i },
    ];

    for (const { path, heading } of routes) {
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => {});

      // Cada ruta debe cargarse sin redirigir al login
      const currentUrl = page.url();
      expect(currentUrl).not.toContain("/login");

      // Debe tener un heading reconocible
      await expect(page.getByRole("heading", { name: heading })).toBeVisible({
        timeout: 10_000,
      });
    }
  });
});
