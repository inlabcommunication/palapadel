import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../firebase";
import { resizeImageFile } from "./imageResize";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB, coerente con storage.rules

export class TeamPhotoError extends Error {}

function assertValidFile(file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new TeamPhotoError("Formato non ammesso. Usa JPG, PNG o WebP.");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new TeamPhotoError("Il file supera i 5 MB consentiti.");
  }
}

/**
 * Fase 7 — carica la foto di gruppo di una squadra: comprime/ridimensiona lato client
 * (larghezza massima 1600px, proporzioni mantenute), poi carica su
 * teams/{teamId}/team-photo/{filename} e restituisce l'URL pubblico. Se sta
 * sostituendo una foto precedente, elimina quella vecchia SOLO dopo che upload e
 * salvataggio Firestore sono andati a buon fine (mai prima).
 */
export async function uploadTeamPhoto(teamId: string, file: File): Promise<string> {
  assertValidFile(file);
  const resized = await resizeImageFile(file);
  const path = `teams/${teamId}/team-photo/${Date.now()}-${resized.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, resized, { contentType: resized.type });
  return getDownloadURL(storageRef);
}

/** Elimina un file di Storage dato il suo URL pubblico (usato dopo aver sostituito la foto). */
export async function deleteTeamPhotoByUrl(url: string): Promise<void> {
  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch (err) {
    // Non bloccante: se il file non esiste più o l'URL non è di questo bucket, non
    // interrompiamo il flusso (la foto nuova è già salvata correttamente).
    console.error("Errore nell'eliminazione della vecchia foto squadra:", err);
  }
}
