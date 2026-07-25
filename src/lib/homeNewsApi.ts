import { postToBackend } from "./backendClient";

export function deleteHomeNews(newsId: string) {
  return postToBackend<{ ok: true }>("/api/home-news/delete", { newsId });
}

export interface SaveHomeNewsInput {
  operation: "create" | "update";
  newsId: string;
  title: string;
  body: string;
  category?: string;
  status: "bozza" | "pubblicato";
  date?: string;
  imageUrl?: string;
  imageStoragePath?: string;
  imageAlt?: string | null;
}

export function saveHomeNews(input: SaveHomeNewsInput) {
  return postToBackend<{ ok: true }>("/api/home-news/upsert", input);
}

export function removeHomeNewsImage(newsId: string) {
  return postToBackend<{ ok: true }>("/api/home-news/upsert", { operation: "removeImage", newsId });
}
