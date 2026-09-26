/**
 * e2e/helpers/page-objects.ts
 *
 * Page Object Models (POM) para LivingShare.
 * Encapsulan selectores y acciones repetidas para que los tests
 * sean más legibles y fáciles de mantener.
 */

import type { Page, Locator } from "@playwright/test";

// ─── LoginPage ──────────────────────────────────────────────────────────────

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly serverError: Locator;
  readonly registerLink: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator("#email");
    this.passwordInput = page.locator("#password");
    this.submitButton = page.getByRole("button", { name: /ingresar/i });
    this.serverError = page.getByRole("alert");
    this.registerLink = page.getByRole("link", { name: /regístrate/i });
    this.forgotPasswordLink = page.getByRole("link", { name: /olvidaste/i });
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

// ─── RegisterPage ───────────────────────────────────────────────────────────

export class RegisterPage {
  readonly page: Page;
  readonly displayNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly serverError: Locator;
  readonly loginLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.displayNameInput = page.locator("#displayName");
    this.emailInput = page.locator("#email");
    this.passwordInput = page.locator("#password");
    this.confirmPasswordInput = page.locator("#confirmPassword");
    this.submitButton = page.getByRole("button", { name: /crear cuenta/i });
    this.serverError = page.getByRole("alert");
    this.loginLink = page.getByRole("link", { name: /ya tienes cuenta/i });
  }

  async goto() {
    await this.page.goto("/register");
  }

  async register(
    displayName: string,
    email: string,
    password: string,
    confirmPassword?: string
  ) {
    await this.displayNameInput.fill(displayName);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword ?? password);
    await this.submitButton.click();
  }
}

// ─── DashboardPage ──────────────────────────────────────────────────────────

export class DashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly propertiesLink: Locator;
  readonly questionnaireLink: Locator;
  readonly matchesLink: Locator;
  readonly billsLink: Locator;
  readonly notificationsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /dashboard|bienvenido/i });
    this.propertiesLink = page.getByRole("link", { name: /propiedades/i });
    this.questionnaireLink = page.getByRole("link", { name: /cuestionario/i });
    this.matchesLink = page.getByRole("link", { name: /match|compatibilidad/i });
    this.billsLink = page.getByRole("link", { name: /facturas/i });
    this.notificationsLink = page.getByRole("link", { name: /notificaciones/i });
  }

  async goto() {
    await this.page.goto("/dashboard");
  }
}

// ─── QuestionnairePage ──────────────────────────────────────────────────────

export class QuestionnairePage {
  readonly page: Page;
  readonly nextButton: Locator;
  readonly prevButton: Locator;
  readonly saveButton: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nextButton = page.getByRole("button", { name: /siguiente/i });
    this.prevButton = page.getByRole("button", { name: /anterior/i });
    this.saveButton = page.getByRole("button", { name: /guardar borrador/i });
    this.submitButton = page.getByRole("button", { name: /enviar cuestionario/i });
    this.successMessage = page.getByText(/cuestionario enviado|guardado/i);
  }

  async goto() {
    await this.page.goto("/questionnaire");
  }

  /** Selecciona una opción de un grupo de radio buttons por su label visible */
  async selectRadioOption(groupName: string, optionLabel: string) {
    // Los radio buttons usan <label> visibles con <input type="radio" class="sr-only">
    // Buscamos el label que contiene el texto dentro del fieldset/grupo correcto
    await this.page
      .locator(`label`, { hasText: optionLabel })
      .first()
      .click();
  }

  /** Selecciona la opción de un radio por el atributo name del input */
  async selectRadioByName(name: string, value: string) {
    await this.page.locator(`input[type="radio"][name="${name}"][value="${value}"]`).click({ force: true });
  }
}

// ─── MatchesPage ────────────────────────────────────────────────────────────

export class MatchesPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly recalculateButton: Locator;
  readonly matchCards: Locator;
  readonly emptyState: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /match|compatibilidad/i });
    this.recalculateButton = page.getByRole("button", { name: /recalcular/i });
    this.matchCards = page.locator("[data-testid='match-card'], .match-card, article");
    this.emptyState = page.getByText(/no hay resultados|sin resultados|no tienes matches/i);
    this.errorMessage = page.getByRole("alert");
  }

  async goto() {
    await this.page.goto("/matches");
  }
}

// ─── PropertiesPage ─────────────────────────────────────────────────────────

export class PropertiesPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly newPropertyButton: Locator;
  readonly propertyCards: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /propiedades/i });
    this.newPropertyButton = page.getByRole("link", { name: /nueva propiedad|agregar/i });
    this.propertyCards = page.locator("[data-testid='property-card'], article, .property-card");
    this.emptyState = page.getByText(/no tienes propiedades|sin propiedades/i);
  }

  async goto() {
    await this.page.goto("/properties");
  }
}

// ─── BillsPage ──────────────────────────────────────────────────────────────

export class BillsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly billCards: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: /facturas/i });
    this.billCards = page.locator("[data-testid='bill-card'], article, .bill-card");
    this.emptyState = page.getByText(/no hay facturas|sin facturas/i);
  }

  async goto() {
    await this.page.goto("/bills");
  }
}
