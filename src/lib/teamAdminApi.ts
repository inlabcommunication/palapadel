import { postToBackend } from "./backendClient";
import type { TeamImportDecision } from "../../shared/teamImportPlan.js";

export function saveTeam(input: {
  operation: "create" | "update";
  teamId: string;
  name: string;
  roster: string[];
  teamPhotoUrl?: string;
  teamPhotoStoragePath?: string | null;
  teamPhotoPositionY?: number;
  teamPhotoScale?: number;
}) {
  return postToBackend<{ ok: true }>("/api/admin/team", input);
}

export function deleteTeam(teamId: string) {
  return postToBackend<{ ok: true }>("/api/admin/team", { operation: "delete", teamId });
}

export function importTeams(teams: { name: string; roster: string[] }[]) {
  return postToBackend<{ ok: true; imported: number }>("/api/admin/team", { operation: "import", teams });
}

export function importTeamsWithDecisions(input: { editionId?: string; rows: TeamImportDecision[] }) {
  return postToBackend<{ ok: true; created: number; replaced: number; used: number; enrolled: number; skipped: number }>(
    "/api/admin/team-import",
    input
  );
}
