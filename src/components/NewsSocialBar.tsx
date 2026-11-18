import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Download, Facebook, Instagram, Link2, MessageCircle, Share2, X } from "lucide-react";
import type { HomeNews } from "../types";
import { copyText } from "../lib/newsSocial";
import { NewsLikeButton } from "./NewsLikeButton";
import { getFacebookShareUrl, getNewsShareUrl, getWhatsAppShareUrl } from "../lib/newsShareLinks";
import { generateNewsStoryImage, type GeneratedNewsStory } from "../lib/newsStoryImage";

/**
 * Sotto una news: "mi piace" (uno per dispositivo, senza login) e condivisione su
 * WhatsApp, Facebook, Instagram (immagine per le Storie), copia link e, da telefono,
 * il pannello di condivisione del sistema.
 */
export function NewsSocialBar({ news }: { news: HomeNews }) {
  const [message, setMessage] = useState<string | null>(null);
  const [storyOpen, setStoryOpen] = useState(false);
  const shareUrl = getNewsShareUrl(news.id);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [message]);

  const copyLink = async () => {
    setMessage((await copyText(shareUrl)) ? "Link copiato." : "Copia non riuscita.");
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: news.title, text: news.title, url: shareUrl });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setMessage("Condivisione non disponibile.");
    }
  };

  const shareButton = "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-semibold text-[rgba(251,243,222,0.8)] hover:bg-[rgba(251,243,222,0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#BBFF5E]";

  return (
    <div className="mt-5 border-t border-[rgba(251,243,222,0.10)] pt-4">
      <NewsLikeButton news={news} onError={setMessage} />

      <p className="mt-4 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[rgba(251,243,222,0.5)]">Condividi</p>
      <div className={`grid gap-1 ${canNativeShare ? "grid-cols-5" : "grid-cols-4"}`}>
        <a href={getWhatsAppShareUrl(news.title, shareUrl)} target="_blank" rel="noopener noreferrer" className={shareButton} aria-label="Condividi su WhatsApp">
          <MessageCircle size={22} className="text-[#25D366]" /> WhatsApp
        </a>
        <a href={getFacebookShareUrl(shareUrl)} target="_blank" rel="noopener noreferrer" className={shareButton} aria-label="Condividi su Facebook">
          <Facebook size={22} className="text-[#4C8DF6]" /> Facebook
        </a>
        <button type="button" onClick={() => setStoryOpen(true)} className={shareButton} aria-label="Condividi nelle Storie di Instagram">
          <Instagram size={22} className="text-[#F06BA8]" /> Instagram
        </button>
        <button type="button" onClick={copyLink} className={shareButton} aria-label="Copia il link della news">
          <Link2 size={22} className="text-[#BBFF5E]" /> Copia link
        </button>
        {canNativeShare && (
          <button type="button" onClick={nativeShare} className={shareButton} aria-label="Altre app">
            <Share2 size={22} className="text-[#FBF3DE]" /> Altro
          </button>
        )}
      </div>
      {message && <p role="status" className="mt-2 text-[12px] text-[#BBFF5E]">{message}</p>}

      {storyOpen && <InstagramStorySheet news={news} shareUrl={shareUrl} onClose={() => setStoryOpen(false)} />}
    </div>
  );
}

function downloadStory(story: GeneratedNewsStory) {
  const url = URL.createObjectURL(story.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = story.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

function InstagramStorySheet({ news, shareUrl, onClose }: { news: HomeNews; shareUrl: string; onClose: () => void }) {
  const [story, setStory] = useState<GeneratedNewsStory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    generateNewsStoryImage(news, shareUrl)
      .then((generated) => !cancelled && setStory(generated))
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError("Non è stato possibile creare l'immagine.");
      });
    return () => {
      cancelled = true;
    };
  }, [news, shareUrl]);

  // Il pannello di condivisione va aperto dal tocco dell'utente: per questo l'immagine
  // si prepara prima e la condivisione parte solo dal pulsante "Condividi".
  const share = async () => {
    if (!story) return;
    setLinkCopied(await copyText(shareUrl));
    const file = new File([story.blob], story.filename, { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      downloadStory(story);
      setNote("Il browser non apre Instagram direttamente: l'immagine è stata scaricata, caricala nella tua Storia.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      downloadStory(story);
      setNote("Condivisione non disponibile: l'immagine è stata scaricata.");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/80 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-center" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-sheet-title"
        className="w-full max-w-sm rounded-2xl border border-[rgba(251,243,222,0.12)] bg-[#0A0B08] p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="story-sheet-title" className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE]">
            <Instagram size={16} className="text-[#F06BA8]" /> Storia Instagram
          </h2>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="rounded-full bg-[rgba(251,243,222,0.08)] p-1.5">
            <X size={15} />
          </button>
        </div>

        <div className="mx-auto aspect-[9/16] max-h-[52dvh] overflow-hidden rounded-xl bg-[#123008]">
          {story ? (
            <img src={story.dataUrl} alt={`Anteprima della Storia: ${news.title}`} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-[12.5px] text-[rgba(251,243,222,0.6)]">
              {error ?? "Preparo l'immagine..."}
            </div>
          )}
        </div>

        <ol className="mt-3 list-decimal space-y-1 pl-5 text-[12px] leading-relaxed text-[rgba(251,243,222,0.72)]">
          <li>Tocca <strong className="text-[#FBF3DE]">Condividi</strong> e scegli <strong className="text-[#FBF3DE]">Instagram → Storia</strong>.</li>
          <li>Il link della news viene copiato: in Instagram aggiungi lo sticker <strong className="text-[#FBF3DE]">Link</strong> e incollalo.</li>
        </ol>
        {linkCopied && (
          <p className="mt-2 flex items-center gap-1 text-[12px] text-[#BBFF5E]"><Check size={13} /> Link copiato negli appunti.</p>
        )}
        {note && <p role="status" className="mt-2 text-[12px] text-[#FF9B6B]">{note}</p>}

        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <button type="button" onClick={share} disabled={!story} className="rounded-full bg-[#BBFF5E] py-2.5 text-sm font-bold text-[#081208] disabled:opacity-40">
            Condividi
          </button>
          <button
            type="button"
            onClick={() => story && downloadStory(story)}
            disabled={!story}
            aria-label="Scarica l'immagine"
            className="rounded-full border border-[rgba(251,243,222,0.2)] px-4 text-[#FBF3DE] disabled:opacity-40"
          >
            <Download size={16} />
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
