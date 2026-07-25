import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase";
import { resizeImageFile } from "./imageResize";
import { assertValidImageFile, makeStorageSafeFilename } from "./imageFilePolicy";
export {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_UPLOAD_BYTES,
  StorageImageError,
  assertValidImageFile,
  formatImageFileSize,
  makeStorageSafeFilename,
} from "./imageFilePolicy";

export interface UploadedStorageImage {
  url: string;
  storagePath: string;
  fileName: string;
  originalSize: number;
  uploadedSize: number;
  contentType: string;
}

export async function uploadStorageImage({
  folderPath,
  file,
  maxWidth = 1600,
}: {
  folderPath: string;
  file: File;
  maxWidth?: number;
}): Promise<UploadedStorageImage> {
  assertValidImageFile(file);
  const resized = await resizeImageFile(file, maxWidth);
  const fileName = `${Date.now()}-${makeStorageSafeFilename(resized.name)}`;
  const storagePath = `${folderPath.replace(/\/+$/, "")}/${fileName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, resized, { contentType: resized.type });
  const url = await getDownloadURL(storageRef);
  return {
    url,
    storagePath,
    fileName,
    originalSize: file.size,
    uploadedSize: resized.size,
    contentType: resized.type,
  };
}

export async function deleteStorageImage(storagePathOrUrl?: string | null) {
  if (!storagePathOrUrl) return;
  await deleteObject(ref(storage, storagePathOrUrl));
}

export async function deleteStorageImageQuietly(storagePathOrUrl?: string | null, context = "immagine") {
  if (!storagePathOrUrl) return;
  try {
    await deleteStorageImage(storagePathOrUrl);
  } catch (err) {
    console.error(`Errore nell'eliminazione della vecchia ${context}:`, err);
  }
}
