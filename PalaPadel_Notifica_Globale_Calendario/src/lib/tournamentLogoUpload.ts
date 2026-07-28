import { deleteStorageImageQuietly, uploadStorageImage } from "./storageImageUpload";

export function uploadTournamentLogo(tournamentId: string, file: File) {
  return uploadStorageImage({
    folderPath: `tournaments/${tournamentId}/logo`,
    file,
    maxWidth: 800,
  });
}

export function deleteTournamentLogo(path?: string | null) {
  return deleteStorageImageQuietly(path, "logo del torneo");
}
