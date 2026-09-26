/**
 * Mock de Stripe para pruebas de Cloud Functions.
 *
 * Permite:
 * - Controlar la respuesta de checkout.sessions.create
 * - Controlar constructEvent (firma válida/inválida)
 * - Verificar las llamadas realizadas
 */

export interface MockStripeCheckoutSession {
  id: string;
  url: string | null;
  payment_intent: string;
  amount_total: number;
  metadata: Record<string, string>;
}

// Estado configurable por cada test
export const mockStripeState = {
  // Sesión que se devolverá al crear un checkout
  nextSession: null as MockStripeCheckoutSession | null,
  // Si constructEvent debe fallar (firma inválida)
  invalidSignature: false,
  // Evento que se devolverá en constructEvent
  nextEvent: null as Record<string, unknown> | null,
  // Llamadas registradas
  calls: {
    checkoutCreate: [] as unknown[],
    constructEvent: [] as unknown[],
  },
};

export function resetMockStripe() {
  mockStripeState.nextSession = null;
  mockStripeState.invalidSignature = false;
  mockStripeState.nextEvent = null;
  mockStripeState.calls.checkoutCreate = [];
  mockStripeState.calls.constructEvent = [];
}

// Clase Stripe mock
class MockStripe {
  checkout = {
    sessions: {
      create: jest.fn(async (params: unknown) => {
        mockStripeState.calls.checkoutCreate.push(params);
        if (!mockStripeState.nextSession) {
          return {
            id: "cs_test_default",
            url: "https://checkout.stripe.com/pay/cs_test_default",
            payment_intent: "pi_test_default",
            amount_total: 5000,
            metadata: {},
          };
        }
        return mockStripeState.nextSession;
      }),
    },
  };

  webhooks = {
    constructEvent: jest.fn((payload: unknown, sig: unknown, secret: unknown) => {
      mockStripeState.calls.constructEvent.push({ payload, sig, secret });
      if (mockStripeState.invalidSignature) {
        throw new Error("No signatures found matching the expected signature for payload.");
      }
      if (!mockStripeState.nextEvent) {
        throw new Error("mockStripeState.nextEvent no configurado para constructEvent");
      }
      return mockStripeState.nextEvent;
    }),
  };
}

// El export default es una función constructora (como Stripe real)
const StripeMock = jest.fn().mockImplementation(() => new MockStripe());

export default StripeMock;
