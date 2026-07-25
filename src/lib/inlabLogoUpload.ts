import { deleteStorageImageQuietly, uploadStorageImage, type UploadedStorageImage } from "./storageImageUpload";

export { INLAB_LOGO_ALT, INLAB_LOGO_FOLDER, INLAB_INSTAGRAM_URL } from "./inlabLogoPolicy";
import { INLAB_LOGO_FOLDER } from "./inlabLogoPolicy";

export function uploadInlabLogo(file: File): Promise<UploadedStorageImage> {
  return uploadStorageImage({
    folderPath: INLAB_LOGO_FOLDER,
    file,
    maxWidth: 512,
  });
}

export function deleteInlabLogo(storagePathOrUrl?: string | null) {
  return deleteStorageImageQuietly(storagePathOrUrl, "logo InLab");
}
