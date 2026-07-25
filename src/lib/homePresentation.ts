import type { HomeNews } from "../types";

export const HOME_SECTION_ORDER = ["hero", "news", "championships", "albo"] as const;
export const HOME_NEWS_TITLE = "PALA PADEL NEWS";
export const HOME_NEWS_SUBTITLE = "Risultati, aggiornamenti e novità dal mondo PalaPadel.";

export function getPublishedNewsForHome(news: HomeNews[]): HomeNews[] {
  return news
    .filter((item) => item.status === "pubblicato")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
