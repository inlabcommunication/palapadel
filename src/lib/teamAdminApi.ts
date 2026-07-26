import { postToBackend } from "./backendClient";

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
