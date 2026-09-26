// Mock de @stripe/stripe-js para pruebas unitarias
export const loadStripe = jest.fn().mockResolvedValue({
  redirectToCheckout: jest.fn().mockResolvedValue({ error: null }),
});
