import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import type { HomeNews } from "../types";
import { NEWS_LIKE_EVENT, getLastKnownLikeCount, hasLikedNews, setNewsLike } from "../lib/newsSocial";

/**
 * "Mi piace" di una news: uno per dispositivo, senza login. La versione compatta va
 * sulle schede (Home e pagina News), quella grande nel dettaglio. Tutti i pulsanti della
 * stessa news restano allineati tra loro.
 */
export function NewsLikeButton({
  news,
  compact = false,
  onError,
}: {
  news: HomeNews;
  compact?: boolean;
  onError?: (message: string) => void;
}) {
  const [liked, setLiked] = useState(() => hasLikedNews(news.id));
  const [countOverride, setCountOverride] = useState<number | null>(() => getLastKnownLikeCount(news.id));
  const [saving, setSaving] = useState(false);
  const count = countOverride ?? Math.max(0, news.likeCount ?? 0);

  // Quando arriva il totale aggiornato dal database, vale quello.
  const firstCount = useRef(news.likeCount);
  useEffect(() => {
    if (news.likeCount === firstCount.current) return;
    firstCount.current = news.likeCount;
    setCountOverride(null);
  }, [news.likeCount]);

  useEffect(() => {
    const onLike = (event: Event) => {
      const detail = (event as CustomEvent<{ newsId: string; liked: boolean; likeCount: number | null }>).detail;
      if (detail?.newsId !== news.id) return;
      setLiked(detail.liked);
      setCountOverride(detail.likeCount);
    };
    window.addEventListener(NEWS_LIKE_EVENT, onLike);
    return () => window.removeEventListener(NEWS_LIKE_EVENT, onLike);
  }, [news.id]);

  const toggle = async () => {
    if (saving) return;
    const next = !liked;
    setSaving(true);
    try {
      await setNewsLike(news.id, next, Math.max(0, count + (next ? 1 : -1)));
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Mi piace non salvato.");
    } finally {
      setSaving(false);
    }
  };

  const label = `${liked ? "Togli mi piace" : "Metti mi piace"} (${count} ${count === 1 ? "mi piace" : "mi piace in totale"})`;

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={liked}
        aria-label={label}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12.5px] font-bold tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#BBFF5E] ${
          liked ? "text-[#FF8FA6]" : "text-[rgba(251,243,222,0.65)]"
        }`}
      >
        <Heart size={15} fill={liked ? "currentColor" : "none"} />
        {count}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={label}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#BBFF5E] ${
        liked ? "border-[#FF6B8A] bg-[rgba(255,107,138,0.14)] text-[#FF8FA6]" : "border-[rgba(251,243,222,0.2)] text-[#FBF3DE]"
      }`}
    >
      <Heart size={17} fill={liked ? "currentColor" : "none"} />
      {liked ? "Ti piace" : "Mi piace"}
      <span className="tabular-nums text-[rgba(251,243,222,0.7)]">{count}</span>
    </button>
  );
}
