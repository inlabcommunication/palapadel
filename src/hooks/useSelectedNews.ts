import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { HomeNews } from "../types";

/**
 * News aperta nel dettaglio. Si apre toccando "Leggi tutto" oppure arrivando da un link
 * condiviso (/news/:newsId, o /news?news=ID come riserva). Ritorna sempre la versione
 * aggiornata della news dalla lista (es. il numero di mi piace in tempo reale).
 */
export function useSelectedNews(news: HomeNews[]) {
  const { newsId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const linkedId = newsId ?? searchParams.get("news") ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(linkedId);

  useEffect(() => {
    if (linkedId) setSelectedId(linkedId);
  }, [linkedId]);

  const close = useCallback(() => {
    setSelectedId(null);
    // Chiudendo una news aperta da link si torna all'elenco, senza lasciare l'ID nell'indirizzo.
    if (linkedId) navigate("/news", { replace: true });
  }, [linkedId, navigate]);

  const selectedNews = selectedId ? news.find((item) => item.id === selectedId) ?? null : null;
  return { selectedNews, open: (item: HomeNews) => setSelectedId(item.id), close };
}
