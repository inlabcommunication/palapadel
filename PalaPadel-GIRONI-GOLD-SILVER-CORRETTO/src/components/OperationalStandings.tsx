import { useMemo, useState } from "react";
import { Plus, Pencil, X } from "lucide-react";
import type { EditionTeam, Match, ParticipationStatus, Team } from "../types";
import { addEntriesToStandings, setTeamStatus, updateStandingsEntry } from "../lib/standingsAdminApi";
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
  const [adjustment, setAdjustment] = useState(entry.manualPointsAdjustment ?? 0);
  const [status, setStatus] = useState<ParticipationStatus>(entry.status);
  const [operationalNotes, setOperationalNotes] = useState(entry.operationalNotes ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (reason.trim().length < 5) return;
    setBusy(true);
    try {
      if (
        adjustment !== (entry.manualPointsAdjustment ?? 0) ||
        operationalNotes.trim() !== (entry.operationalNotes ?? "")
      ) {
        await updateStandingsEntry({
          editionId,
          editionTeamId: entry.id,
          baselinePoints: entry.baselinePoints ?? 0,
          baselinePlayed: entry.baselinePlayed ?? 0,
          manualPointsAdjustment: adjustment,
          manualPlayedAdjustment: entry.manualPlayedAdjustment ?? 0,
          order: entry.order,
          operationalNotes: operationalNotes.trim() || undefined,
          reason: reason.trim(),
        });
      }
      if (status !== entry.status) {
        await setTeamStatus({
          editionId,
          editionTeamId: entry.id,
          newStatus: status,
          ...(status === "normale" ? {} : { policy: 2 }),
          reason: reason.trim(),
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
        <label className="mt-4 block text-xs font-bold">Correzione punti
          <input type="number" value={adjustment} onChange={(event) => setAdjustment(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2" />
        </label>
        <label className="mt-3 block text-xs font-bold">Stato
          <select value={status} onChange={(event) => setStatus(event.target.value as ParticipationStatus)}
            className="mt-1 w-full rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2">
            <option value="normale">Regolare</option><option value="ritirata">Ritirata</option><option value="squalificata">Squalificata</option>
          </select>
        </label>
        <label className="mt-3 block text-xs font-bold">Note operative
          <textarea value={operationalNotes} onChange={(event) => setOperationalNotes(event.target.value)} rows={2} maxLength={1000}
            className="mt-1 w-full rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2" />
        </label>
        <label className="mt-3 block text-xs font-bold">Motivazione obbligatoria
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3}
            className="mt-1 w-full rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2" />
        </label>
        <button onClick={save} disabled={busy || reason.trim().length < 5}
          className="mt-4 w-full rounded-lg bg-[#BBFF5E] py-2 text-sm font-bold text-[#081208] disabled:opacity-40">
          {busy ? "Salvataggio..." : "Salva modifica"}
        </button>
      </div>
    </div>
  );
}
