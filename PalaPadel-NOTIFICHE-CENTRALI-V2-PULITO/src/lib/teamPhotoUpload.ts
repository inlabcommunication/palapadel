import {
  deleteStorageImageQuietly,
  StorageImageError,
  uploadStorageImage,
  type UploadedStorageImage,
} from "./storageImageUpload";

export class TeamPhotoError extends StorageImageError {
  constructor(message: string) {
    super(message);
    this.name = "TeamPhotoError";
  }
}

export async function uploadTeamPhotoAsset(teamId: string, file: File): Promise<UploadedStorageImage> {
  try {
    return await uploadStorageImage({
      folderPath: `teams/${teamId}/team-photo`,
      file,
      maxWidth: 1600,
    });
  } catch (err) {
    if (err instanceof StorageImageError) throw new TeamPhotoError(err.message);
    throw err;
  }
}

export async function uploadTeamPhoto(teamId: string, file: File): Promise<string> {
  const uploaded = await uploadTeamPhotoAsset(teamId, file);
  return uploaded.url;
}

export function deleteTeamPhotoByUrl(url: string): Promise<void> {
  return deleteStorageImageQuietly(url, "foto squadra");
}

export function deleteTeamPhotoByPath(storagePath?: string | null): Promise<void> {
  return deleteStorageImageQuietly(storagePath, "foto squadra");
}
