import { postToBackend } from "./backendClient";

export const createHallOfFameWin = (input:
  | { typeId: string; teamId: string; season: string; note?: string }
  | { typeId: string; participantName: string; season: string; note?: string }
) => postToBackend<{ ok: true }>("/api/admin/hall-of-fame", { operation: "create", ...input });
export const updateHallOfFameWin = (input: { winId: string; season: string; note?: string; participantName?: string }) =>
  postToBackend<{ ok: true }>("/api/admin/hall-of-fame", { operation: "update", ...input });
export const deleteHallOfFameWin = (winId: string) =>
  postToBackend<{ ok: true }>("/api/admin/hall-of-fame", { operation: "delete", winId });
