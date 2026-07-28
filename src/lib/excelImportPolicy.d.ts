export const MAX_ADMIN_IMPORT_BYTES: number;
export const MAX_ADMIN_IMPORT_ROWS: number;
export function validateAdminImportFile(
  file: Pick<File, "name" | "size">,
  extensions: string[]
): string | null;
