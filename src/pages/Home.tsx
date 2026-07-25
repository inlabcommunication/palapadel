import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, deleteDoc, doc, updateDoc, where } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import { confirmDelete } from "../lib/confirmDelete";
<<<<<<< HEAD
import { getPublishedNewsForHome, HOME_NEWS_SUBTITLE, HOME_NEWS_TITLE } from "../lib/homePresentation";
import { notifyNotificationEvent } from "../lib/notificationClient";
import type { ChampionshipEdition, ChampionshipType, ContentStatus, HomeNews, Matchday } from "../types";
import { BADGE_COLORS } from "../types";
import { ChevronRight, AlertCircle, Plus, X, Pencil, Trash2, Trophy, Megaphone, CalendarDays, Newspaper } from "lucide-react";
=======
import type { ChampionshipEdition, ChampionshipType, ContentStatus, HomeNews } from "../types";
import { BADGE_COLORS } from "../types";
import { ChevronRight, AlertCircle, Plus, X, Pencil, Trash2, Trophy, Megaphone } from "lucide-react";

>>>>>>> 548c33dadf9f8cee71b8ee2e0a31a2d11d373e4d

export function HomePage() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";

  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
<<<<<<< HEAD
=======
  // Il pubblico non deve nemmeno interrogare edizioni bozza/nascoste o novità in bozza:
  // le regole Firestore rifiuterebbero comunque la query, quindi il filtro va fatto qui,
  // non scaricando tutto e nascondendo il resto solo visivamente.
>>>>>>> 548c33dadf9f8cee71b8ee2e0a31a2d11d373e4d
  const { data: editions, loading } = useCollection<ChampionshipEdition>(
    "championshipEditions",
    isAdmin ? [] : [where("status", "in", ["attiva", "conclusa"])],
    [isAdmin]
  );
  const { data: news } = useCollection<HomeNews>(
    "homeNews",
    isAdmin ? [] : [where("status", "==", "pubblicato")],
    [isAdmin]
  );

  const [showNewsForm, setShowNewsForm] = useState(false);
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [selectedNews, setSelectedNews] = useState<HomeNews | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const active = editions.filter((e) => e.status === "attiva");
  const concluded = editions
    .filter((e) => e.status === "conclusa")
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
      await deleteDoc(doc(db, "homeNews", n.id));
      showToast("Novita eliminata.");
    } catch (err) {
      console.error(err);
      showToast("Errore nell'eliminazione.");
    }
  };

  return (
    <div className="p-4 pb-6">
      <div className="relative overflow-hidden rounded-2xl mb-8 px-5 py-6 bg-gradient-to-br from-[#1F4A15] via-[#123008] to-[#0A0B08]">
<<<<<<< HEAD
        <img src="/logo.png" alt="" className="absolute -right-8 -top-8 w-40 h-40 object-contain opacity-20 pointer-events-none" />
=======
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.14] pointer-events-none"
          viewBox="0 0 300 220"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <g transform="rotate(-16 150 110)" stroke="#FBF3DE" strokeWidth="1.4" fill="none">
            <rect x="20" y="30" width="260" height="160" />
            <line x1="150" y1="30" x2="150" y2="190" />
            <line x1="20" y1="70" x2="280" y2="70" />
            <line x1="20" y1="150" x2="280" y2="150" />
            <line x1="80" y1="30" x2="80" y2="190" />
            <line x1="220" y1="30" x2="220" y2="190" />
          </g>
        </svg>
        <svg
          className="absolute -top-3 -right-6 w-36 h-36 opacity-90 pointer-events-none"
          viewBox="0 0 210 210"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="heroArc" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#BBFF5E" stopOpacity="0" />
              <stop offset="1" stopColor="#BBFF5E" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <path d="M10 190 Q 40 60 190 20" stroke="url(#heroArc)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="190" cy="20" r="5" fill="#BBFF5E" />
        </svg>
>>>>>>> 548c33dadf9f8cee71b8ee2e0a31a2d11d373e4d
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#123008] bg-[#BBFF5E] rounded-full px-2.5 py-1 mb-3">
            <Trophy size={11} /> Stagione in corso
          </span>
