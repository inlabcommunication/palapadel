import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, where } from "firebase/firestore";
import { ImageUploadField } from "../components/ImageUploadField";
import { useCollection } from "../hooks/useCollection";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import { confirmDelete } from "../lib/confirmDelete";
import { deleteHomeNewsImage, getNewsExcerpt, getNewsImageAlt, uploadHomeNewsImage } from "../lib/homeNewsImageUpload";
import { getPublishedNewsForHome, HOME_NEWS_SUBTITLE, HOME_NEWS_TITLE } from "../lib/homePresentation";
import { notifyNotificationEvent } from "../lib/notificationClient";
import { deleteHomeNews as deleteHomeNewsRecord, removeHomeNewsImage, saveHomeNews } from "../lib/homeNewsApi";
import type { PublicSettings } from "../lib/publicSettingsApi";
import type { ChampionshipEdition, ChampionshipType, ContentStatus, HomeNews, Matchday } from "../types";
import { BADGE_COLORS } from "../types";
import { ChevronRight, AlertCircle, Plus, X, Pencil, Trash2, Trophy, Megaphone, CalendarDays, Newspaper } from "lucide-react";
import { sortEditionsByTypeOrder } from "../lib/championshipOrder";

export function HomePage() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "superAdmin";

  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const { data: editions, loading } = useCollection<ChampionshipEdition>(
    "championshipEditions",
    isAdmin ? [] : [where("status", "in", ["attiva", "conclusa"]), where("isPubliclyVisible", "==", true)],
    [isAdmin]
  );
  const { data: news, loading: newsLoading } = useCollection<HomeNews>(
    "homeNews",
    isAdmin ? [] : [where("status", "==", "pubblicato")],
    [isAdmin]
  );
  const { data: publicSettings } = useCollection<PublicSettings>("publicSettings");
  const globalSettings = publicSettings.find((item) => item.id === "global");

  const [showNewsForm, setShowNewsForm] = useState(false);
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [selectedNews, setSelectedNews] = useState<HomeNews | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const visibleEditions = editions
    .filter((edition) => isAdmin || edition.isPubliclyVisible !== false);
  const orderedVisibleEditions = sortEditionsByTypeOrder(visibleEditions, types);
  const active = orderedVisibleEditions.filter((e) => e.status === "attiva");
  const concluded = editions
    .filter((e) => e.status === "conclusa" && (isAdmin || e.isPubliclyVisible !== false))
    .sort((a, b) => (a.season < b.season ? 1 : -1))
    .slice(0, 3);

  const publishedNews = getPublishedNewsForHome(news);
  const draftNews = isAdmin
    ? news
        .filter((n) => n.status === "bozza")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];
  const mainNews = publishedNews[0];
  const secondaryNews = publishedNews.slice(1);

  const typeById = (id: string) => types.find((t) => t.id === id);

  const removeNews = async (n: HomeNews) => {
    if (!confirmDelete(n.title)) return;
    try {
      await deleteHomeNewsRecord(n.id);
      showToast("News eliminata.");
    } catch (err) {
      console.error(err);
      showToast("Errore nell'eliminazione.");
    }
  };

  return (
    <div className="p-4 pb-6">
      {globalSettings?.publicNoticeEnabled && globalSettings.publicNotice && (
        <div role="status" className="mb-4 rounded-lg border border-[rgba(187,255,94,0.28)] bg-[#0A0B08] px-4 py-3 text-sm text-[#FBF3DE]">
          {globalSettings.publicNotice}
        </div>
      )}
      <div className="relative overflow-hidden rounded-2xl mb-8 px-5 py-6 bg-gradient-to-br from-[#1F4A15] via-[#123008] to-[#0A0B08]">
        <div className="hero-padel-ball" aria-hidden="true">
          <span />
          <span />
        </div>
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#123008] bg-[#BBFF5E] rounded-full px-2.5 py-1 mb-3">
            <Trophy size={11} /> Stagione in corso
          </span>
          <h1 className="font-display text-[26px] uppercase leading-[1.05] text-[#FBF3DE] max-w-[82%]">
            Tornei, campionati
            <br />e classifiche
          </h1>
          <p className="text-[12.5px] text-[rgba(251,243,222,0.6)] mt-2 max-w-[78%]">
            Tutto il campionato PalaPadel in un posto solo.
          </p>
        </div>
      </div>

      <div id="news" className="scroll-mt-24 flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="font-display text-[28px] sm:text-[38px] leading-none text-[#FBF3DE]">{HOME_NEWS_TITLE}</h2>
          <p className="text-[13px] sm:text-[14px] text-[rgba(251,243,222,0.62)] mt-2">
            {HOME_NEWS_SUBTITLE}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowNewsForm((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-[#BBFF5E] shrink-0">
            {showNewsForm ? <X size={14} /> : <Plus size={14} />}
            {showNewsForm ? "Annulla" : "Nuova"}
          </button>
        )}
      </div>

      {showNewsForm && isAdmin && (
        <NewsForm
          onDone={(msg) => {
            showToast(msg);
            setShowNewsForm(false);
          }}
        />
      )}

      {newsLoading ? (
        <EmptyHint text="Caricamento comunicazioni..." />
      ) : publishedNews.length === 0 ? (
        <EmptyHint text="Nessuna comunicazione pubblicata." />
      ) : (
        <div className={`grid gap-4 ${secondaryNews.length > 0 ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] lg:items-start" : ""}`}>
          {mainNews &&
            (editingNewsId === mainNews.id ? (
              <EditNewsForm
                news={mainNews}
                onCancel={() => setEditingNewsId(null)}
                onDone={(msg) => {
                  showToast(msg);
                  setEditingNewsId(null);
                }}
              />
            ) : (
              <NewsCard
                news={mainNews}
                featured
                isAdmin={isAdmin}
                onRead={() => setSelectedNews(mainNews)}
                onEdit={() => setEditingNewsId(mainNews.id)}
                onDelete={() => removeNews(mainNews)}
              />
            ))}
          {secondaryNews.length > 0 && (
            <div className="flex flex-col gap-3">
              {secondaryNews.map((n) =>
                editingNewsId === n.id ? (
                  <EditNewsForm
                    key={n.id}
                    news={n}
                    onCancel={() => setEditingNewsId(null)}
                    onDone={(msg) => {
                      showToast(msg);
                      setEditingNewsId(null);
                    }}
                  />
                ) : (
                  <NewsCard
                    key={n.id}
                    news={n}
                    isAdmin={isAdmin}
                    onRead={() => setSelectedNews(n)}
                    onEdit={() => setEditingNewsId(n.id)}
                    onDelete={() => removeNews(n)}
                  />
                )
              )}
            </div>
          )}
        </div>
      )}

      {draftNews.length > 0 && (
        <div className="mt-5">
          <SectionTitle>Bozze Home</SectionTitle>
          <div className="flex flex-col gap-3">
            {draftNews.map((n) =>
              editingNewsId === n.id ? (
                <EditNewsForm
                  key={n.id}
                  news={n}
                  onCancel={() => setEditingNewsId(null)}
                  onDone={(msg) => {
                    showToast(msg);
                    setEditingNewsId(null);
                  }}
                />
              ) : (
                <NewsCard
                  key={n.id}
                  news={n}
                  isAdmin={isAdmin}
                  onRead={() => setSelectedNews(n)}
                  onEdit={() => setEditingNewsId(n.id)}
                  onDelete={() => removeNews(n)}
                />
              )
            )}
          </div>
        </div>
      )}

      <SectionTitle className="mt-8">CAMPIONATI IN CORSO</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {loading && <EmptyHint text="Carico i campionati..." />}
        {!loading && active.length === 0 && <EmptyHint text="Nessun campionato attivo al momento." />}
        {active.map((ed) => (
          <ChampionshipCard
            key={ed.id}
            edition={ed}
            type={typeById(ed.typeId)}
            onOpen={() => navigate(`/campionati/${ed.id}`)}
            onOpenCalendar={() => navigate(`/campionati/${ed.id}?tab=calendar`)}
          />
        ))}
      </div>

      <SectionTitle className="mt-8">Albo d'oro</SectionTitle>
      <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={17} className="text-[#F5C842]" />
          <p className="text-[13px] text-[rgba(251,243,222,0.62)]">Vincitori storici e campionati conclusi.</p>
        </div>
        {concluded.length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
            {concluded.map((ed) => (
              <button key={ed.id} onClick={() => navigate("/albo")} className="flex items-center justify-between gap-3 text-left bg-[#123008] rounded-lg px-3 py-2">
                <span className="text-[13px] font-semibold truncate">
                  {typeById(ed.typeId)?.name ?? "Campionato"} {ed.season}
                </span>
                <ChevronRight size={14} className="text-[#BBFF5E] shrink-0" />
              </button>
            ))}
          </div>
        )}
        <button onClick={() => navigate("/albo")} className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold">
          Apri Albo d'oro
        </button>
      </div>

      {selectedNews && <NewsModal news={selectedNews} onClose={() => setSelectedNews(null)} />}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#0A0B08] text-[#FBF3DE] border border-[rgba(187,255,94,0.3)] px-4 py-2.5 rounded-full text-[12.5px] max-w-[90%] text-center z-20">
          {toast}
        </div>
      )}
    </div>
  );
}

