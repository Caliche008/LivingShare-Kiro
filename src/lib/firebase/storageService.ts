import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "@/lib/firebase/config";

/**
 * Sube un archivo a Firebase Storage.
 * @param path  Ruta destino en Storage (ej: 'properties/abc/photos/img.jpg')
 * @param file  Archivo a subir
 * @param onProgress  Callback con porcentaje 0-100
 * @returns Download URL pública del archivo
 */
export async function uploadPhoto(
  path: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const pct = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        onProgress?.(pct);
      },
      (error) => reject(error),
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

/**
 * Elimina un archivo de Storage por su URL de descarga.
 */
export async function deletePhoto(url: string): Promise<void> {
  const storageRef = ref(storage, url);
  await deleteObject(storageRef);
}

/**
 * Genera la ruta de Storage para una foto de propiedad.
 */
export function generatePropertyPhotoPath(
  propertyId: string,
  fileName: string
): string {
  return `properties/${propertyId}/photos/${Date.now()}_${fileName}`;
}

/**
 * Genera la ruta de Storage para una foto de habitación.
 */
export function generateRoomPhotoPath(
  propertyId: string,
  roomId: string,
  fileName: string
): string {
  return `properties/${propertyId}/rooms/${roomId}/photos/${Date.now()}_${fileName}`;
}
