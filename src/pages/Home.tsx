import { useNavigate } from "react-router-dom";
import { where } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import type { ChampionshipEdition, ChampionshipType, HomeNews } from "../types";
import { BADGE_COLORS } from "../types";
import { ChevronRight, AlertCircle } from "lucide-react";

export function HomePage() {
  const navigate = useNavigate();
  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const { data: editions, loading } = useCollection<ChampionshipEdition>("championshipEditions");
  const { data: news } = useCollection<HomeNews>("homeNews", [where("status", "==", "pubblicato")]);

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

      <SectionTitle className="mt-7">Novità PalaPadel</SectionTitle>
      <div className="flex flex-col gap-2.5">
        {news.length === 0 && <EmptyHint text="Nessuna comunicazione pubblicata." />}
        {news.map((n) => (
          <div key={n.id} className="bg-white border border-[#EAE7DD] rounded-xl px-3.5 py-3">
            <p className="font-bold text-sm">{n.title}</p>
            <p className="text-[13px] text-[#5F5E5A] mt-1">{n.body}</p>
            <p className="text-[11px] text-[#9A9A94] mt-2">{formatDate(n.date)}</p>
          </div>
        ))}
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
