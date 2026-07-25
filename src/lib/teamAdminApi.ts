import { postToBackend } from "./backendClient";

export function saveTeam(input: {
  operation: "create" | "update";
  teamId: string;
  name: string;
  roster: string[];
  teamPhotoUrl?: string;
  teamPhotoStoragePath?: string | null;
}) {
  return postToBackend<{ ok: true }>("/api/admin/team", input);
}

export function deleteTeam(teamId: string) {
  return postToBackend<{ ok: true }>("/api/admin/team", { operation: "delete", teamId });
}