<<<<<<< HEAD
          <h1 className="font-display text-[26px] uppercase leading-[1.05] text-[#FBF3DE] max-w-[82%]">
            Tornei, campionati
            <br />e classifiche
          </h1>
          <p className="text-[12.5px] text-[rgba(251,243,222,0.6)] mt-2 max-w-[78%]">
            Tutto il campionato PalaPadel in un posto solo.
          </p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="font-display text-[28px] sm:text-[38px] leading-none text-[#FBF3DE]">{HOME_NEWS_TITLE}</h2>
          <p className="text-[13px] sm:text-[14px] text-[rgba(251,243,222,0.62)] mt-2">
            {HOME_NEWS_SUBTITLE}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowNewsForm((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-[#BBFF5E] shrink-0">
=======
          <h1 className="font-display text-[26px] uppercase leading-[1.05] text-[#FBF3DE] max-w-[80%]">
            Tornei, campionati
            <br />e classifiche
          </h1>
          <p className="text-[12.5px] text-[rgba(251,243,222,0.6)] mt-2 max-w-[75%]">
            Tutto il campionato PalaPadel in un posto solo.
          </p>
        </div>
      </div>

      <SectionTitle>Campionati attivi</SectionTitle>
      <div className="flex flex-col gap-3">
        {loading && <EmptyHint text="Carico i campionati..." />}
        {!loading && active.length === 0 && <EmptyHint text="Nessun campionato attivo al momento." />}
        {active.map((ed) => (
          <ChampionshipCard
            key={ed.id}
            edition={ed}
            type={typeById(ed.typeId)}
            onClick={() => navigate(`/campionati/${ed.id}`)}
          />
        ))}
      </div>

      {concluded.length > 0 && (
        <>
          <SectionTitle className="mt-8">Campionati conclusi di recente</SectionTitle>
          <div className="flex flex-col gap-3">
            {concluded.map((ed) => (
              <ChampionshipCard
                key={ed.id}
                edition={ed}
                type={typeById(ed.typeId)}
                muted
                onClick={() => navigate("/storico")}
              />
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-between mt-8 mb-3">
        <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE]">Novità PalaPadel</h2>
        {isAdmin && (
          <button onClick={() => setShowNewsForm((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-[#BBFF5E]">
>>>>>>> 548c33dadf9f8cee71b8ee2e0a31a2d11d373e4d
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

<<<<<<< HEAD
      {publishedNews.length === 0 ? (
        <EmptyHint text="Nessuna comunicazione pubblicata." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
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
=======
      <div className="flex flex-col gap-3">
        {news.length === 0 && <EmptyHint text="Nessuna comunicazione pubblicata." />}
        {news.map((n) =>
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
            <div key={n.id} className="relative overflow-hidden bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl pl-4 pr-3.5 py-3.5">
              <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#BBFF5E]" aria-hidden="true" />
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-sm flex-1 flex items-center gap-1.5">
                  <Megaphone size={13} className="text-[#BBFF5E] shrink-0" />
                  {n.title}
                </p>
                {isAdmin && n.status === "bozza" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.58)] shrink-0">
                    bozza
                  </span>
                )}
              </div>
              <p className="text-[13px] text-[rgba(251,243,222,0.58)] mt-1">{n.body}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[11px] text-[rgba(251,243,222,0.35)]">{formatDate(n.date)}</p>
                {isAdmin && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setEditingNewsId(n.id)}
                      className="flex items-center gap-1 text-[#BBFF5E] text-xs font-semibold"
                    >
                      <Pencil size={13} /> Modifica
                    </button>
                    <button
                      onClick={() => removeNews(n)}
                      className="flex items-center gap-1 text-[#FF6B6B] text-xs font-semibold"
                    >
                      <Trash2 size={13} /> Elimina
                    </button>
                  </div>
                )}
              </div>
>>>>>>> 548c33dadf9f8cee71b8ee2e0a31a2d11d373e4d
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
  if (news.imageUrl) return <img src={news.imageUrl} alt={news.title} className={className} />;
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
  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/65 p-4" onClick={onClose}>
      <article
        className="w-full max-w-2xl bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl overflow-hidden max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <NewsImage news={news} featured />
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[rgba(251,243,222,0.45)]">
              <span className="text-[#BBFF5E]">{news.category ?? "Pala Padel"}</span>
              <span> · {formatDate(news.date)}</span>
            </div>
            <button onClick={onClose} className="bg-[rgba(251,243,222,0.08)] rounded-full p-1.5 shrink-0">
              <X size={16} className="text-[#FBF3DE]" />
            </button>
          </div>
          <h3 className="font-display text-[26px] sm:text-[38px] leading-[1.05] text-[#FBF3DE]">{news.title}</h3>
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
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<ContentStatus>("pubblicato");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "homeNews"), {
        title: title.trim(),
        body: body.trim(),
        date: new Date().toISOString(),
        status,
        ...(category.trim() ? { category: category.trim() } : {}),
        ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
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
            `home-news-${ref.id}`,
            `homeNews/${ref.id}`
          );
        } catch (err) {
          console.error("Errore notifica news", err);
        }
      }
      onDone(status === "pubblicato" ? "Novita pubblicata." : "Bozza salvata.");
    } catch (err) {
      console.error(err);
      onDone("Errore nella pubblicazione.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-xl p-3.5 mb-3">
      <input
        placeholder="Titolo"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
<<<<<<< HEAD
      />
      <input
        placeholder="Categoria (opzionale)"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <input
        placeholder="URL immagine (opzionale)"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
=======
>>>>>>> 548c33dadf9f8cee71b8ee2e0a31a2d11d373e4d
      />
      <textarea
        placeholder="Testo della comunicazione"
        value={body}
        onChange={(e) => setBody(e.target.value)}
<<<<<<< HEAD
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2 min-h-[90px]"
=======
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2 min-h-[70px]"
>>>>>>> 548c33dadf9f8cee71b8ee2e0a31a2d11d373e4d
      />
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
        {saving ? "In corso..." : "Salva"}
      </button>
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
  const [imageUrl, setImageUrl] = useState(news.imageUrl ?? "");
  const [status, setStatus] = useState<ContentStatus>(news.status);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "homeNews", news.id), {
        title: title.trim(),
        body: body.trim(),
        category: category.trim(),
        imageUrl: imageUrl.trim(),
        status,
      });
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
      console.error(err);
      onDone("Errore nel salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-xl p-3.5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
<<<<<<< HEAD
      />
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Categoria"
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <input
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        placeholder="URL immagine"
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
=======
>>>>>>> 548c33dadf9f8cee71b8ee2e0a31a2d11d373e4d
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
<<<<<<< HEAD
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2 min-h-[90px]"
=======
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2 min-h-[70px]"
>>>>>>> 548c33dadf9f8cee71b8ee2e0a31a2d11d373e4d
      />
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
          disabled={saving || !title.trim() || !body.trim()}
          className="flex-1 bg-lime text-[#081208] rounded-lg py-2 text-sm font-bold disabled:opacity-50"
        >
          Salva
        </button>
        <button onClick={onCancel} className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2 text-sm font-semibold">
          Annulla
        </button>
      </div>
    </div>
  );
}

function ChampionshipCard({
  edition,
  type,
  onOpen,
}: {
  edition: ChampionshipEdition;
  type?: ChampionshipType;
  onOpen: () => void;
}) {
  const badge = BADGE_COLORS[type?.badgeColor ?? "serie-b"];
  const { data: matchdays } = useCollection<Matchday>("matchdays", [where("editionId", "==", edition.id)], [edition.id]);
  const latestMatchday = matchdays.length > 0 ? Math.max(...matchdays.map((m) => m.number)) : null;

  return (
<<<<<<< HEAD
    <div className="relative text-left bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl pl-4 pr-4 py-3.5 w-full overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: badge.text }} aria-hidden="true" />
      <div className="flex justify-between items-start gap-3">
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
        <button onClick={onOpen} className="border border-[rgba(251,243,222,0.18)] rounded-lg py-2 text-[12px] font-semibold flex items-center justify-center gap-1">
          <CalendarDays size={13} /> Calendario
        </button>
=======
    <button
      onClick={onClick}
      className="relative text-left bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl pl-4 pr-4 py-3.5 w-full overflow-hidden"
      style={{ opacity: muted ? 0.7 : 1 }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: badge.text }} aria-hidden="true" />
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 text-[11px] font-extrabold"
            style={{ background: badge.bg, color: badge.text }}
          >
            {(type?.name ?? "?").slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="font-bold text-[15px] truncate">{type?.name}</p>
            <p className="text-[12.5px] text-[rgba(251,243,222,0.58)] mt-0.5">{edition.season}</p>
          </div>
        </div>
        <span
          className="text-[10.5px] font-bold px-2 py-1 rounded-full shrink-0"
          style={{ background: badge.bg, color: badge.text }}
        >
          {edition.status === "conclusa" ? "conclusa" : "attiva"}
        </span>
      </div>
      <div className="flex items-center mt-3 text-[#BBFF5E] text-[12.5px] font-semibold">
        Vedi dettagli <ChevronRight size={14} className="ml-0.5" />
>>>>>>> 548c33dadf9f8cee71b8ee2e0a31a2d11d373e4d
      </div>
    </div>
  );
}

function SectionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE] mb-3 ${className}`}>{children}</h2>;
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="text-[12.5px] text-[rgba(251,243,222,0.35)] py-3 flex items-center">
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
