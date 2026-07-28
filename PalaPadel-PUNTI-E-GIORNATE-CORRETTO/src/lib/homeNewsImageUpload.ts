import { deleteStorageImageQuietly, uploadStorageImage, type UploadedStorageImage } from "./storageImageUpload";
import { buildHomeNewsImageFolder } from "./homeNewsImagePolicy";

export { buildHomeNewsImageFolder, getNewsExcerpt, getNewsImageAlt } from "./homeNewsImagePolicy";

export function uploadHomeNewsImage(newsId: string, file: File): Promise<UploadedStorageImage> {
  return uploadStorageImage({
    folderPath: buildHomeNewsImageFolder(newsId),
    file,
    maxWidth: 1920,
  });
}

export function deleteHomeNewsImage(storagePathOrUrl?: string | null) {
  return deleteStorageImageQuietly(storagePathOrUrl, "immagine news");
}
