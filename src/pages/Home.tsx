import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, deleteDoc, doc, updateDoc, where } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import { confirmDelete } from "../lib/confirmDelete";
import type { ChampionshipEdition, ChampionshipType, ContentStatus, HomeNews } from "../types";
import { BADGE_COLORS } from "../types";
import { ChevronRight, AlertCircle, Plus, X, Pencil, Trash2, Trophy, Megaphone } from "lucide-react";


export function HomePage() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";

  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  // Il pubblico non deve nemmeno interrogare edizioni bozza/nascoste o novità in bozza:
  // le regole Firestore rifiuterebbero comunque la query, quindi il filtro va fatto qui,
  // non scaricando tutto e nascondendo il resto solo visivamente.
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
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const active = editions.filter((e) => e.status === "attiva");
  const concluded = editions
    .filter((e) => e.status === "conclusa")
    .sort((a, b) => (a.season < b.season ? 1 : -1))
    .slice(0, 4);

  const typeById = (id: string) => types.find((t) => t.id === id);

  const removeNews = async (n: HomeNews) => {
    if (!confirmDelete(n.title)) return;
    try {
      await deleteDoc(doc(db, "homeNews", n.id));
      showToast("Novità eliminata.");
    } catch (err) {
      console.error(err);
      showToast("Errore nell'eliminazione.");
    }
  };

  return (
    <div className="p-4 pb-6">
      <div className="relative overflow-hidden rounded-2xl mb-8 px-5 py-6 bg-gradient-to-br from-[#1F4A15] via-[#123008] to-[#0A0B08]">
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
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#123008] bg-[#BBFF5E] rounded-full px-2.5 py-1 mb-3">
            <Trophy size={11} /> Stagione in corso
          </span>
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
            </div>
          )
        )}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#0A0B08] text-[#FBF3DE] border border-[rgba(187,255,94,0.3)] px-4 py-2.5 rounded-full text-[12.5px] max-w-[90%] text-center z-20">
          {toast}
        </div>
      )}
    </div>
  );
}

function NewsForm({ onDone }: { onDone: (msg: string) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<ContentStatus>("pubblicato");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "homeNews"), {
        title: title.trim(),
        body: body.trim(),
        date: new Date().toISOString().slice(0, 10),
        status,
      });
      onDone(status === "pubblicato" ? "Novità pubblicata." : "Bozza salvata.");
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
      />
      <textarea
        placeholder="Testo della comunicazione"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2 min-h-[70px]"
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
  const [status, setStatus] = useState<ContentStatus>(news.status);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "homeNews", news.id), {
        title: title.trim(),
        body: body.trim(),
        status,
      });
      onDone("Novità aggiornata.");
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
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2 min-h-[70px]"
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
  onClick,
  muted,
}: {
  edition: ChampionshipEdition;
  type?: ChampionshipType;
  onClick: () => void;
  muted?: boolean;
}) {
  const badge = BADGE_COLORS[type?.badgeColor ?? "serie-b"];
  return (
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
      </div>
    </button>
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
