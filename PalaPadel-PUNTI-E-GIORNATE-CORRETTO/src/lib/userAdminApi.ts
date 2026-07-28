import { postToBackend } from "./backendClient";

export const createAdminUser = (input: { username: string; password: string; role: "admin" | "resultManager" }) =>
  postToBackend<{ ok: true; uid: string }>("/api/admin/user", { operation: "create", ...input });

export const updateAdminUser = (input: { uid: string; role: "admin" | "resultManager"; disabled: boolean }) =>
  postToBackend<{ ok: true }>("/api/admin/user", { operation: "update", ...input });

export const setAdminUserPassword = (targetUid: string, newPassword: string) =>
  postToBackend<{ ok: true }>("/api/admin/set-password", { targetUid, newPassword });
