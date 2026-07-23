import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import type { ChampionshipEdition, ChampionshipType, HomeNews } from "../types";
import { BADGE_COLORS } from "../types";
import { ChevronRight, AlertCircle, Plus, X } from "lucide-react";

export function HomePage() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";

  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const { data: editions, loading } = useCollection<ChampionshipEdition>("championshipEditions");
  const { data: allNews } = useCollection<HomeNews>("homeNews");
  const news = isAdmin ? allNews : allNews.filter((n) => n.status === "pubblicato");

  const [showNewsForm, setShowNewsForm] = useState(false);
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

  return (
    <div className="p-4 pb-6">
      <SectionTitle>Campionati attivi</SectionTitle>
      <div className="flex flex-col gap-2.5">
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
          <SectionTitle className="mt-7">Campionati conclusi di recente</SectionTitle>
          <div className="flex flex-col gap-2.5">
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

      <div className="flex items-center justify-between mt-7 mb-3">
        <h2 className="text-sm font-bold">Novità PalaPadel</h2>
        {isAdmin && (
          <button onClick={() => setShowNewsForm((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-court">
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

      <div className="flex flex-col gap-2.5">
        {news.length === 0 && <EmptyHint text="Nessuna comunicazione pubblicata." />}
        {news.map((n) => (
          <div key={n.id} className="bg-white border border-[#EAE7DD] rounded-xl px-3.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-sm">{n.title}</p>
              {isAdmin && n.status === "bozza" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F1EFE8] text-[#7A7A75] shrink-0">
                  bozza
                </span>
              )}
            </div>
            <p className="text-[13px] text-[#5F5E5A] mt-1">{n.body}</p>
            <p className="text-[11px] text-[#9A9A94] mt-2">{formatDate(n.date)}</p>
          </div>
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1A1A18] text-white px-4 py-2.5 rounded-full text-[12.5px] max-w-[90%] text-center z-20">
          {toast}
        </div>
      )}
    </div>
  );
}

function NewsForm({ onDone }: { onDone: (msg: string) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"pubblicato" | "bozza">("pubblicato");
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
    <div className="bg-white border border-[#EAE7DD] rounded-xl p-3.5 mb-3">
      <input
        placeholder="Titolo"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <textarea
        placeholder="Testo della comunicazione"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2.5 text-sm mb-2 min-h-[70px]"
      />
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => setStatus("pubblicato")}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold ${status === "pubblicato" ? "bg-court text-white" : "bg-[#F1EFE8] text-[#3A3A36]"}`}
        >
          Pubblica subito
        </button>
        <button
          onClick={() => setStatus("bozza")}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold ${status === "bozza" ? "bg-court text-white" : "bg-[#F1EFE8] text-[#3A3A36]"}`}
        >
          Salva come bozza
        </button>
      </div>
      <button
        onClick={submit}
        disabled={saving || !title.trim() || !body.trim()}
        className="w-full bg-court text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
      >
        {saving ? "In corso..." : "Salva"}
      </button>
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
      className="text-left bg-white border border-[#EAE7DD] rounded-2xl px-4 py-3.5 w-full"
      style={{ opacity: muted ? 0.7 : 1 }}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-[15px]">{type?.name}</p>
          <p className="text-[12.5px] text-[#7A7A75] mt-0.5">{edition.season}</p>
        </div>
        <span
          className="text-[10.5px] font-bold px-2 py-1 rounded-full"
          style={{ background: badge.bg, color: badge.text }}
        >
          {edition.status === "conclusa" ? "conclusa" : "attiva"}
        </span>
      </div>
      <div className="flex items-center mt-3 text-court text-[12.5px] font-semibold">
        Vedi dettagli <ChevronRight size={14} className="ml-0.5" />
      </div>
    </button>
  );
}

function SectionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-sm font-bold mb-3 ${className}`}>{children}</h2>;
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="text-[12.5px] text-[#9A9A94] py-3 flex items-center">
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
