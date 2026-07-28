import { useMemo, useState } from "react";
import { where } from "firebase/firestore";
import { ChevronLeft, Pencil, Plus, ShieldCheck, Trash2, Trophy, Users, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useCollection } from "../hooks/useCollection";
import type {
  Tournament,
  TournamentBracketKey,
  TournamentBracketMatch,
  TournamentBracketRound,
  TournamentGroup,
  TournamentGroupTeam,
  TournamentTeam,
} from "../types";
import {
  addTournamentGroupTeam,
  createTournament,
  createTournamentGroup,
  createTournamentMatch,
  createTournamentRound,
  deleteTournament,
  deleteTournamentGroup,
  deleteTournamentMatch,
  deleteTournamentRound,
  removeTournamentGroupTeam,
  removeTournamentLogo,
  setTournamentLogo,
  tournamentBracketModeOptions,
  tournamentStatusOptions,
  updateTournament,
  updateTournamentGroupTeam,
  updateTournamentMatch,
  type TournamentMatchFields,
} from "../lib/tournamentApi";
import { confirmDelete } from "../lib/confirmDelete";
import { compareTournamentGroupEntries, filterTournamentTeamsInGroups, getTournamentBracketKeys } from "../../shared/tournamentModel.js";
import { ImageUploadField } from "../components/ImageUploadField";
import { deleteTournamentLogo, uploadTournamentLogo } from "../lib/tournamentLogoUpload";

export function TorneiPage() {
  const { appUser } = useAuth();
  const isSuperAdmin = appUser?.role === "superAdmin";
  const isOperator = isSuperAdmin || appUser?.role === "admin";
  const publicConstraints = isOperator
    ? []
    : [where("isPubliclyVisible", "==", true), where("status", "in", ["in_corso", "concluso"])];
  const tournamentsQuery = useCollection<Tournament>("tournaments", publicConstraints, [isOperator]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState("");
  const tournaments = [...tournamentsQuery.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const selected = tournaments.find((item) => item.id === selectedId);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  if (selected) {
    return <TournamentDetail tournament={selected} isSuperAdmin={isSuperAdmin} isOperator={isOperator} onBack={() => setSelectedId(null)} notify={notify} />;
  }

  return (
    <div className="p-4 xl:p-0">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase text-[#BBFF5E]">Competizioni</p>
          <h2 className="font-display text-3xl text-[#FBF3DE]">Tornei</h2>
          <p className="mt-1 text-sm text-[rgba(251,243,222,0.62)]">Gironi e fase finale a eliminazione diretta.</p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#BBFF5E] px-4 py-2.5 text-sm font-bold text-[#081208]">
            <Plus size={17} /> Nuovo torneo
          </button>
        )}
      </div>

      {showCreate && <TournamentForm onCancel={() => setShowCreate(false)} onDone={(id) => { setShowCreate(false); if (id) setSelectedId(id); notify("Torneo creato."); }} />}
      {tournamentsQuery.loading && <Empty text="Caricamento tornei..." />}
      {!tournamentsQuery.loading && tournaments.length === 0 && <Empty text="Nessun torneo disponibile." />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tournaments.map((tournament) => (
          <button key={tournament.id} onClick={() => setSelectedId(tournament.id)} className="border-l-4 border-[#BBFF5E] bg-[#0A0B08] p-4 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {tournament.logoUrl && (
                  <img src={tournament.logoUrl} alt={tournament.logoAlt ?? `Logo ${tournament.name}`} className="h-12 w-12 shrink-0 rounded-lg border border-[rgba(251,243,222,0.12)] bg-[#FBF3DE] object-contain p-1" />
                )}
                <div className="min-w-0">
                <p className="font-display text-2xl text-[#FBF3DE]">{tournament.name}</p>
                <p className="text-sm text-[rgba(251,243,222,0.62)]">{tournament.season}</p>
                </div>
              </div>
              <StatusBadge value={tournament.status} />
            </div>
            <div className="mt-5 flex items-center justify-between text-xs font-bold text-[#BBFF5E]">
              <span>{tournament.bracketMode === "gold_silver" ? "Gold + Silver" : "Tabellone unico"}</span>
              <span>Apri</span>
            </div>
          </button>
        ))}
      </div>
      {toast && <Toast text={toast} />}
    </div>
  );
}

