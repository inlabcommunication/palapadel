import { useState } from "react";
import { where } from "firebase/firestore";
import { ChevronRight, Megaphone, Newspaper, X } from "lucide-react";
import { useCollection } from "../hooks/useCollection";
import { getNewsExcerpt, getNewsImageAlt } from "../lib/homeNewsImagePolicy";
import { getPublishedNewsForHome } from "../lib/homePresentation";
import type { HomeNews } from "../types";

export function NewsPage() {
  const newsQuery = useCollection<HomeNews>("homeNews", [
    where("status", "==", "pubblicato"),
  ]);
  const { data: news, loading, error } = newsQuery;
  const [selectedNews, setSelectedNews] = useState<HomeNews | null>(null);
  const publishedNews = getPublishedNewsForHome(news);

  return (
    <div className="p-4 pb-6">
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <Newspaper size={16} className="text-[#BBFF5E]" />
          <h1 className="font-display text-[30px] leading-none text-[#FBF3DE]">NEWS</h1>
        </div>
        <p className="mt-2 text-[13px] text-[rgba(251,243,222,0.62)]">
          Tutte le notizie e gli aggiornamenti PalaPadel.
        </p>
      </div>

      {loading && <NewsEmpty text="Caricamento delle news..." />}
      {!loading && error && (
        <div className="rounded-lg border border-[rgba(251,243,222,0.12)] p-4">
          <p className="text-sm">{error.message}</p>
          <button onClick={newsQuery.retry} className="mt-2 text-sm font-bold text-[#BBFF5E]">Riprova</button>
        </div>
      )}
      {!loading && !error && publishedNews.length === 0 && <NewsEmpty text="Nessuna news pubblicata al momento." />}

      {!error && <div className="grid gap-3 sm:grid-cols-2">
        {publishedNews.map((item, index) => (
          <article
            key={item.id}
            className={`overflow-hidden rounded-lg border border-[rgba(251,243,222,0.10)] bg-[#0A0B08] ${
              index === 0 ? "sm:col-span-2" : ""
            }`}
          >
            <NewsCover news={item} eager={index === 0} />
            <div className="p-4">
              <p className="mb-2 flex flex-wrap gap-x-2 text-[11px] font-bold uppercase text-[rgba(251,243,222,0.48)]">
                <span className="text-[#BBFF5E]">{item.category ?? "PalaPadel"}</span>
                <span>{formatDate(item.publishedAt ?? item.date)}</span>
              </p>
              <h2 className={`${index === 0 ? "font-display text-[25px]" : "text-[16px] font-bold"} leading-tight`}>
                {item.title}
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[rgba(251,243,222,0.66)]">
                {getNewsExcerpt(item.body, index === 0 ? 220 : 130)}
              </p>
              <button
                type="button"
                onClick={() => setSelectedNews(item)}
                className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-bold text-[#BBFF5E]"
              >
                Leggi tutto <ChevronRight size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>}

      {selectedNews && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
          onClick={() => setSelectedNews(null)}
        >
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="news-detail-title"
            className="max-h-[calc(100dvh-48px-env(safe-area-inset-bottom))] w-full max-w-2xl overflow-y-auto rounded-lg border border-[rgba(251,243,222,0.12)] bg-[#0A0B08]"
            onClick={(event) => event.stopPropagation()}
          >
            <NewsCover news={selectedNews} eager />
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="flex flex-wrap gap-x-2 text-[11px] font-bold uppercase text-[rgba(251,243,222,0.48)]">
                  <span className="text-[#BBFF5E]">{selectedNews.category ?? "PalaPadel"}</span>
                  <span>{formatDate(selectedNews.publishedAt ?? selectedNews.date)}</span>
                </p>
                <button
                  type="button"
                  aria-label="Chiudi dettaglio news"
                  onClick={() => setSelectedNews(null)}
                  className="rounded-full bg-[rgba(251,243,222,0.08)] p-2"
                >
                  <X size={17} />
                </button>
              </div>
              <h2 id="news-detail-title" className="mt-2 font-display text-[28px] leading-tight sm:text-[38px]">
                {selectedNews.title}
              </h2>
              <p className="mt-4 whitespace-pre-line text-[14px] leading-relaxed text-[rgba(251,243,222,0.74)]">
                {selectedNews.body}
              </p>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}

function NewsCover({ news, eager = false }: { news: HomeNews; eager?: boolean }) {
  if (news.imageUrl) {
    return (
      <img
        src={news.imageUrl}
        alt={getNewsImageAlt(news.title, news.imageAlt)}
        className="aspect-video w-full object-cover"
        style={{ objectPosition: `50% ${news.imagePositionY ?? 50}%` }}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }

  return (
    <div className="flex aspect-video w-full items-center justify-center bg-[#123008] text-[rgba(187,255,94,0.44)]">
      <Newspaper size={32} />
      <Megaphone size={24} className="ml-2" />
    </div>
  );
}

function NewsEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[rgba(251,243,222,0.16)] px-4 py-8 text-center text-[13px] text-[rgba(251,243,222,0.48)]">
      {text}
    </div>
  );
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}
