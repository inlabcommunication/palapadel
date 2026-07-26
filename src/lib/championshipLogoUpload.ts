import { deleteStorageImageQuietly, uploadStorageImage } from "./storageImageUpload";

export function uploadChampionshipTypeLogo(typeId: string, file: File) {
  return uploadStorageImage({
    folderPath: `championship-types/${typeId}/logo`,
    file,
    maxWidth: 800,
  });
}

export function deleteChampionshipTypeLogo(path?: string | null) {
  return deleteStorageImageQuietly(path, "logo del campionato");
}
