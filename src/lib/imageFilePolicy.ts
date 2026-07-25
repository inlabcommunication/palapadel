export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

export class StorageImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageImageError";
  }
}

export function assertValidImageFile(file: Pick<File, "type" | "size">) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new StorageImageError("Formato non ammesso. Usa JPG, JPEG, PNG o WebP.");
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new StorageImageError("Il file supera i 5 MB consentiti.");
  }
}

export function formatImageFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function makeStorageSafeFilename(name: string) {
  const fallback = "immagine.jpg";
  const [rawBase, rawExt] = splitFilename(name || fallback);
  const base = rawBase
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `${base || "immagine"}.${ext}`;
}

function splitFilename(name: string): [string, string] {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return [name, ""];
  return [name.slice(0, dot), name.slice(dot + 1)];
}