function NewsCard({
  news,
  featured = false,
  isAdmin,
  onRead,
  onEdit,
  onDelete,
}: {
  news: HomeNews;
  featured?: boolean;
  isAdmin: boolean;
  onRead: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="overflow-hidden bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
      <NewsImage news={news} featured={featured} />
      <div className={featured ? "p-4 sm:p-5" : "p-3.5"}>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[rgba(251,243,222,0.45)] mb-2">
          <span className="text-[#BBFF5E]">{news.category ?? "Pala Padel"}</span>
          <span>{formatDate(news.date)}</span>
          {isAdmin && news.status === "bozza" && <span>bozza</span>}
        </div>
        <h3 className={featured ? "font-display text-[24px] sm:text-[36px] leading-[1.05] text-[#FBF3DE]" : "font-bold text-[15px] text-[#FBF3DE] leading-snug"}>
          {news.title}
        </h3>
        <p
          className={featured ? "text-[14px] sm:text-[15px] text-[rgba(251,243,222,0.68)] mt-3 leading-relaxed" : "text-[13px] text-[rgba(251,243,222,0.60)] mt-2 leading-relaxed"}
          style={{ display: "-webkit-box", WebkitLineClamp: featured ? 6 : 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {news.body}
        </p>
        <div className="flex items-center justify-between gap-3 mt-3">
          <button onClick={onRead} className="flex items-center gap-1 text-[#BBFF5E] text-[12.5px] font-bold">
            Leggi tutto <ChevronRight size={14} />
          </button>
          {isAdmin && (
            <div className="flex items-center gap-3">
              <button onClick={onEdit} className="flex items-center gap-1 text-[#BBFF5E] text-xs font-semibold">
                <Pencil size={13} /> Modifica
              </button>
              <button onClick={onDelete} className="flex items-center gap-1 text-[#FF6B6B] text-xs font-semibold">
                <Trash2 size={13} /> Elimina
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function NewsImage({ news, featured }: { news: HomeNews; featured: boolean }) {
  const className = featured ? "w-full aspect-[16/9] object-cover" : "w-full aspect-[16/9] object-cover";
  if (news.imageUrl) {
    return (
      <img
        src={news.imageUrl}
        alt={getNewsImageAlt(news.title, news.imageAlt)}
        className={className}
        style={{
          objectPosition: `50% ${news.imagePositionY ?? 50}%`,
          transform: `scale(${news.imageScale ?? 1})`,
        }}
        loading={featured ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }
  return (
    <div className={`${className} bg-[#123008] flex items-center justify-center`}>
      <div className="flex items-center gap-2 text-[rgba(187,255,94,0.45)]">
        <Newspaper size={featured ? 34 : 24} />
        <Megaphone size={featured ? 26 : 19} />
      </div>
    </div>
  );
}

function NewsModal({ news, onClose }: { news: HomeNews; onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:items-center sm:py-6" onClick={onClose}>
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-news-modal-title"
        className="w-full max-w-2xl overflow-y-auto rounded-2xl border border-[rgba(251,243,222,0.10)] bg-[#0A0B08] shadow-2xl max-h-[calc(100dvh-8rem-env(safe-area-inset-bottom))] sm:max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <NewsImage news={news} featured />
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[rgba(251,243,222,0.45)]">
              <span className="text-[#BBFF5E]">{news.category ?? "Pala Padel"}</span>
              <span> · {formatDate(news.date)}</span>
            </div>
            <button onClick={onClose} aria-label="Chiudi notizia" className="sticky top-2 bg-[rgba(251,243,222,0.08)] rounded-full p-1.5 shrink-0">
              <X size={16} className="text-[#FBF3DE]" />
            </button>
          </div>
          <h3 id="home-news-modal-title" className="font-display text-[26px] sm:text-[38px] leading-[1.05] text-[#FBF3DE]">{news.title}</h3>
          <p className="whitespace-pre-line text-[14px] sm:text-[15px] text-[rgba(251,243,222,0.72)] mt-4 leading-relaxed">{news.body}</p>
        </div>
      </article>
    </div>
  );
}

function NewsForm({ onDone }: { onDone: (msg: string) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState("");
  const [imagePositionY, setImagePositionY] = useState(50);
  const [imageScale, setImageScale] = useState(1);
  const [imageError, setImageError] = useState<string | null>(null);
  const [status, setStatus] = useState<ContentStatus>("pubblicato");
  const [saving, setSaving] = useState(false);
  const imagePreviewUrl = useObjectUrl(imageFile);
  const previewNews = buildPreviewNews({
    id: "new-preview",
    title,
    body,
    category,
    status,
    imageUrl: imagePreviewUrl,
    imageAlt,
    imagePositionY,
    imageScale,
    date: new Date().toISOString(),
  });

  const submit = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    setImageError(null);
    const newsRef = doc(collection(db, "homeNews"));
    let uploadedImage: Awaited<ReturnType<typeof uploadHomeNewsImage>> | null = null;
    try {
      if (imageFile) {
        uploadedImage = await uploadHomeNewsImage(newsRef.id, imageFile);
      }
      await saveHomeNews({
        operation: "create",
        newsId: newsRef.id,
        title: title.trim(),
        body: body.trim(),
        date: new Date().toISOString(),
        status,
        category: category.trim() || undefined,
        ...(uploadedImage
          ? {
              imageUrl: uploadedImage.url,
              imageStoragePath: uploadedImage.storagePath,
              imageAlt: getNewsImageAlt(title, imageAlt),
              imagePositionY,
              imageScale,
            }
          : {}),
      });
      if (status === "pubblicato") {
        try {
          await notifyNotificationEvent(
            {
              type: "news",
              title: title.trim(),
              body: body.trim(),
              url: "/",
            },
            `home-news-${newsRef.id}`,
            `homeNews/${newsRef.id}`
          );
        } catch (err) {
          console.error("Errore notifica news", err);
        }
      }
      onDone(status === "pubblicato" ? "Novita pubblicata." : "Bozza salvata.");
    } catch (err) {
      if (uploadedImage) await deleteHomeNewsImage(uploadedImage.storagePath);
      console.error(err);
      const msg = getImageErrorMessage(err, "Errore nella pubblicazione della news.");
      setImageError(msg);
      onDone(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-xl p-3.5 mb-3 xl:p-5">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
        <div>
          <input
            placeholder="Titolo"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
          />
          <input
            placeholder="Categoria (opzionale)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
          />
          <textarea
            placeholder="Testo della comunicazione"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2 min-h-[130px]"
          />
          <ImageUploadField
            label="Immagine della news"
            selectedFile={imageFile}
            currentAlt={getNewsImageAlt(title, imageAlt)}
            loading={saving}
            error={imageError}
            positionY={imagePositionY}
            onPositionYChange={setImagePositionY}
            scale={imageScale}
            onScaleChange={setImageScale}
            onFileChange={(file) => {
              setImageError(null);
              setImageFile(file);
            }}
          />
          <input
            placeholder="Descrizione dell'immagine (opzionale)"
            value={imageAlt}
            onChange={(e) => setImageAlt(e.target.value)}
            className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mt-2"
          />
        </div>
        <NewsEditorialPreviews news={previewNews} />
      </div>

      <div className="sticky bottom-3 mt-3 rounded-xl border border-[rgba(251,243,222,0.10)] bg-[#0A0B08]/95 p-2 backdrop-blur">
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setStatus("pubblicato")}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold ${status === "pubblicato" ? "bg-lime text-[#081208]" : "bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.85)]"}`}
          >
            Pubblica subito
          </button>
          <button
            onClick={() => setStatus("bozza")}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold ${status === "bozza" ? "bg-lime text-[#081208]" : "bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.85)]"}`}
          >
            Salva come bozza
          </button>
        </div>
        <button
          onClick={submit}
          disabled={saving || !title.trim() || !body.trim()}
          className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
        >
          {saving ? "Caricamento e salvataggio..." : "Salva"}
        </button>
      </div>
    </div>
  );
}

function EditNewsForm({
  news,
  onCancel,
  onDone,
}: {
  news: HomeNews;
  onCancel: () => void;
  onDone: (msg: string) => void;
}) {
  const [title, setTitle] = useState(news.title);
  const [body, setBody] = useState(news.body);
  const [category, setCategory] = useState(news.category ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState(news.imageAlt ?? "");
  const [imagePositionY, setImagePositionY] = useState(news.imagePositionY ?? 50);
  const [imageScale, setImageScale] = useState(news.imageScale ?? 1);
  const [imageError, setImageError] = useState<string | null>(null);
  const [status, setStatus] = useState<ContentStatus>(news.status);
  const [saving, setSaving] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);
  const imagePreviewUrl = useObjectUrl(imageFile);
  const effectiveImageUrl = imageFile ? imagePreviewUrl : news.imageUrl;
  const previewNews = buildPreviewNews({
    id: news.id,
    title,
    body,
    category,
    status,
    imageUrl: effectiveImageUrl,
    imageAlt,
    imagePositionY,
    imageScale,
    date: news.date,
  });

  const save = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    setImageError(null);
    let uploadedImage: Awaited<ReturnType<typeof uploadHomeNewsImage>> | null = null;
    try {
      const updates = {
        operation: "update" as const,
        newsId: news.id,
        title: title.trim(),
        body: body.trim(),
        category: category.trim() || undefined,
        status,
        imageAlt: news.imageUrl ? getNewsImageAlt(title, imageAlt) : imageAlt.trim() || null,
        imageUrl: undefined as string | undefined,
        imageStoragePath: undefined as string | undefined,
        imagePositionY,
        imageScale,
      };
      if (imageFile) {
        uploadedImage = await uploadHomeNewsImage(news.id, imageFile);
        updates.imageUrl = uploadedImage.url;
        updates.imageStoragePath = uploadedImage.storagePath;
        updates.imageAlt = getNewsImageAlt(title, imageAlt);
      }

      await saveHomeNews(updates);
      const previousImage = news.imageStoragePath ?? news.imageUrl;
      if (uploadedImage && previousImage) await deleteHomeNewsImage(previousImage);
      if (status === "pubblicato" && news.status !== "pubblicato") {
        try {
          await notifyNotificationEvent(
            {
              type: "news",
              title: title.trim(),
              body: body.trim(),
              url: "/",
            },
            `home-news-${news.id}`,
            `homeNews/${news.id}`
          );
        } catch (err) {
          console.error("Errore notifica news", err);
        }
      }
      onDone("Novita aggiornata.");
    } catch (err) {
      if (uploadedImage) await deleteHomeNewsImage(uploadedImage.storagePath);
      console.error(err);
      const msg = getImageErrorMessage(err, "Errore nel salvataggio della news.");
      setImageError(msg);
      onDone(msg);
    } finally {
      setSaving(false);
    }
  };

  const deleteSavedImage = async () => {
    if (!news.imageUrl) return;
    if (!confirmDelete("l'immagine della news")) return;
    setDeletingImage(true);
    setImageError(null);
    try {
      await removeHomeNewsImage(news.id);
      onDone("Immagine eliminata.");
    } catch (err) {
      console.error(err);
      setImageError(getImageErrorMessage(err, "Errore nell'eliminazione dell'immagine."));
    } finally {
      setDeletingImage(false);
    }
  };

  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-xl p-3.5 xl:p-5">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
        <div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Categoria"
            className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2 min-h-[130px]"
          />
          <ImageUploadField
            label="Immagine della news"
            currentUrl={news.imageUrl}
            currentAlt={getNewsImageAlt(title, imageAlt)}
            selectedFile={imageFile}
            loading={saving || deletingImage}
            error={imageError}
            positionY={imagePositionY}
            onPositionYChange={setImagePositionY}
            scale={imageScale}
            onScaleChange={setImageScale}
            onFileChange={(file) => {
              setImageError(null);
              setImageFile(file);
            }}
            onRemoveImage={deleteSavedImage}
          />
          <input
            placeholder="Descrizione dell'immagine (opzionale)"
            value={imageAlt}
            onChange={(e) => setImageAlt(e.target.value)}
            className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mt-2"
          />
        </div>
        <NewsEditorialPreviews news={previewNews} />
      </div>

      <div className="sticky bottom-3 mt-3 rounded-xl border border-[rgba(251,243,222,0.10)] bg-[#0A0B08]/95 p-2 backdrop-blur">
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setStatus("pubblicato")}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold ${status === "pubblicato" ? "bg-lime text-[#081208]" : "bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.85)]"}`}
          >
            Pubblicato
          </button>
          <button
            onClick={() => setStatus("bozza")}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold ${status === "bozza" ? "bg-lime text-[#081208]" : "bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.85)]"}`}
          >
            Bozza
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving || deletingImage || !title.trim() || !body.trim()}
            className="flex-1 bg-lime text-[#081208] rounded-lg py-2 text-sm font-bold disabled:opacity-50"
          >
            {saving ? "Caricamento e salvataggio..." : "Salva"}
          </button>
          <button onClick={onCancel} disabled={saving || deletingImage} className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2 text-sm font-semibold disabled:opacity-50">
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

function NewsEditorialPreviews({ news }: { news: HomeNews }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[rgba(251,243,222,0.44)]">Anteprima desktop</p>
        <article className="overflow-hidden rounded-xl border border-[rgba(251,243,222,0.10)] bg-[#0A0B08]">
          <NewsImage news={news} featured />
          <div className="p-3.5">
            <PreviewMeta news={news} />
            <h3 className="font-display text-[22px] leading-[1.05] text-[#FBF3DE]">{news.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[rgba(251,243,222,0.65)]">{getNewsExcerpt(news.body)}</p>
          </div>
        </article>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[rgba(251,243,222,0.44)]">Anteprima mobile</p>
        <article className="mx-auto max-w-[220px] overflow-hidden rounded-xl border border-[rgba(251,243,222,0.10)] bg-[#0A0B08]">
          <NewsImage news={news} featured={false} />
          <div className="p-3">
            <PreviewMeta news={news} />
            <h3 className="text-[14px] font-bold leading-snug text-[#FBF3DE]">{news.title}</h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[rgba(251,243,222,0.60)]">{getNewsExcerpt(news.body, 80)}</p>
          </div>
        </article>
      </div>
    </div>
  );
}

function PreviewMeta({ news }: { news: HomeNews }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-[rgba(251,243,222,0.45)]">
      <span className="text-[#BBFF5E]">{news.category ?? "Pala Padel"}</span>
      <span>{formatDate(news.date)}</span>
    </div>
  );
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);
  return url;
}

function buildPreviewNews({
  id,
  title,
  body,
  category,
  status,
  imageUrl,
  imageAlt,
  imagePositionY,
  imageScale,
  date,
}: {
  id: string;
  title: string;
  body: string;
  category: string;
  status: ContentStatus;
  imageUrl?: string;
  imageAlt?: string;
  imagePositionY?: number;
  imageScale?: number;
  date: string;
}): HomeNews {
  const previewTitle = title.trim() || "Titolo della news";
  return {
    id,
    title: previewTitle,
    body: body.trim() || "Estratto della news PalaPadel.",
    date,
    status,
    category: category.trim() || "Pala Padel",
    ...(imageUrl ? { imageUrl, imageAlt: getNewsImageAlt(previewTitle, imageAlt), imagePositionY, imageScale } : {}),
  };
}

function getImageErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return `${fallback} ${err.message}`;
  return fallback;
}

function ChampionshipCard({
  edition,
  type,
  onOpen,
  onOpenCalendar,
}: {
  edition: ChampionshipEdition;
  type?: ChampionshipType;
  onOpen: () => void;
  onOpenCalendar: () => void;
}) {
  const badge = BADGE_COLORS[type?.badgeColor ?? "serie-b"];
  const { data: matchdays } = useCollection<Matchday>("matchdays", [where("editionId", "==", edition.id)], [edition.id]);
  const latestMatchday = matchdays.length > 0 ? Math.max(...matchdays.map((m) => m.number)) : null;

  return (
    <div className="relative text-left bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl pl-4 pr-4 py-3.5 w-full overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: badge.text }} aria-hidden="true" />
      <div className="flex justify-between items-start gap-3">
        {type?.logoUrl && (
          <img src={type.logoUrl} alt={type.logoAlt ?? `Logo ${type.name}`} className="h-14 w-14 shrink-0 rounded-lg object-cover" loading="lazy" />
        )}
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider font-bold" style={{ color: badge.text }}>
            {type?.name ?? "Campionato"}
          </p>
          <p className="font-bold text-[17px] truncate mt-1">{edition.season}</p>
          <p className="text-[12.5px] text-[rgba(251,243,222,0.58)] mt-1">
            Ultima giornata: {latestMatchday ? `${latestMatchday}a` : "non ancora creata"}
          </p>
        </div>
        <span className="text-[10.5px] font-bold px-2 py-1 rounded-full shrink-0" style={{ background: badge.bg, color: badge.text }}>
          {edition.status === "conclusa" ? "conclusa" : "attiva"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button onClick={onOpen} className="bg-lime text-[#081208] rounded-lg py-2 text-[12px] font-bold">
          Classifica
        </button>
        <button onClick={onOpenCalendar} className="border border-[rgba(251,243,222,0.18)] rounded-lg py-2 text-[12px] font-semibold flex items-center justify-center gap-1">
          <CalendarDays size={13} /> Calendario
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE] mb-3 ${className}`}>{children}</h2>;
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="text-[12.5px] text-[rgba(251,243,222,0.50)] py-3 flex items-center">
      <AlertCircle size={14} className="mr-1.5 shrink-0" />
      {text}
    </div>
  );
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return d;
  }
}