function TournamentDetail({ tournament, isSuperAdmin, isOperator, onBack, notify }: {
  tournament: Tournament;
  isSuperAdmin: boolean;
  isOperator: boolean;
  onBack: () => void;
  notify: (message: string) => void;
}) {
  const [tab, setTab] = useState<"groups" | "brackets">("groups");
  const [editing, setEditing] = useState(false);
  const groups = useCollection<TournamentGroup>("tournamentGroups", [where("tournamentId", "==", tournament.id)], [tournament.id]);
  const entries = useCollection<TournamentGroupTeam>("tournamentGroupTeams", [where("tournamentId", "==", tournament.id)], [tournament.id]);
  const rounds = useCollection<TournamentBracketRound>("tournamentBracketRounds", [where("tournamentId", "==", tournament.id)], [tournament.id]);
  const matches = useCollection<TournamentBracketMatch>("tournamentBracketMatches", [where("tournamentId", "==", tournament.id)], [tournament.id]);
  const teams = useCollection<TournamentTeam>("tournamentTeams", [where("tournamentId", "==", tournament.id)], [tournament.id]);

  const removeTournament = async () => {
    if (!confirmDelete(tournament.name)) return;
    try {
      await deleteTournament(tournament.id);
      onBack();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Eliminazione non riuscita.");
    }
  };

  return (
    <div className="p-4 xl:p-0">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-[#BBFF5E]"><ChevronLeft size={17} /> Tutti i tornei</button>
      <div className="mb-5 border-b border-[rgba(251,243,222,0.12)] pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2"><StatusBadge value={tournament.status} /> {!tournament.isPubliclyVisible && <span className="text-xs text-[#FF9B6B]">Nascosto</span>}</div>
            <h2 className="font-display text-4xl text-[#FBF3DE]">{tournament.name}</h2>
            <p className="text-sm text-[rgba(251,243,222,0.62)]">{tournament.season} · {tournament.bracketMode === "gold_silver" ? "Gold + Silver" : "Tabellone unico"}</p>
          </div>
          {isSuperAdmin && (
            <div className="flex gap-2">
              <button onClick={() => setEditing(true)} title="Modifica torneo" className="rounded-lg border border-[rgba(251,243,222,0.16)] p-2.5 text-[#BBFF5E]"><Pencil size={17} /></button>
              <button onClick={removeTournament} title="Elimina torneo" className="rounded-lg border border-[rgba(251,243,222,0.16)] p-2.5 text-[#FF6B6B]"><Trash2 size={17} /></button>
            </div>
          )}
        </div>
        {tournament.logoUrl && (
          <div className="mt-5 flex justify-center">
            <img src={tournament.logoUrl} alt={tournament.logoAlt ?? `Logo ${tournament.name}`} className="h-40 w-40 rounded-2xl border border-[rgba(251,243,222,0.14)] bg-[#FBF3DE] object-contain p-3 shadow-lg sm:h-48 sm:w-48" />
          </div>
        )}
      </div>
      {editing && <TournamentForm tournament={tournament} onCancel={() => setEditing(false)} onDone={() => { setEditing(false); notify("Torneo aggiornato."); }} />}
      <div className="mb-5 grid grid-cols-2 bg-[#0A0B08] p-1">
        <button onClick={() => setTab("groups")} className={`px-3 py-3 text-sm font-bold ${tab === "groups" ? "bg-[#BBFF5E] text-[#081208]" : "text-[rgba(251,243,222,0.62)]"}`}><Users className="mr-2 inline" size={16} />Gironi</button>
        <button onClick={() => setTab("brackets")} className={`px-3 py-3 text-sm font-bold ${tab === "brackets" ? "bg-[#BBFF5E] text-[#081208]" : "text-[rgba(251,243,222,0.62)]"}`}><Trophy className="mr-2 inline" size={16} />Tabelloni</button>
      </div>
      {tab === "groups" ? (
        <GroupsPanel tournament={tournament} groups={groups.data} entries={entries.data} teams={teams.data} isOperator={isOperator} notify={notify} />
      ) : (
        <BracketsPanel
          tournament={tournament}
          rounds={rounds.data}
          matches={matches.data}
          teams={filterTournamentTeamsInGroups(teams.data, entries.data)}
          isOperator={isOperator}
          notify={notify}
        />
      )}
    </div>
  );
}

function GroupsPanel({ tournament, groups, entries, teams, isOperator, notify }: {
  tournament: Tournament; groups: TournamentGroup[]; entries: TournamentGroupTeam[]; teams: TournamentTeam[];
  isOperator: boolean; notify: (message: string) => void;
}) {
  const [newGroup, setNewGroup] = useState("");
  const sortedGroups = [...groups].sort((a, b) => a.order - b.order);
  const teamName = (entry: TournamentGroupTeam) =>
    teams.find((team) => team.id === entry.teamId)?.displayName ??
    entry.displayName ??
    (entry.member1 && entry.member2 ? `${entry.member1} / ${entry.member2}` : "Coppia non disponibile");
  const addGroup = async () => {
    if (!newGroup.trim()) return;
    try {
      await createTournamentGroup(tournament.id, newGroup.trim(), sortedGroups.length);
      setNewGroup("");
      notify("Girone creato.");
    } catch (error) { notify(error instanceof Error ? error.message : "Errore."); }
  };
  return (
    <div className="space-y-5">
      {isOperator && (
        <div className="flex gap-2">
          <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="Nome girone, es. Girone A" className="min-w-0 flex-1 rounded-lg border border-[rgba(251,243,222,0.16)] px-3 py-2.5" />
          <button onClick={addGroup} className="rounded-lg bg-[#BBFF5E] px-4 text-sm font-bold text-[#081208]">Crea</button>
        </div>
      )}
      {sortedGroups.length === 0 && <Empty text="Nessun girone creato." />}
      {sortedGroups.map((group) => (
        <GroupCard key={group.id} tournament={tournament} group={group} entries={entries.filter((entry) => entry.groupId === group.id)} teamName={teamName} isOperator={isOperator} notify={notify} />
      ))}
    </div>
  );
}

function GroupCard({ tournament, group, entries, teamName, isOperator, notify }: {
  tournament: Tournament; group: TournamentGroup; entries: TournamentGroupTeam[];
  teamName: (entry: TournamentGroupTeam) => string; isOperator: boolean; notify: (message: string) => void;
}) {
  const [member1, setMember1] = useState("");
  const [member2, setMember2] = useState("");
  const sorted = [...entries].sort(compareTournamentGroupEntries);
  const addTeam = async () => {
    if (!member1.trim() || !member2.trim()) return;
    try {
      await addTournamentGroupTeam(tournament.id, group.id, member1.trim(), member2.trim(), entries.length);
      setMember1("");
      setMember2("");
      notify("Coppia aggiunta.");
    } catch (error) { notify(error instanceof Error ? error.message : "Errore."); }
  };
  return (
    <section className="border border-[rgba(251,243,222,0.12)] bg-[#0A0B08]">
      <header className="flex items-center justify-between border-b border-[rgba(251,243,222,0.10)] px-4 py-3">
        <h3 className="font-display text-2xl">{group.name}</h3>
        {isOperator && <button title="Elimina girone" onClick={async () => { if (confirmDelete(group.name)) await deleteTournamentGroup(tournament.id, group.id); }} className="text-[#FF6B6B]"><Trash2 size={16} /></button>}
      </header>
      <div className={isOperator ? "overflow-x-auto" : ""}>
        <table className={`w-full text-sm ${isOperator ? "min-w-[620px]" : "table-fixed"}`}>
          <thead className="text-[10px] uppercase text-[rgba(251,243,222,0.48)]">
            <tr>
              <th className="px-3 py-2 text-left">Coppia</th>
              <th className="w-14">PG</th>
              {isOperator && <><th>V</th><th>S</th></>}
              <th className="w-14">PT</th>
              {isOperator && <th>Passata</th>}
              {isOperator && <th />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => <GroupTeamRow key={entry.id} tournamentId={tournament.id} entry={entry} name={teamName(entry)} canEdit={isOperator} showOperational={isOperator} canRemove={isOperator} notify={notify} />)}
          </tbody>
        </table>
      </div>
      {isOperator && (
        <div className="grid gap-2 border-t border-[rgba(251,243,222,0.10)] p-3 sm:grid-cols-[1fr_1fr_auto]">
          <input value={member1} onChange={(e) => setMember1(e.target.value)} placeholder="Membro 1" className="min-w-0 rounded-lg border border-[rgba(251,243,222,0.16)] px-3 py-2" />
          <input value={member2} onChange={(e) => setMember2(e.target.value)} placeholder="Membro 2" className="min-w-0 rounded-lg border border-[rgba(251,243,222,0.16)] px-3 py-2" />
          <button onClick={addTeam} disabled={!member1.trim() || !member2.trim()} className="rounded-lg bg-[#BBFF5E] px-4 py-2 text-sm font-bold text-[#081208] disabled:opacity-40">Aggiungi coppia</button>
        </div>
      )}
    </section>
  );
}

