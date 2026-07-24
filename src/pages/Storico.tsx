import { where } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import type { ChampionshipEdition, ChampionshipType } from "../types";
import { BADGE_COLORS } from "../types";
import { History } from "lucide-react";

export function StoricoPage() {
  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const { data: concluded } = useCollection<ChampionshipEdition>("championshipEditions", [
    where("status", "==", "conclusa"),
  ]);

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center gap-2 mb-1">
        <History size={15} className="text-[#BBFF5E]" />
        <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE]">Storico campionati</h2>
      </div>
      <p className="text-[13px] text-[rgba(251,243,222,0.58)] mb-5">
        Il dettaglio con vincitore e tabellone arriva in Fase 4.
      </p>
      <div className="flex flex-col gap-3">
        {concluded.length === 0 && (
          <p className="text-[12.5px] text-[rgba(251,243,222,0.35)]">Nessuna edizione conclusa ancora.</p>
        )}
        {concluded.map((e) => {
          const t = types.find((x) => x.id === e.typeId);
          const badge = BADGE_COLORS[t?.badgeColor ?? "serie-b"];
          return (
            <div
              key={e.id}
              className="relative overflow-hidden flex items-center gap-3 bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl pl-4 pr-4 py-3.5"
            >
              <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: badge.text }} aria-hidden="true" />
              <span
                className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 text-[11px] font-extrabold"
                style={{ background: badge.bg, color: badge.text }}
              >
                {(t?.name ?? "?").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{t?.name}</p>
                <p className="text-[12.5px] text-[rgba(251,243,222,0.58)] mt-0.5">{e.season}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
