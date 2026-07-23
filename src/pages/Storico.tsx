import { where } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import type { ChampionshipEdition, ChampionshipType } from "../types";

export function StoricoPage() {
  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const { data: concluded } = useCollection<ChampionshipEdition>("championshipEditions", [
    where("status", "==", "conclusa"),
  ]);

  return (
    <div className="p-4">
      <h2 className="text-sm font-bold mb-1">Storico campionati</h2>
      <p className="text-[13px] text-[#7A7A75] mb-4">
        Il dettaglio con vincitore e tabellone arriva in Fase 4.
      </p>
      <div className="flex flex-col gap-2">
        {concluded.length === 0 && (
          <p className="text-[12.5px] text-[#9A9A94]">Nessuna edizione conclusa ancora.</p>
        )}
        {concluded.map((e) => {
          const t = types.find((x) => x.id === e.typeId);
          return (
            <div key={e.id} className="bg-white border border-[#EAE7DD] rounded-xl px-3.5 py-3">
              <p className="font-bold text-sm">
                {t?.name} {e.season}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