function GroupTeamRow({ tournamentId, entry, name, canEdit, showOperational, canRemove, notify }: {
  tournamentId: string; entry: TournamentGroupTeam; name: string; canEdit: boolean; showOperational: boolean; canRemove: boolean; notify: (message: string) => void;
}) {
  const [draft, setDraft] = useState(entry);
  const save = async () => {
    try {
      await updateTournamentGroupTeam(tournamentId, entry.id, { played: draft.played, won: draft.won, lost: draft.lost, points: draft.points, order: draft.order, qualified: draft.qualified });
      notify("Girone aggiornato.");
    } catch (error) { notify(error instanceof Error ? error.message : "Errore."); }
  };
  const number = (field: "played" | "won" | "lost" | "points") => (
    canEdit ? <input aria-label={`${field} ${name}`} type="number" value={draft[field]} onChange={(e) => setDraft({ ...draft, [field]: Number(e.target.value) })} onBlur={save} className="w-14 rounded border border-[rgba(251,243,222,0.12)] bg-[#123008] px-2 py-1 text-center" /> : draft[field]
  );
  return (
    <tr className={`border-t border-[rgba(251,243,222,0.08)] ${entry.qualified ? "bg-[rgba(187,255,94,0.06)]" : ""}`}>
      <td className="break-words px-3 py-3 font-bold">{name}</td>
      <td className="text-center">{number("played")}</td>
      {showOperational && <><td className="text-center">{number("won")}</td><td className="text-center">{number("lost")}</td></>}
      <td className="text-center font-bold text-[#BBFF5E]">{number("points")}</td>
      {showOperational && <td className="text-center">{canEdit ? <input aria-label={`Qualificata ${name}`} type="checkbox" checked={draft.qualified} onChange={async (e) => { const next = { ...draft, qualified: e.target.checked }; setDraft(next); await updateTournamentGroupTeam(tournamentId, entry.id, { played: next.played, won: next.won, lost: next.lost, points: next.points, order: next.order, qualified: next.qualified }); }} /> : entry.qualified ? <ShieldCheck className="mx-auto text-[#BBFF5E]" size={17} /> : "—"}</td>}
      {canRemove && <td className="px-3 text-right"><button title="Rimuovi squadra" onClick={() => removeTournamentGroupTeam(tournamentId, entry.id)} className="text-[#FF6B6B]"><X size={15} /></button></td>}
    </tr>
  );
}

