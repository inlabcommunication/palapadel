import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Pencil, X } from "lucide-react";
import type { EditionTeam, Match, ParticipationStatus, Team } from "../types";
import { addEntriesToStandings, reorderTiedStandings, setTeamStatus, updateStandingsEntry } from "../lib/standingsAdminApi";
import { StandingsShareButton } from "./StandingsShareButton";

interface Props {
  editionId: string;
  typeId: string;
  categoryName: string;
  championshipLogoUrl?: string;
  season: string;
  entries: EditionTeam[];
  teams: Team[];
  matches: Match[];
  canEdit: boolean;
  canEnroll: boolean;
  canShare: boolean;
  showToast: (message: string) => void;
}

export function OperationalStandings({
  editionId,
  typeId,
  categoryName,
  championshipLogoUrl,
  season,
  entries,
  teams,
  matches,
  canEdit,
  canEnroll,
  canShare,
  showToast,
}: Props) {
  const [editing, setEditing] = useState<EditionTeam | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [teamSearch, setTeamSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [reorderingTie, setReorderingTie] = useState(false);

  const teamName = (teamId: string) => teams.find((team) => team.id === teamId)?.name ?? "Squadra eliminata";
  const rows = useMemo(
    () => [...entries].sort((a, b) => b.points - a.points || a.order - b.order),
    [entries]
  );
  const availableTeams = teams
    .filter((team) => !entries.some((entry) => entry.teamId === team.id))
    .filter((team) => !team.compatibleTypeIds || team.compatibleTypeIds.includes(typeId))
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
  const filteredAvailableTeams = availableTeams.filter((team) =>
    team.name.toLocaleLowerCase("it").includes(teamSearch.trim().toLocaleLowerCase("it"))
  );

  const stats = (teamId: string) => {
    let won = 0;
    let lost = 0;
    for (const match of matches) {
      if (match.status !== "conclusa" || !match.result) continue;
      if (match.team1Id !== teamId && match.team2Id !== teamId) continue;
      const homeWon = match.result.startsWith("2-");
      const teamWon = match.team1Id === teamId ? homeWon : !homeWon;
      if (teamWon) won += 1;
      else lost += 1;
    }
    return { won, lost };
  };

  const enroll = async () => {
    if (selectedTeamIds.size === 0) return;
    setBusy(true);
    try {
      const response = await addEntriesToStandings({ editionId, teamIds: [...selectedTeamIds] });
      setSelectedTeamIds(new Set());
      showToast(`${response.added} ${response.added === 1 ? "squadra iscritta" : "squadre iscritte"} al campionato.`);
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : "Iscrizione non riuscita.");
    } finally {
      setBusy(false);
    }
  };

  const moveTiedTeam = async (entryId: string, direction: -1 | 1) => {
    const entry = rows.find((row) => row.id === entryId);
    if (!entry) return;
    const tied = rows.filter((row) => row.points === entry.points);
    const index = tied.findIndex((row) => row.id === entryId);
    const target = index + direction;
    if (target < 0 || target >= tied.length) return;
    const ordered = [...tied];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setReorderingTie(true);
    try {
      await reorderTiedStandings(editionId, ordered.map((row) => row.id));
      showToast("Ordine delle squadre a pari punti aggiornato.");
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : "Riordino non riuscito.");
    } finally {
      setReorderingTie(false);
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-[rgba(251,243,222,0.58)]">{rows.length} squadre iscritte</p>
        {canShare && (
          <StandingsShareButton
            input={{
              categoryName,
              championshipLogoUrl,
              season,
              kind: "team",
              rows: rows.map((entry, index) => ({
                position: index + 1,
                name: teamName(entry.teamId),
                points: entry.points,
                played: entry.played,
                status: entry.status,
              })),
            }}
            showToast={showToast}
          />
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-[rgba(251,243,222,0.14)] bg-[#0A0B08] p-4">
          <h3 className="font-bold">Nessuna squadra iscritta</h3>
          <p className="mt-1 text-sm text-[rgba(251,243,222,0.58)]">
            Iscrivi una squadra esistente per iniziare la classifica.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[rgba(251,243,222,0.12)]">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="bg-[#0A0B08] text-[rgba(251,243,222,0.58)]">
              <tr>
                <th className="p-2">#</th><th className="p-2">Squadra</th><th className="p-2">PT</th>
                <th className="p-2">PG</th><th className="p-2">V</th><th className="p-2">P</th>
                <th className="p-2">Stato</th>{canEdit && <th className="p-2">Azioni</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((entry, index) => {
                const calculated = stats(entry.teamId);
                return (
                  <tr key={entry.id} className="border-t border-[rgba(251,243,222,0.08)]">
                    <td className="p-2 font-bold">{index + 1}</td>
                    <td className="p-2 font-semibold">{teamName(entry.teamId)}</td>
                    <td className="p-2 font-bold text-[#BBFF5E]">{entry.points}</td>
                    <td className="p-2">{entry.played}</td><td className="p-2">{calculated.won}</td>
                    <td className="p-2">{calculated.lost}</td><td className="p-2">{entry.status}</td>
                    {canEdit && (
                      <td className="p-2">
                        <button
                          aria-label={`Sposta ${teamName(entry.teamId)} in alto tra le squadre a pari punti`}
                          disabled={reorderingTie || index === 0 || rows[index - 1]?.points !== entry.points}
                          onClick={() => moveTiedTeam(entry.id, -1)}
                          className="rounded-md p-1.5 text-[#BBFF5E] disabled:opacity-20"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          aria-label={`Sposta ${teamName(entry.teamId)} in basso tra le squadre a pari punti`}
                          disabled={reorderingTie || index === rows.length - 1 || rows[index + 1]?.points !== entry.points}
                          onClick={() => moveTiedTeam(entry.id, 1)}
                          className="rounded-md p-1.5 text-[#BBFF5E] disabled:opacity-20"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button aria-label={`Modifica ${teamName(entry.teamId)}`} onClick={() => setEditing(entry)}
                          className="rounded-md p-2 text-[#BBFF5E] hover:bg-[rgba(187,255,94,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#BBFF5E]">
                          <Pencil size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canEnroll && (
        <div className="mt-4">
          {!enrolling ? (
            <button onClick={() => setEnrolling(true)} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#BBFF5E]">
              <Plus size={15} /> Aggiungi squadra
            </button>
          ) : (
            <div className="w-full rounded-lg border border-[rgba(251,243,222,0.14)] bg-[#0A0B08] p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="block text-sm font-bold" htmlFor="enroll-team-search">Scegli le squadre da iscrivere</label>
                <button aria-label="Chiudi iscrizione" onClick={() => setEnrolling(false)} className="rounded-lg p-2"><X size={16} /></button>
              </div>
              <input
                id="enroll-team-search"
                type="search"
                value={teamSearch}
                onChange={(event) => setTeamSearch(event.target.value)}
                placeholder="Cerca squadra per nome"
                className="mb-3 w-full rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2.5 text-sm"
              />
              <div className="mb-3 max-h-72 overflow-y-auto rounded-lg border border-[rgba(251,243,222,0.12)]">
                {filteredAvailableTeams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => setSelectedTeamIds((current) => {
                      const next = new Set(current);
                      if (next.has(team.id)) next.delete(team.id);
                      else next.add(team.id);
                      return next;
                    })}
                    className={`flex w-full items-center gap-3 border-b border-[rgba(251,243,222,0.08)] px-3 py-3 text-left text-sm last:border-b-0 ${
                      selectedTeamIds.has(team.id) ? "bg-[rgba(187,255,94,0.14)] text-[#BBFF5E]" : "hover:bg-[rgba(251,243,222,0.05)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTeamIds.has(team.id)}
                      onChange={() => undefined}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="pointer-events-none h-4 w-4 accent-[#BBFF5E]"
                    />
                    <span>{team.name}</span>
                  </button>
                ))}
                {availableTeams.length > 0 && filteredAvailableTeams.length === 0 && (
                  <p className="p-4 text-sm text-[rgba(251,243,222,0.58)]">Nessuna squadra corrisponde alla ricerca.</p>
                )}
              </div>
              <p className="mb-3 text-xs font-bold text-[#BBFF5E]">
                {selectedTeamIds.size} {selectedTeamIds.size === 1 ? "squadra selezionata" : "squadre selezionate"}
              </p>
              <div className="flex gap-2">
                <button onClick={enroll} disabled={busy || selectedTeamIds.size === 0}
                  className="min-h-11 flex-1 rounded-lg bg-[#BBFF5E] px-4 text-sm font-bold text-[#081208] disabled:opacity-40">
                  {busy ? "Iscrizione..." : `Iscrivi ${selectedTeamIds.size || ""} ${selectedTeamIds.size === 1 ? "squadra" : "squadre"}`.trim()}
                </button>
              </div>
              {availableTeams.length === 0 && <p className="mt-2 text-xs text-[rgba(251,243,222,0.58)]">Non ci sono altre squadre disponibili.</p>}
            </div>
          )}
        </div>
      )}

      {editing && (
        <StandingEditDialog
          entry={editing}
          teamName={teamName(editing.teamId)}
          editionId={editionId}
          onClose={() => setEditing(null)}
          onDone={(message) => { setEditing(null); showToast(message); }}
        />
      )}
    </section>
  );
}

function StandingEditDialog({
  entry,
  teamName,
  editionId,
  onClose,
  onDone,
}: {
  entry: EditionTeam;
  teamName: string;
  editionId: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [points, setPoints] = useState(entry.points);
  const [played, setPlayed] = useState(entry.played);
  const [status, setStatus] = useState<ParticipationStatus>(entry.status);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const auditReason = "Modifica manuale di punti e giornate";
    setBusy(true);
    try {
      await updateStandingsEntry({
        editionId,
        editionTeamId: entry.id,
        baselinePoints: Math.max(0, points - (entry.matchPoints ?? 0)),
        baselinePlayed: Math.max(0, played - (entry.matchPlayed ?? 0)),
        manualPointsAdjustment: Math.min(0, points - (entry.matchPoints ?? 0)),
        manualPlayedAdjustment: Math.min(0, played - (entry.matchPlayed ?? 0)),
        order: entry.order,
        reason: auditReason,
      });
      if (status !== entry.status) {
        await setTeamStatus({
          editionId,
          editionTeamId: entry.id,
          newStatus: status,
          ...(status === "normale" ? {} : { policy: 2 }),
          reason: auditReason,
        });
      }
      onDone("Classifica aggiornata e modifica registrata nell’audit.");
    } catch (error) {
      console.error(error);
      onDone(error instanceof Error ? error.message : "Modifica non riuscita.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="standing-edit-title" className="w-full max-w-md rounded-lg border border-[rgba(251,243,222,0.18)] bg-[#123008] p-4">
        <div className="flex items-center justify-between">
          <h3 id="standing-edit-title" className="font-bold">Modifica {teamName}</h3>
          <button aria-label="Chiudi" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block text-xs font-bold">Punti
          <input type="number" min={0} value={points} onChange={(event) => setPoints(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2" />
        </label>
        <label className="block text-xs font-bold">Giornate
          <input type="number" min={0} value={played} onChange={(event) => setPlayed(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2" />
        </label>
        </div>
        <label className="mt-3 block text-xs font-bold">Stato
          <select value={status} onChange={(event) => setStatus(event.target.value as ParticipationStatus)}
            className="mt-1 w-full rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2">
            <option value="normale">Regolare</option><option value="ritirata">Ritirata</option><option value="squalificata">Squalificata</option>
          </select>
        </label>
        <button onClick={save} disabled={busy}
          className="mt-4 w-full rounded-lg bg-[#BBFF5E] py-2 text-sm font-bold text-[#081208] disabled:opacity-40">
          {busy ? "Salvataggio..." : "Salva modifica"}
        </button>
      </div>
    </div>
  );
}
