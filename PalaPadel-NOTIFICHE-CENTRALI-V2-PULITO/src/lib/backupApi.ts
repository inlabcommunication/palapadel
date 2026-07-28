import { postToBackend } from "./backendClient";

export interface PalaPadelBackup {
  schemaVersion: number;
  exportedAt: string;
  [collection: string]: unknown;
}

export async function downloadJsonBackup() {
  const response = await postToBackend<{ ok: true; backup: PalaPadelBackup }>("/api/admin/backup", {});
  const blob = new Blob([JSON.stringify(response.backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `palapadel-backup-${response.backup.exportedAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
