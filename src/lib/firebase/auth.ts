import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  type User,
  type UserCredential,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./config";

export interface RegisterData {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginData {
  email: string;
  password: string;
}

/**
 * Registra un nuevo usuario y crea su documento en Firestore.
 */
export async function registerUser(data: RegisterData): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    data.email,
    data.password
  );

  // Actualizar displayName en Firebase Auth
  await updateProfile(credential.user, { displayName: data.displayName });

  // Crear documento de usuario en Firestore
  await setDoc(doc(db, "users", credential.user.uid), {
    uid: credential.user.uid,
    email: data.email,
    displayName: data.displayName,
    roles: ["resident"],
    questionnaireStatus: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return credential;
}

/**
 * Inicia sesión con email y contraseña.
 */
export async function loginUser(data: LoginData): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, data.email, data.password);
}

/**
 * Cierra la sesión del usuario actual.
 */
export async function logoutUser(): Promise<void> {
  return signOut(auth);
}

/**
 * Envía un correo de recuperación de contraseña.
 */
export async function resetPassword(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email);
}

/**
 * Retorna el usuario actualmente autenticado.
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}
