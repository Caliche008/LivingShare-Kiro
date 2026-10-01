import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

export const IS_CONFIGURED = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

/**
 * Indica si las Cloud Functions están desplegadas y disponibles.
 *
 * Cloud Functions requieren el plan Blaze de Firebase (con tarjeta). Mientras
 * el proyecto corre en el plan gratuito Spark, esta bandera se deja en `false`
 * y las acciones que dependen de Functions (recalcular matching, calcular
 * reparto de facturas y crear sesión de pago) muestran un aviso en lugar de
 * fallar.
 *
 * Para activarlas tras desplegar las Functions en Blaze, definir en el entorno:
 *   NEXT_PUBLIC_FUNCTIONS_ENABLED=true
 */
export const FUNCTIONS_ENABLED =
  process.env.NEXT_PUBLIC_FUNCTIONS_ENABLED === "true";

/** Mensaje estándar cuando una acción requiere Cloud Functions no desplegadas. */
export const FUNCTIONS_DISABLED_MESSAGE =
  "Esta función estará disponible cuando se despliegue el backend. Por ahora está deshabilitada en esta versión de demostración.";

// ─── Inicialización directa ───────────────────────────────────────────────────
// Se exportan instancias REALES de los servicios Firebase, no Proxys.
// Un Proxy no es `instanceof FirebaseFirestore`, y el SDK rechaza eso en
// producción con: "Expected first argument to collection() to be a
// CollectionReference, a DocumentReference or FirebaseFirestore".
//
// La inicialización solo ocurre si la configuración es válida. Durante el
// prerenderizado estático (build) de páginas que no usan Firebase —p. ej.
// /_not-found— las variables pueden no estar presentes; en ese caso no se
// inicializa y se evita el error `auth/invalid-api-key`.
// `getApps()` evita reinicializar la app en recargas o HMR.
const firebaseApp: FirebaseApp | null = IS_CONFIGURED
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const auth: Auth = firebaseApp ? getAuth(firebaseApp) : ({} as Auth);
export const db: Firestore = firebaseApp ? getFirestore(firebaseApp) : ({} as Firestore);
export const storage: FirebaseStorage = firebaseApp
  ? getStorage(firebaseApp)
  : ({} as FirebaseStorage);

// Accesores mantenidos por compatibilidad con el código existente.
export function getFirebaseAuth(): Auth {
  return auth;
}

export function getFirebaseDb(): Firestore {
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  return storage;
}

export default firebaseApp;
