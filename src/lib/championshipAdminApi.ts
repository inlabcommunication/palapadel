import { postToBackend } from "./backendClient";

export function reorderChampionships(orderedIds: string[]) {
  return postToBackend<{ ok: true }>("/api/admin/championship-order", { operation: "reorder", orderedIds });
}

export function setChampionshipVisibility(editionId: string, isPubliclyVisible: boolean) {
  return postToBackend<{ ok: true }>("/api/admin/championship-order", {
    operation: "visibility",
    editionId,
    isPubliclyVisible,
  });
}

export function closeEdition(editionId: string) {
  return postToBackend<{ ok: true; winnerName: string }>("/api/admin/close-edition", { editionId });
}

export interface ScheduleImportRow {
  matchdayNumber: number;
  team1Id: string;
  team2Id: string;
  matchDate?: string;
  matchTime?: string;
  court?: string;
  notes?: string;
}

export function importSchedule(editionId: string, mode: "add" | "replace", rows: ScheduleImportRow[]) {
  return postToBackend<{ ok: true; imported: number }>("/api/admin/import-schedule", { editionId, mode, rows });
}

export function undoAuditEntry(auditId: string) {
  return postToBackend<{ ok: true }>("/api/admin/undo-audit", { auditId });
}

export function runStorageCleanup(operation: "scan" | "process") {
  return postToBackend<{ ok: true; queued?: number; deleted?: number; failed?: number }>("/api/admin/storage-cleanup", { operation });
}

export function setActiveMatchday(editionId: string, matchdayId: string) {
  return postToBackend<{ ok: true }>("/api/admin/active-matchday", { editionId, matchdayId });
}
