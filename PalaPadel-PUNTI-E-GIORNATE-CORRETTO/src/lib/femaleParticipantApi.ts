import { postToBackend } from "./backendClient";
import type { ParticipationStatus } from "../types";

export const createFemaleParticipant = (editionId: string, name: string) =>
  postToBackend<{ ok: true }>("/api/admin/female-participant", { operation: "create", editionId, name });
export const updateFemaleParticipant = (input: {
  participantId: string; editionId: string; name: string; calculatedPoints: number;
  manualPointsAdjustment: number; stages: number; order: number; status: ParticipationStatus;
}) => postToBackend<{ ok: true }>("/api/admin/female-participant", { operation: "update", ...input });
export const deleteFemaleParticipant = (editionId: string, participantId: string) =>
  postToBackend<{ ok: true }>("/api/admin/female-participant", { operation: "delete", editionId, participantId });
export const recalculateFemaleParticipants = (editionId: string, changes: { participantId: string; points: number }[]) =>
  postToBackend<{ ok: true }>("/api/admin/female-participant", { operation: "recalculate", editionId, changes });
