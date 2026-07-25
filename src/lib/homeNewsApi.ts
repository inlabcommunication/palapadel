import { postToBackend } from "./backendClient";

export function deleteHomeNews(newsId: string) {
  return postToBackend<{ ok: true }>("/api/home-news/delete", { newsId });
}
