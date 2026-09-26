/**
 * Mock de firebase-functions/v2/https y firebase-functions para pruebas.
 * Expone onCall y onRequest sin dependencia de Firebase SDK real.
 */

export class HttpsError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpsError";
    this.code = code;
    this.details = details;
  }
}

/**
 * onCall — envuelve el handler y lo expone como función invocable directamente.
 * En pruebas, se llama como: handler({ auth, data }).
 *
 * Soporta dos firmas:
 *   onCall(handler)             — sin opciones (index.ts, assignRole, etc.)
 *   onCall(options, handler)    — con opciones (billing.ts, notifications.ts)
 */
export function onCall(
  optionsOrHandler: unknown,
  handlerOrUndefined?: (req: unknown) => Promise<unknown>
) {
  // Si se pasó solo el handler como primer argumento
  if (typeof optionsOrHandler === "function" && handlerOrUndefined === undefined) {
    return optionsOrHandler as (req: unknown) => Promise<unknown>;
  }
  // Si se pasó (options, handler)
  return handlerOrUndefined as (req: unknown) => Promise<unknown>;
}

/**
 * onRequest — envuelve el handler HTTP y lo expone directamente.
 * En pruebas, se llama con (req, res) simulados.
 */
export function onRequest(
  _options: unknown,
  handler: (req: unknown, res: unknown) => Promise<void>
) {
  return handler;
}

export const logger = {
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
