import { postToBackend } from "./backendClient";
import type { EditionStatus } from "../types";

type TypeInput = { id: string; name: string; hasTeams: boolean; badgeColor: string };

export const createChampionshipType = (input: TypeInput) =>
  postToBackend<{ ok: true }>("/api/admin/championship", { operation: "createType", ...input });
export const updateChampionshipType = (input: TypeInput) =>
  postToBackend<{ ok: true }>("/api/admin/championship", { operation: "updateType", ...input });
export const deleteChampionshipType = (id: string) =>
  postToBackend<{ ok: true }>("/api/admin/championship", { operation: "deleteType", id });
export const setChampionshipTypeLogo = (input: { id: string; logoUrl: string; logoStoragePath: string; logoAlt: string }) =>
  postToBackend<{ ok: true }>("/api/admin/championship", { operation: "setTypeLogo", ...input });
export const removeChampionshipTypeLogo = (id: string) =>
  postToBackend<{ ok: true }>("/api/admin/championship", { operation: "removeTypeLogo", id });

export const createChampionshipEdition = (input: { typeId: string; season: string; status: EditionStatus }) =>
  postToBackend<{ ok: true; id: string }>("/api/admin/championship", { operation: "createEdition", ...input });
export const updateChampionshipEdition = (input: { editionId: string; typeId: string; season: string; status: Exclude<EditionStatus, "conclusa"> }) =>
  postToBackend<{ ok: true }>("/api/admin/championship", { operation: "updateEdition", ...input });
export const deleteChampionshipEdition = (editionId: string) =>
  postToBackend<{ ok: true }>("/api/admin/championship", { operation: "deleteEdition", editionId });
