import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Permitir variables y argumentos con prefijo "_" como intencionalmente sin usar.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Los tests E2E de Playwright no son código React: `use` es la API de
  // fixtures de Playwright, no el hook `use` de React. Desactivamos las
  // reglas de React Hooks en esa carpeta para evitar falsos positivos.
  {
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Compiled Cloud Functions output — never lint generated JS.
    "functions/lib/**",
    "functions/**/*.js",
    // Playwright HTML report artifacts.
    "e2e/playwright-report/**",
  ]),
]);

export default eslintConfig;
