/**
 * Fase 7 — ridimensiona un'immagine lato client prima del caricamento: larghezza
 * massima 1600px, proporzioni mantenute (mai deformata), qualità JPEG/WebP ridotta per
 * contenere il peso del file. Usa <canvas>, nativo del browser: nessuna dipendenza
 * aggiuntiva. Se l'immagine è già più piccola del limite, non viene ingrandita.
 */
const MAX_WIDTH = 1600;

export async function resizeImageFile(file: File, maxWidth: number = MAX_WIDTH): Promise<File> {
  const imageBitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / imageBitmap.width);
  const targetWidth = Math.round(imageBitmap.width * scale);
  const targetHeight = Math.round(imageBitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file; // fallback: nessun ridimensionamento possibile, carica l'originale

  ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
  imageBitmap.close?.();

  const outputType = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, outputType, 0.85));
  if (!blob) return file;

  const extension = outputType === "image/png" ? ".png" : outputType === "image/webp" ? ".webp" : ".jpg";
  const newName = file.name.replace(/\.\w+$/, "") + extension;
  return new File([blob], newName, { type: outputType });
}