function BracketsPanel({ tournament, rounds, matches, teams, isOperator, notify }: {
  tournament: Tournament; rounds: TournamentBracketRound[]; matches: TournamentBracketMatch[]; teams: TournamentTeam[];
  isOperator: boolean; notify: (message: string) => void;
}) {
  const keys = getTournamentBracketKeys(tournament.bracketMode) as TournamentBracketKey[];
  const [key, setKey] = useState<TournamentBracketKey>(keys[0]);
  return (
    <div>
      {keys.length > 1 && <div className="mb-4 grid grid-cols-2 gap-2">{keys.map((item) => <button key={item} onClick={() => setKey(item)} className={`rounded-lg px-4 py-2.5 font-bold uppercase ${key === item ? "bg-[#BBFF5E] text-[#081208]" : "bg-[#0A0B08]"}`}>{item}</button>)}</div>}
      <BracketBoard tournament={tournament} bracketKey={key} rounds={rounds.filter((round) => round.bracketKey === key)} matches={matches.filter((match) => match.bracketKey === key)} teams={teams} isOperator={isOperator} notify={notify} />
    </div>
  );
}

function BracketBoard({ tournament, bracketKey, rounds, matches, teams, isOperator, notify }: {
  tournament: Tournament; bracketKey: TournamentBracketKey; rounds: TournamentBracketRound[]; matches: TournamentBracketMatch[]; teams: TournamentTeam[];
  isOperator: boolean; notify: (message: string) => void;
}) {
  const sortedRounds = [...rounds].sort((a, b) => a.order - b.order);
  const [roundId, setRoundId] = useState<string | null>(null);
  const activeRound = sortedRounds.find((round) => round.id === roundId) ?? sortedRounds[0];
  const activeRoundIndex = activeRound ? sortedRounds.findIndex((round) => round.id === activeRound.id) : -1;
  const previousRound = activeRoundIndex > 0 ? sortedRounds[activeRoundIndex - 1] : undefined;
  const [newRound, setNewRound] = useState("");
  const [showMatch, setShowMatch] = useState(false);
  const teamName = (id?: string) => id ? teams.find((team) => team.id === id)?.displayName ?? "Coppia rimossa" : "— slot in attesa —";
  const sourceOptions = useMemo(() => sortedRounds.flatMap((round) => matches.filter((match) => match.roundId === round.id).sort((a, b) => a.order - b.order).map((match, index) => ({ id: match.id, label: `Vincente ${round.name} ${index + 1}`, roundOrder: round.order }))), [matches, sortedRounds]);
  const activeMatches = matches.filter((match) => match.roundId === activeRound?.id).sort((a, b) => a.order - b.order);
  const champion = activeRound?.name.toLowerCase() === "finale" ? activeMatches.find((match) => match.winnerTeamId)?.winnerTeamId : undefined;

  return (
    <div>
      {isOperator && <div className="mb-4 flex gap-2"><input value={newRound} onChange={(e) => setNewRound(e.target.value)} placeholder="Ottavi, Quarti, Semifinale, Finale" className="min-w-0 flex-1 rounded-lg border border-[rgba(251,243,222,0.16)] px-3 py-2.5" /><button onClick={async () => { if (!newRound.trim()) return; await createTournamentRound(tournament.id, bracketKey, newRound.trim(), sortedRounds.length); setNewRound(""); notify("Turno creato."); }} className="rounded-lg bg-[#BBFF5E] px-4 font-bold text-[#081208]">Crea</button></div>}
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {sortedRounds.map((round) => <button key={round.id} onClick={() => setRoundId(round.id)} className={`shrink-0 rounded-lg px-4 py-2 text-sm font-bold ${activeRound?.id === round.id ? "bg-[#BBFF5E] text-[#081208]" : "bg-[#0A0B08]"}`}>{round.name}</button>)}
      </div>
      {!activeRound && <Empty text="Nessun turno creato." />}
      {activeRound && (
        <>
          {isOperator && <div className="mb-3 flex justify-end"><button onClick={async () => { if (confirmDelete(activeRound.name)) await deleteTournamentRound(tournament.id, activeRound.id); }} className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6B6B]"><Trash2 size={14} /> Elimina turno</button></div>}
          {isOperator && previousRound && activeMatches.length === 0 && (
            <button
              onClick={async () => {
                const previousMatches = matches.filter((match) => match.roundId === previousRound.id).sort((a, b) => a.order - b.order);
                if (previousMatches.length === 0) return notify("Il turno precedente non contiene incontri.");
                try {
                  for (let index = 0; index < previousMatches.length; index += 2) {
                    await createTournamentMatch(tournament.id, bracketKey, activeRound.id, index / 2, {
                      team1SourceMatchId: previousMatches[index]?.id ?? null,
                      team2SourceMatchId: previousMatches[index + 1]?.id ?? null,
                      team1Id: previousMatches[index]?.winnerTeamId ?? null,
                      team2Id: previousMatches[index + 1]?.winnerTeamId ?? null,
                    });
                  }
                  notify(`${activeRound.name} collegato ai vincitori di ${previousRound.name}.`);
                } catch (error) {
                  notify(error instanceof Error ? error.message : "Generazione non riuscita.");
                }
              }}
              className="mb-3 inline-flex items-center gap-2 rounded-lg border border-[#BBFF5E] px-3 py-2 text-xs font-bold text-[#BBFF5E]"
            >
              Crea dagli incontri di {previousRound.name}
            </button>
          )}
          <div className="space-y-3">
            {activeMatches.map((match) => <TournamentMatchCard key={match.id} tournament={tournament} match={match} teams={teams} sourceOptions={sourceOptions.filter((option) => option.roundOrder < activeRound.order)} teamName={teamName} isOperator={isOperator} notify={notify} />)}
          </div>
          {isOperator && <div className="mt-4">{showMatch ? <NewTournamentMatch tournament={tournament} bracketKey={bracketKey} round={activeRound} order={activeMatches.length} teams={teams} sourceOptions={sourceOptions.filter((option) => option.roundOrder < activeRound.order)} onClose={() => setShowMatch(false)} notify={notify} /> : <button onClick={() => setShowMatch(true)} className="inline-flex items-center gap-2 text-sm font-bold text-[#BBFF5E]"><Plus size={16} /> Aggiungi incontro</button>}</div>}
        </>
      )}
      {champion && <div className="mt-5 border border-[#BBFF5E] bg-[rgba(187,255,94,0.08)] p-6 text-center"><Trophy className="mx-auto text-[#BBFF5E]" size={30} /><p className="mt-2 text-xs font-bold uppercase text-[#BBFF5E]">Vincitore {bracketKey === "main" ? "del torneo" : bracketKey}</p><p className="font-display text-3xl">{teamName(champion)}</p></div>}
    </div>
  );
}

