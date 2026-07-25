import { postToBackend } from "./backendClient";

export interface PublicSettings {
  id: string;
  publicNoticeEnabled?: boolean;
  publicNotice?: string;
  /** Logo InLab mostrato in fondo a ogni pagina (branding/inlab/logo/... su Storage). */
  inlabLogoUrl?: string;
  inlabLogoStoragePath?: string;
  inlabLogoAlt?: string;
}

export const savePublicSettings = (input: {
  publicNoticeEnabled: boolean;
  publicNotice: string;
  inlabLogoUrl?: string | null;
  inlabLogoStoragePath?: string | null;
  inlabLogoAlt?: string | null;
}) => postToBackend<{ ok: true }>("/api/admin/public-settings", input);
