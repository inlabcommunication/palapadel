import { deleteStorageImageQuietly, uploadStorageImage, type UploadedStorageImage } from "./storageImageUpload";
import { buildChampionshipLogoFolder } from "./championshipLogoPolicy";

export { buildChampionshipLogoFolder, getChampionshipLogoAlt, getChampionshipTypeInitials } from "./championshipLogoPolicy";

/**
 * Carica il logo di una tipologia di campionato. Dimensione massima indicativa
 * 512x512: passiamo maxWidth 512 a resizeImageFile (via uploadStorageImage), che
 * mantiene sempre le proporzioni e non ingrandisce un'immagine già più piccola.
 * PNG e WebP mantengono la trasparenza (resizeImageFile disegna su canvas e
 * ricodifica nello stesso formato, senza riempire uno sfondo).
 */
export function uploadChampionshipLogo(championshipTypeId: string, file: File): Promise<UploadedStorageImage> {
  return uploadStorageImage({
    folderPath: buildChampionshipLogoFolder(championshipTypeId),
    file,
    maxWidth: 512,
  });
}

export function deleteChampionshipLogo(storagePathOrUrl?: string | null) {
  return deleteStorageImageQuietly(storagePathOrUrl, "logo del campionato");
}
