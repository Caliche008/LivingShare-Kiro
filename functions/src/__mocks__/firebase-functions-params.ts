/**
 * Mock de firebase-functions/params.
 * defineSecret retorna un objeto con .value() que devuelve una clave de prueba.
 */

export function defineSecret(name: string) {
  return {
    name,
    value: () => {
      if (name === "STRIPE_SECRET_KEY")     return "sk_test_mock_key";
      if (name === "STRIPE_WEBHOOK_SECRET") return "whsec_test_mock_secret";
      return `mock_secret_${name}`;
    },
  };
}
