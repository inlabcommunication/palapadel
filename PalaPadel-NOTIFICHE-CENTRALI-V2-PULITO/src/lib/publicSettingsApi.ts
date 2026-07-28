import { postToBackend } from "./backendClient";

export interface PublicSettings {
  id: string;
  publicNoticeEnabled?: boolean;
  publicNotice?: string;
}

export const savePublicSettings = (input: { publicNoticeEnabled: boolean; publicNotice: string }) =>
  postToBackend<{ ok: true }>("/api/admin/public-settings", input);
