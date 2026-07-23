import { useParams, useNavigate } from "react-router-dom";
import { where } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import type { ChampionshipEdition, ChampionshipType, EditionTeam, FemaleParticipant, Team } from "../types";

export function CampionatiPage() {
  const { editionId } = useParams();
  const navigate = useNavigate();
  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const { data: editions } = useCollection<ChampionshipEdition>("championshipEditions");

  const selected = editionId ?? editions[0]?.id;
  const edition = editions.find((e) => e.id === selected);
  const type = edition && types.find((t) => t.id === edition.typeId);

  return (
    <div className="p-4">
      <h2 className="text-sm font-bold mb-3">Campionati</h2>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {editions.map((e) => {
          const t = types.find((x) => x.id === e.typeId);
          const isSel = e.id === selected;
          return (
            <button
              key={e.id}
              onClick={() => navigate(`/campionati/${e.id}`)}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-semibold shrink-0 ${
                isSel ? "bg-court text-white" : "bg-[#F1EFE8] text-[#3A3A36]"
              }`}
            >
              {t?.name} {e.season}
            </button>
          );
        })}
      </div>

      {edition && type?.hasTeams && <TeamStandings editionId={edition.id} />}
      {edition && !type?.hasTeams && <FemaleStandings editionId={edition.id} />}
    </div>
  );
}

function TeamStandings({ editionId }: { editionId: string }) {
  const { data: editionTeams } = useCollection<EditionTeam>("editionTeams", [where("editionId", "==", editionId)]);
  const { data: teams } = useCollection<Team>("teams");

  const rows = editionTeams
    .map((et) => ({ ...et, team: teams.find((t) => t.id === et.teamId) }))
    .sort((a, b) => {
      const aOut = a.status !== "normale";
      const bOut = b.status !== "normale";
      if (aOut !== bOut) return aOut ? 1 : -1;
      if (b.points !== a.points) return b.points - a.points;
      return a.order - b.order;
    });

  return (
    <div className="bg-white border border-[#EAE7DD] rounded-xl overflow-hidden">
      <Row header cells={["#", "Squadra", "PG", "Pt"]} />
      {rows.map((r, i) => (
        <Row
          key={r.id}
          cells={[
            String(i + 1),
            r.team?.name ?? "—",
            String(r.played),
            r.status === "normale" ? String(r.points) : r.status === "ritirata" ? "Ritirata" : "Squalificata",
          ]}
        />
      ))}
    </div>
  );
}

function FemaleStandings({ editionId }: { editionId: string }) {
  const { data: participants } = useCollection<FemaleParticipant>("femaleParticipants", [
    where("editionId", "==", editionId),
  ]);

  const rows = [...participants].sort((a, b) => {
    const aOut = a.status !== "normale";
    const bOut = b.status !== "normale";
    if (aOut !== bOut) return aOut ? 1 : -1;
    return b.points - a.points;
  });

  return (
    <div className="bg-white border border-[#EAE7DD] rounded-xl overflow-hidden">
      <Row header cells={["#", "Giocatrice", "Tappe", "Pt"]} />
      {rows.map((r, i) => (
        <Row
          key={r.id}
          cells={[
            String(i + 1),
            r.name,
            String(r.stages),
            r.status === "normale" ? String(r.points) : r.status === "ritirata" ? "Rit." : "Sq.",
          ]}
        />
      ))}
    </div>
  );
}

function Row({ cells, header }: { cells: string[]; header?: boolean }) {
  return (
    <div
      className={`flex items-center px-3.5 py-2.5 text-[13px] border-b border-[#F1EFE8] last:border-b-0 ${
        header ? "font-bold text-xs text-[#7A7A75]" : ""
      }`}
    >
      <span className="w-6 text-[#9A9A94]">{cells[0]}</span>
      <span className="flex-1 font-semibold">{cells[1]}</span>
      <span className="w-10 text-center">{cells[2]}</span>
      <span className="w-14 text-center font-bold">{cells[3]}</span>
    </div>
  );
}
