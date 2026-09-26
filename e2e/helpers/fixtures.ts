/**
 * e2e/helpers/fixtures.ts
 *
 * Extiende el `test` de Playwright con fixtures propios de LivingShare:
 *  - Instancias de Page Object Models listas para usar
 *  - Helpers de navegación con sesión autenticada
 *
 * Uso en un test:
 *   import { test, expect } from "../helpers/fixtures";
 *   test("mi test", async ({ loginPage, dashboardPage }) => { ... });
 */

import { test as base } from "@playwright/test";
import {
  LoginPage,
  RegisterPage,
  DashboardPage,
  QuestionnairePage,
  MatchesPage,
  PropertiesPage,
  BillsPage,
} from "./page-objects";

type LivingShareFixtures = {
  loginPage: LoginPage;
  registerPage: RegisterPage;
  dashboardPage: DashboardPage;
  questionnairePage: QuestionnairePage;
  matchesPage: MatchesPage;
  propertiesPage: PropertiesPage;
  billsPage: BillsPage;
};

export const test = base.extend<LivingShareFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  questionnairePage: async ({ page }, use) => {
    await use(new QuestionnairePage(page));
  },
  matchesPage: async ({ page }, use) => {
    await use(new MatchesPage(page));
  },
  propertiesPage: async ({ page }, use) => {
    await use(new PropertiesPage(page));
  },
  billsPage: async ({ page }, use) => {
    await use(new BillsPage(page));
  },
});

export { expect } from "@playwright/test";
