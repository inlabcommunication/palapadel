export const MAX_ADMIN_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_ADMIN_IMPORT_ROWS = 2000;

export function validateAdminImportFile(file, extensions) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!extensions.includes(extension)) {
    return `Formato non supportato. Usa ${extensions.map((item) => `.${item}`).join(", ")}.`;
  }
  if (file.size <= 0) return "Il file selezionato è vuoto.";
  if (file.size > MAX_ADMIN_IMPORT_BYTES) return "Il file supera il limite di 5 MB.";
  return null;
}
