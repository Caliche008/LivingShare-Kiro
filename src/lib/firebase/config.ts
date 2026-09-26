import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { type Auth } from "firebase/auth";
import { type Firestore } from "firebase/firestore";
import { type FirebaseStorage } from "firebase/storage";

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

// ─── Lazy initialization ──────────────────────────────────────────────────────
// Los servicios se inicializan solo cuando se llaman por primera vez,
// lo que permite que Next.js compile el bundle sin ejecutar Firebase.

let _app: FirebaseApp | undefined;
let _auth: Auth | undefined;
let _db: Firestore | undefined;
let _storage: FirebaseStorage | undefined;

function getApp_(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuth } = require("firebase/auth");
    _auth = getAuth(getApp_()) as Auth;
  }
  return _auth!;
}

export function getFirebaseDb(): Firestore {
  if (!_db) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getFirestore } = require("firebase/firestore");
    _db = getFirestore(getApp_()) as Firestore;
  }
  return _db!;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!_storage) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getStorage } = require("firebase/storage");
    _storage = getStorage(getApp_()) as FirebaseStorage;
  }
  return _storage!;
}

// ─── Proxy objects para compatibilidad con código existente ─────────────────
// Estos objetos delegan al singleton lazy cuando se accede a sus propiedades.

export const auth = new Proxy({} as Auth, {
  get(_target, prop) {
    const a = getFirebaseAuth();
    return (a as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const db = new Proxy({} as Firestore, {
  get(_target, prop) {
    const d = getFirebaseDb();
    return (d as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const storage = new Proxy({} as FirebaseStorage, {
  get(_target, prop) {
    const s = getFirebaseStorage();
    return (s as unknown as Record<string | symbol, unknown>)[prop];
  },
});

const firebaseApp = new Proxy({} as FirebaseApp, {
  get(_target, prop) {
    const a = getApp_();
    return (a as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export default firebaseApp;