function TournamentMatchCard({ tournament, match, teams, sourceOptions, teamName, isOperator, notify }: {
  tournament: Tournament; match: TournamentBracketMatch; teams: TournamentTeam[]; sourceOptions: { id: string; label: string }[];
  teamName: (id?: string) => string; isOperator: boolean; notify: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const sourceLabel = (id?: string) => sourceOptions.find((option) => option.id === id)?.label ?? "Vincente incontro";
  if (editing) return <MatchEditor tournament={tournament} match={match} teams={teams} sourceOptions={sourceOptions} onClose={() => setEditing(false)} notify={notify} canManageStructure={isOperator} />;
  return (
    <div className="border border-[rgba(251,243,222,0.12)] bg-[#0A0B08] p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] items-center">
        <div className={match.winnerTeamId === match.team1Id ? "font-bold text-[#BBFF5E]" : ""}>{match.team1Id ? teamName(match.team1Id) : match.team1SourceMatchId ? sourceLabel(match.team1SourceMatchId) : teamName()}</div>
        <span className="text-center text-[10px] uppercase text-[rgba(251,243,222,0.4)]">vs</span>
        <div className={`text-right ${match.winnerTeamId === match.team2Id ? "font-bold text-[#BBFF5E]" : ""}`}>{match.team2Id ? teamName(match.team2Id) : match.team2SourceMatchId ? sourceLabel(match.team2SourceMatchId) : teamName()}</div>
        {match.score && <div className="col-span-3 mt-2 text-center font-display text-xl">{match.score}</div>}
      </div>
      {isOperator && <div className="mt-3 flex gap-3 border-t border-[rgba(251,243,222,0.08)] pt-3"><button onClick={() => setEditing(true)} className="text-xs font-bold text-[#BBFF5E]">Modifica incontro</button><button onClick={async () => { if (confirmDelete("incontro")) await deleteTournamentMatch(tournament.id, match.id); }} className="text-xs font-bold text-[#FF6B6B]">Elimina</button></div>}
    </div>
  );
}

function MatchEditor({ tournament, match, teams, sourceOptions, onClose, notify, canManageStructure }: {
  tournament: Tournament; match: TournamentBracketMatch; teams: TournamentTeam[]; sourceOptions: { id: string; label: string }[];
  onClose: () => void; notify: (message: string) => void; canManageStructure: boolean;
}) {
  const initial = (teamId?: string, sourceId?: string) => canManageStructure && sourceId ? `source:${sourceId}` : teamId ? `team:${teamId}` : "";
  const [slot1, setSlot1] = useState(initial(match.team1Id, match.team1SourceMatchId));
  const [slot2, setSlot2] = useState(initial(match.team2Id, match.team2SourceMatchId));
  const [score, setScore] = useState(match.score ?? "");
  const [winner, setWinner] = useState(match.winnerTeamId ?? "");
  const direct = (value: string) => value.startsWith("team:") ? value.slice(5) : "";
  const source = (value: string) => value.startsWith("source:") ? value.slice(7) : "";
  const resolved = (slot: string, currentSource?: string, currentTeam?: string) =>
    direct(slot) || (source(slot) && source(slot) === currentSource ? currentTeam ?? "" : "");
  const resolved1 = resolved(slot1, match.team1SourceMatchId, match.team1Id);
  const resolved2 = resolved(slot2, match.team2SourceMatchId, match.team2Id);
  const save = async () => {
    const fields: TournamentMatchFields = { team1Id: direct(slot1) || null, team2Id: direct(slot2) || null, score: score.trim(), winnerTeamId: winner || null };
    if (canManageStructure) Object.assign(fields, { team1SourceMatchId: source(slot1) || null, team2SourceMatchId: source(slot2) || null });
    try { await updateTournamentMatch(tournament.id, match.id, fields); notify("Incontro aggiornato."); onClose(); } catch (error) { notify(error instanceof Error ? error.message : "Errore."); }
  };
  return <div className="border border-[#BBFF5E] bg-[#0A0B08] p-4"><SlotSelect value={slot1} onChange={(value) => { setSlot1(value); setWinner(""); }} teams={teams} sources={sourceOptions} allowSources={canManageStructure} /><SlotSelect value={slot2} onChange={(value) => { setSlot2(value); setWinner(""); }} teams={teams} sources={sourceOptions} allowSources={canManageStructure} /><input value={score} onChange={(e) => setScore(e.target.value)} placeholder="Risultato" className="mb-2 w-full rounded-lg border border-[rgba(251,243,222,0.16)] px-3 py-2" /><select value={winner} onChange={(e) => setWinner(e.target.value)} className="mb-3 w-full rounded-lg border border-[rgba(251,243,222,0.16)] bg-[#081208] px-3 py-2"><option value="">Vincitore non deciso</option>{resolved1 && <option value={resolved1}>{teams.find((team) => team.id === resolved1)?.displayName}</option>}{resolved2 && <option value={resolved2}>{teams.find((team) => team.id === resolved2)?.displayName}</option>}</select><div className="flex gap-2"><button onClick={save} className="flex-1 rounded-lg bg-[#BBFF5E] py-2 font-bold text-[#081208]">Salva</button><button onClick={onClose} className="flex-1 rounded-lg border border-[rgba(251,243,222,0.16)] py-2">Annulla</button></div></div>;
}

function NewTournamentMatch({ tournament, bracketKey, round, order, teams, sourceOptions, onClose, notify }: {
  tournament: Tournament; bracketKey: TournamentBracketKey; round: TournamentBracketRound; order: number; teams: TournamentTeam[]; sourceOptions: { id: string; label: string }[]; onClose: () => void; notify: (message: string) => void;
}) {
  const [slot1, setSlot1] = useState(""); const [slot2, setSlot2] = useState("");
  const fields = (value: string, side: 1 | 2): TournamentMatchFields => value.startsWith("source:") ? { [side === 1 ? "team1SourceMatchId" : "team2SourceMatchId"]: value.slice(7) } : { [side === 1 ? "team1Id" : "team2Id"]: value.replace("team:", "") || null };
  return <div className="border border-[rgba(251,243,222,0.12)] bg-[#0A0B08] p-4"><SlotSelect value={slot1} onChange={setSlot1} teams={teams} sources={sourceOptions} allowSources /><SlotSelect value={slot2} onChange={setSlot2} teams={teams} sources={sourceOptions} allowSources /><div className="flex gap-2"><button onClick={async () => { try { await createTournamentMatch(tournament.id, bracketKey, round.id, order, { ...fields(slot1, 1), ...fields(slot2, 2) }); notify("Incontro creato."); onClose(); } catch (error) { notify(error instanceof Error ? error.message : "Errore."); } }} className="flex-1 rounded-lg bg-[#BBFF5E] py-2 font-bold text-[#081208]">Crea</button><button onClick={onClose} className="flex-1 rounded-lg border border-[rgba(251,243,222,0.16)]">Annulla</button></div></div>;
}

function SlotSelect({ value, onChange, teams, sources, allowSources }: { value: string; onChange: (value: string) => void; teams: TournamentTeam[]; sources: { id: string; label: string }[]; allowSources: boolean }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="mb-2 w-full rounded-lg border border-[rgba(251,243,222,0.16)] bg-[#081208] px-3 py-2"><option value="">Slot vuoto</option>{[...teams].sort((a, b) => a.displayName.localeCompare(b.displayName)).map((team) => <option key={team.id} value={`team:${team.id}`}>{team.displayName}</option>)}{allowSources && sources.map((item) => <option key={item.id} value={`source:${item.id}`}>{item.label}</option>)}</select>;
}

function TournamentForm({ tournament, onCancel, onDone }: { tournament?: Tournament; onCancel: () => void; onDone: (id?: string) => void }) {
  const [name, setName] = useState(tournament?.name ?? "");
  const [season, setSeason] = useState(tournament?.season ?? String(new Date().getFullYear()));
  const [status, setStatus] = useState<Tournament["status"]>(tournament?.status ?? "bozza");
  const [bracketMode, setBracketMode] = useState<Tournament["bracketMode"]>(tournament?.bracketMode ?? "unico");
  const [visible, setVisible] = useState(tournament?.isPubliclyVisible ?? false);
  const [error, setError] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [createdTournamentId, setCreatedTournamentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    setError("");
    setLogoError(null);
    let uploadedLogo: Awaited<ReturnType<typeof uploadTournamentLogo>> | null = null;
    try {
      const payload = { name: name.trim(), season: season.trim(), status, bracketMode, isPubliclyVisible: visible };
      let targetId = tournament?.id ?? createdTournamentId;
      if (targetId) {
        await updateTournament(targetId, payload);
      } else {
        const response = await createTournament(payload);
        targetId = response.id;
        setCreatedTournamentId(targetId);
      }
      if (logoFile) {
        uploadedLogo = await uploadTournamentLogo(targetId, logoFile);
        await setTournamentLogo(targetId, uploadedLogo.url, uploadedLogo.storagePath, `Logo ${name.trim()}`);
      } else if (removeLogo && tournament?.logoUrl) {
        await removeTournamentLogo(targetId);
      }
      const previousLogo = tournament?.logoStoragePath ?? tournament?.logoUrl;
      if ((uploadedLogo || removeLogo) && previousLogo) await deleteTournamentLogo(previousLogo);
      onDone(targetId);
    } catch (caught) {
      if (uploadedLogo) await deleteTournamentLogo(uploadedLogo.storagePath);
      const message = caught instanceof Error ? caught.message : "Salvataggio non riuscito.";
      setError(message);
      setLogoError(message);
    } finally {
      setSaving(false);
    }
  };
  return <div className="mb-5 border border-[#BBFF5E] bg-[#0A0B08] p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-display text-2xl">{tournament ? "Modifica torneo" : "Nuovo torneo"}</h3><button onClick={onCancel}><X size={18} /></button></div><div className="grid gap-2 md:grid-cols-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome torneo" className="rounded-lg border border-[rgba(251,243,222,0.16)] px-3 py-2.5" /><input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="Stagione o data" className="rounded-lg border border-[rgba(251,243,222,0.16)] px-3 py-2.5" /><select value={bracketMode} onChange={(e) => setBracketMode(e.target.value as Tournament["bracketMode"])} className="rounded-lg border border-[rgba(251,243,222,0.16)] bg-[#081208] px-3 py-2.5">{tournamentBracketModeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value as Tournament["status"])} className="rounded-lg border border-[rgba(251,243,222,0.16)] bg-[#081208] px-3 py-2.5">{tournamentStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Visibile agli utenti</label><div className="mt-4"><ImageUploadField label="Logo del torneo" currentUrl={removeLogo ? null : tournament?.logoUrl} currentAlt={tournament?.logoAlt ?? `Logo ${name}`} selectedFile={logoFile} loading={saving} error={logoError} uploadLabel="Aggiungi logo" replaceLabel="Sostituisci logo" removeLabel="Elimina logo" aspectClass="aspect-square" onFileChange={(file) => { setLogoFile(file); setRemoveLogo(false); setLogoError(null); }} onRemoveImage={() => { if (tournament?.logoUrl && !confirmDelete(`il logo di ${tournament.name}`)) return; setLogoFile(null); setRemoveLogo(true); }} /></div>{error && <p className="mt-3 text-sm font-bold text-[#FF6B6B]">{error}</p>}<button onClick={save} disabled={saving || !name.trim() || !season.trim()} className="mt-4 w-full rounded-lg bg-[#BBFF5E] py-2.5 font-bold text-[#081208] disabled:opacity-40">{saving ? "Salvataggio..." : "Salva torneo"}</button></div>;
}

function StatusBadge({ value }: { value: Tournament["status"] }) {
  return <span className="rounded-full bg-[rgba(187,255,94,0.10)] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#BBFF5E]">{value === "in_corso" ? "In corso" : value}</span>;
}
function Empty({ text }: { text: string }) { return <div className="border border-dashed border-[rgba(251,243,222,0.16)] p-6 text-center text-sm text-[rgba(251,243,222,0.52)]">{text}</div>; }
function Toast({ text }: { text: string }) { return <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#FBF3DE] px-4 py-2 text-sm font-bold text-[#081208]">{text}</div>; }
