import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { where } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { useAuth } from "../contexts/AuthContext";
import { confirmDelete } from "../lib/confirmDelete";
import { findDuplicateTeamInMatchday, isSelfMatch } from "../lib/matchdayValidation";
import {
  saveMatchResult,
  setMatchStatus as apiSetMatchStatus,
  saveMatchdayBulk,
  createMatch,
  createMatchday as createMatchdayViaApi,
  updateMatch,
  deleteMatch,
  createHomeNewsUpdate,
  MatchApiError,
  type ApiMatchStatus,
} from "../lib/matchApi";
import { derivePermissions } from "../lib/permissions";
import { MatchdayShareButton } from "../components/MatchdayShareButton";
import { TypeBadge } from "../components/TypeBadge";
import { ScheduleImportPanel } from "../components/ScheduleImportPanel";
import { setActiveMatchday } from "../lib/championshipAdminApi";
import { OperationalStandings } from "../components/OperationalStandings";
import { resolveActiveMatchdayId } from "../lib/activeMatchday";
import type { ChampionshipEdition, ChampionshipType, EditionTeam, Team, Matchday, Match, MatchStatus } from "../types";
import { ArrowLeft, Plus, Clock, Ban, Trash2, X, Pencil } from "lucide-react";

const RESULT_OPTIONS: NonNullable<Match["result"]>[] = ["2-0", "2-1", "1-2", "0-2"];

const STATUS_TO_API: Record<MatchStatus, ApiMatchStatus> = {
  da_giocare: "scheduled",
  conclusa: "completed",
  rinviata: "postponed",
  annullata: "cancelled",
};

/**
 * Fase 7 — permessi distinti invece di un unico "canManage" generico. Ognuno riflette
 * esattamente una capacità elencata nella specifica: superAdmin/admin hanno tutte le
 * funzioni strutturali, il resultManager (gestore) solo l'inserimento/correzione di
 * risultati e i cambi di stato rinviata/annullata. La logica pura vive in
 * src/lib/permissions.ts (derivePermissions), testabile senza dover montare React.
 */
function usePermissions() {
  const { appUser } = useAuth();
  return { appUser, ...derivePermissions(appUser?.role) };
}

export function GiornatePage() {
  const { editionId } = useParams();
  const navigate = useNavigate();
  const perms = usePermissions();
  const { canEditResults, canManageMatchdays } = perms;

  const editionsQuery = useCollection<ChampionshipEdition>("championshipEditions");
  const typesQuery = useCollection<ChampionshipType>("championshipTypes");
  const teamsQuery = useCollection<Team>("teams");
  const editionTeamsQuery = useCollection<EditionTeam>(
    "editionTeams",
    editionId ? [where("editionId", "==", editionId)] : [],
    [editionId]
  );
  const matchdaysQuery = useCollection<Matchday>(
    "matchdays",
    editionId ? [where("editionId", "==", editionId)] : [],
    [editionId]
  );
  const matchesQuery = useCollection<Match>(
    "matches",
    editionId ? [where("editionId", "==", editionId)] : [],
    [editionId]
  );

  const [selectedMatchdayId, setSelectedMatchdayId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"standings" | "calendar">("standings");
  const [toast, setToast] = useState<string | null>(null);
  const [showScheduleImport, setShowScheduleImport] = useState(false);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const editions = editionsQuery.data;
  const types = typesQuery.data;
  const teams = teamsQuery.data;
  const editionTeams = editionTeamsQuery.data;
  const matchdays = matchdaysQuery.data;
  const matches = matchesQuery.data;
  const loading = [editionsQuery, typesQuery, teamsQuery, editionTeamsQuery, matchdaysQuery, matchesQuery].some((query) => query.loading);
  const queryError = [editionsQuery, typesQuery, teamsQuery, editionTeamsQuery, matchdaysQuery, matchesQuery].find((query) => query.error)?.error;

  if (!canEditResults) {
    return <div className="p-4 text-sm text-[rgba(251,243,222,0.58)]">Non hai i permessi per vedere questa pagina.</div>;
  }
  if (loading) {
    return <div className="p-4 text-sm text-[rgba(251,243,222,0.58)]">Caricamento area campionato...</div>;
  }
  if (queryError) {
    return (
      <div className="p-4">
        <h2 className="font-bold">Area campionato non disponibile</h2>
        <p className="my-2 text-sm text-[rgba(251,243,222,0.58)]">{queryError.message}</p>
        <button onClick={() => {
          editionsQuery.retry(); typesQuery.retry(); teamsQuery.retry(); editionTeamsQuery.retry(); matchdaysQuery.retry(); matchesQuery.retry();
        }} className="text-sm font-bold text-[#BBFF5E]">Riprova</button>
      </div>
    );
  }

  const edition = editions.find((e) => e.id === editionId);
  const type = edition ? types.find((t) => t.id === edition.typeId) : undefined;

  if (!edition || !type) {
    return <div className="p-4 text-sm text-[rgba(251,243,222,0.58)]">Edizione non trovata.</div>;
  }
  if (!type.hasTeams) {
    return (
      <div className="p-4 text-sm text-[rgba(251,243,222,0.58)]">
        Le giornate si applicano solo ai campionati a squadre.
      </div>
    );
  }

  const sortedMatchdays = [...matchdays].sort((a, b) => a.number - b.number);
  const enrolledTeamIds = new Set(editionTeams.map((entry) => entry.teamId));
  const enrolledTeams = teams.filter((team) => enrolledTeamIds.has(team.id));
  const matchesFor = (matchdayId: string) => matches.filter((m) => m.matchdayId === matchdayId);
  const selectedMatchday = sortedMatchdays.find((m) => m.id === selectedMatchdayId);

  const createMatchday = async () => {
    const nextNumber = sortedMatchdays.length > 0 ? Math.max(...sortedMatchdays.map((m) => m.number)) + 1 : 1;
    try {
      const response = await createMatchdayViaApi({ editionId: edition.id, number: nextNumber });
      setSelectedMatchdayId(response.matchdayId);
      showToast(`${nextNumber}ª giornata creata.`);
    } catch (err) {
      console.error(err);
      showToast("Errore nella creazione della giornata.");
    }
  };

  return (
    <div className="p-4 pb-6">
      <button onClick={() => navigate("/gestione")} className="flex items-center gap-1 text-xs text-[rgba(251,243,222,0.58)] mb-3">
        <ArrowLeft size={13} /> Gestione
      </button>
      <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE] mb-1 flex items-center gap-2">
        <TypeBadge type={type} variant="header" />
        {type.name} {edition.season}
      </h2>
      <div className="mb-4 mt-3 grid grid-cols-2 rounded-lg bg-[#0A0B08] p-1" role="tablist" aria-label="Area campionato">
        <button role="tab" aria-selected={activeTab === "standings"} onClick={() => setActiveTab("standings")}
          className={`rounded-md px-3 py-2.5 text-sm font-bold ${activeTab === "standings" ? "bg-[#BBFF5E] text-[#081208]" : "text-[rgba(251,243,222,0.72)]"}`}>
          Classifica
        </button>
        <button role="tab" aria-selected={activeTab === "calendar"} onClick={() => {
          setActiveTab("calendar");
          setSelectedMatchdayId((current) => current ?? resolveActiveMatchdayId(edition.activeMatchdayId, sortedMatchdays, matches));
        }}
          className={`rounded-md px-3 py-2.5 text-sm font-bold ${activeTab === "calendar" ? "bg-[#BBFF5E] text-[#081208]" : "text-[rgba(251,243,222,0.72)]"}`}>
          Calendario
        </button>
      </div>

      {activeTab === "standings" ? (
        <OperationalStandings
          editionId={edition.id}
          typeId={edition.typeId}
          categoryName={type.name}
          season={edition.season}
          entries={editionTeams}
          teams={teams}
          matches={matches}
          canEdit={perms.canEditOperationalStandings}
          canEnroll={perms.canEnrollExistingTeam}
          canShare={perms.canShareStandings}
          showToast={showToast}
        />
      ) : (
        <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-[rgba(251,243,222,0.58)]">Giornate e risultati</p>
        {perms.isSuperAdmin && (
          <button onClick={() => setShowScheduleImport((value) => !value)}
            className="rounded-lg border border-[rgba(251,243,222,0.16)] px-2.5 py-1.5 text-xs font-bold text-[#BBFF5E]">
            Importa calendario
          </button>
        )}
      </div>

      {showScheduleImport && perms.isSuperAdmin && (
        <ScheduleImportPanel editionId={edition.id} teams={enrolledTeams} onClose={() => setShowScheduleImport(false)} onDone={showToast} />
      )}

      {sortedMatchdays.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Seleziona giornata">
          {sortedMatchdays.map((day) => (
            <button key={day.id} role="tab" aria-selected={selectedMatchdayId === day.id}
              onClick={() => setSelectedMatchdayId(day.id)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${
                selectedMatchdayId === day.id
                  ? "bg-[#BBFF5E] text-[#081208]"
                  : "border border-[rgba(251,243,222,0.16)] text-[rgba(251,243,222,0.72)]"
              }`}>
              Giornata {day.number}
            </button>
          ))}
        </div>
      )}

      {!selectedMatchday ? (
        <div>
          <div className="flex flex-col gap-2 mb-3">
            {sortedMatchdays.length === 0 && (
              <p className="text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessuna giornata creata ancora.</p>
            )}
            {sortedMatchdays.map((md) => {
              const ms = matchesFor(md.id);
              const missing = ms.filter((m) => m.status === "da_giocare").length;
              return (
                <button
                  key={md.id}
                  onClick={() => setSelectedMatchdayId(md.id)}
                  className="w-full text-left bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl px-4 py-3"
                >
                  <p className="font-bold">{md.number}ª giornata</p>
                  <p className="text-xs text-[rgba(251,243,222,0.50)] mt-1">
                    {ms.length} partit{ms.length === 1 ? "a" : "e"}
                    {ms.length > 0 && (missing > 0 ? `, ${missing} risultat${missing === 1 ? "o mancante" : "i mancanti"}` : " — completa")}
                  </p>
                </button>
              );
            })}
          </div>
          {canManageMatchdays && (
            <button onClick={createMatchday} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#BBFF5E]">
              <Plus size={15} /> Nuova giornata
            </button>
          )}
        </div>
      ) : (
        <MatchdayDetail
          matchday={selectedMatchday}
          matches={matchesFor(selectedMatchday.id)}
          teams={teams}
          enrolledTeams={enrolledTeams}
          matchdays={sortedMatchdays}
          editionTeams={editionTeams}
          editionId={editionId!}
          typeName={type.name}
          season={edition.season}
          perms={perms}
          isActiveMatchday={edition.activeMatchdayId === selectedMatchday.id}
          onBack={() => setSelectedMatchdayId(null)}
          showToast={showToast}
        />
      )}
        </>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#0A0B08] text-[#FBF3DE] border border-[rgba(187,255,94,0.3)] px-4 py-2.5 rounded-full text-[12.5px] max-w-[90%] text-center z-20">
          {toast}
        </div>
      )}
    </div>
  );
}

type Perms = ReturnType<typeof usePermissions>;

function MatchdayDetail({
  matchday,
  matches,
  teams,
  enrolledTeams,
  matchdays,
  editionTeams,
  editionId,
  typeName,
  season,
  perms,
  isActiveMatchday,
  onBack,
  showToast,
}: {
  matchday: Matchday;
  matches: Match[];
  teams: Team[];
  enrolledTeams: Team[];
  matchdays: Matchday[];
  editionTeams: EditionTeam[];
  editionId: string;
  typeName: string;
  season: string;
  perms: Perms;
  isActiveMatchday: boolean;
  onBack: () => void;
  showToast: (msg: string) => void;
}) {
  const { canCreateMatches, canDeleteMatches, canEditResults, canCreateHomeNewsDraft } = perms;
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [team1Id, setTeam1Id] = useState("");
  const [team2Id, setTeam2Id] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  // Fase 1: nessuna scrittura diretta su Firestore per il flusso risultato/stato — solo
  // l'endpoint backend. savingMatchId previene il doppio clic sulla stessa partita.
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [pendingNotify, setPendingNotify] = useState<Match | null>(null);
  const [settingActive, setSettingActive] = useState(false);

  const handleSetActive = async () => {
    setSettingActive(true);
    try {
      await setActiveMatchday(editionId, matchday.id);
      showToast(`${matchday.number}ª giornata impostata come attiva.`);
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Impossibile impostare la giornata attiva.");
    } finally {
      setSettingActive(false);
    }
  };

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "Squadra eliminata";

  const STATUS_LABELS: Record<MatchStatus, string> = {
    da_giocare: "Da giocare",
    conclusa: "Conclusa",
    rinviata: "Rinviata",
    annullata: "Annullata",
  };

  /**
   * Fase 6/14 — finché l'invio push reale non è configurato, questa funzione crea
   * soltanto una bozza di notizia su Home (status "bozza"), interamente lato backend
   * (api/home-news/create-result-update.js): partita/e, notizia e audit log in
   * un'unica transazione. Non imposta mai un campo che dichiari una notifica
   * realmente inviata: notificationStatus resta "draft".
   */
  const createHomeNewsDraft = async (matchesToNotify: Match[]) => {
    if (matchesToNotify.length === 0) return;
    await createHomeNewsUpdate({
      matchIds: matchesToNotify.map((m) => m.id),
      editionId,
      matchdayId: matchday.id,
      typeName,
      season,
    });
  };

  /** Fase 9 — creazione partita interamente lato backend: tutte le validazioni
   * (squadre diverse, iscritte all'edizione, non già impegnate nella giornata, non
   * duplicata) sono verificate dall'endpoint, non solo qui nel frontend. */
  const addMatch = async () => {
    if (!canCreateMatches) return;
    if (!team1Id || !team2Id) return;
    if (isSelfMatch(team1Id, team2Id)) {
      showToast("Le due squadre coincidono.");
      return;
    }
    const dup = findDuplicateTeamInMatchday(matches, team1Id, team2Id);
    if (dup) {
      showToast(`La squadra ${teamName(dup.teamId)} è già presente nella ${matchday.number}ª giornata.`);
      return;
    }
    try {
      await createMatch({
        editionId,
        matchdayId: matchday.id,
        team1Id,
        team2Id,
        ...(matchDate ? { matchDate } : {}),
        ...(matchTime ? { matchTime } : {}),
      });
      setShowAddMatch(false);
      setTeam1Id("");
      setTeam2Id("");
      setMatchDate("");
      setMatchTime("");
      showToast("Partita aggiunta.");
    } catch (err) {
      console.error(err);
      const msg = err instanceof MatchApiError ? err.message : "Errore nell'aggiunta.";
      showToast(msg);
    }
  };

  const removeMatch = async (m: Match) => {
    if (!canDeleteMatches) return;
    if (!confirmDelete(`${teamName(m.team1Id)} vs ${teamName(m.team2Id)}`)) return;
    try {
      await deleteMatch({ matchId: m.id });
      showToast("Partita eliminata.");
    } catch (err) {
      console.error(err);
      const msg = err instanceof MatchApiError ? err.message : "Errore nell'eliminazione.";
      showToast(msg);
    }
  };

  /**
   * Fase 1/3 — unica chiamata all'endpoint backend: partita, classifica e audit log
   * vengono salvati insieme in modo atomico. Il frontend non tocca più Firestore per
   * risultato/stato e non scrive più l'audit log da solo.
   */
  const saveResult = async (match: Match, result: string) => {
    if (savingMatchId) return; // previene il doppio clic
    setSavingMatchId(match.id);
    try {
      await saveMatchResult({ matchId: match.id, result: result as Match["result"] & string });
      setPendingNotify({ ...match, result: result as Match["result"], status: "conclusa" });
    } catch (err) {
      console.error(err);
      const msg = err instanceof MatchApiError ? err.message : "Errore nel salvataggio del risultato.";
      showToast(msg);
    } finally {
      setSavingMatchId(null);
    }
  };

  const respondNotify = async (createDraft: boolean) => {
    if (!pendingNotify) return;
    try {
      if (createDraft) {
        await createHomeNewsDraft([pendingNotify]);
        showToast("Risultato salvato. Aggiornamento Home creato in bozza.");
      } else {
        showToast("Risultato salvato.");
      }
    } catch (err) {
      console.error(err);
      showToast("Risultato salvato, ma la creazione dell'aggiornamento Home non è riuscita.");
    } finally {
      setPendingNotify(null);
    }
  };

  const changeStatus = async (match: Match, status: MatchStatus) => {
    if (savingMatchId) return;
    setSavingMatchId(match.id);
    try {
      await apiSetMatchStatus({ matchId: match.id, status: status as "rinviata" | "annullata" | "da_giocare" });
      showToast("Stato aggiornato.");
    } catch (err) {
      console.error(err);
      const msg = err instanceof MatchApiError ? err.message : "Errore nell'aggiornamento dello stato.";
      showToast(msg);
    } finally {
      setSavingMatchId(null);
    }
  };

  // Fase 4 — l'aggiornamento massivo mostra TUTTE le partite (anche già concluse) e
  // permette per ciascuna: un risultato, "Da giocare", "Rinviata", "Annullata". Solo le
  // partite effettivamente cambiate rispetto allo stato attuale vengono inviate.
  type BulkChoice = { kind: "result"; value: NonNullable<Match["result"]> } | { kind: "status"; value: MatchStatus };
  const [bulkChoices, setBulkChoices] = useState<Record<string, BulkChoice>>({});
  const [bulkReview, setBulkReview] = useState<
    { matchId: string; team1: string; team2: string; beforeStatus: MatchStatus; beforeResult?: string; afterStatus: string; afterResult: string | null }[] | null
  >(null);

  const currentChoiceLabel = (m: Match): string => {
    const choice = bulkChoices[m.id];
    if (!choice) return m.status === "conclusa" && m.result ? m.result : STATUS_LABELS[m.status];
    return choice.kind === "result" ? choice.value : STATUS_LABELS[choice.value];
  };

  const openBulkReview = () => {
    const changed = matches
      .map((m) => {
        const choice = bulkChoices[m.id];
        if (!choice) return null;
        const afterStatus = choice.kind === "result" ? "conclusa" : choice.value;
        const afterResult = choice.kind === "result" ? choice.value : null;
        const isSame = m.status === afterStatus && (m.result ?? null) === afterResult;
        if (isSame) return null;
        return {
          matchId: m.id,
          team1: teamName(m.team1Id),
          team2: teamName(m.team2Id),
          beforeStatus: m.status,
          beforeResult: m.result,
          afterStatus,
          afterResult,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    if (changed.length === 0) {
      showToast("Nessuna modifica da salvare.");
      return;
    }
    setBulkReview(changed);
  };

  const saveBulk = async (createNews: boolean) => {
    if (!bulkReview || bulkReview.length === 0) return;
    setBulkSaving(true);
    try {
      const entries = bulkReview.map((c) => ({
        matchId: c.matchId,
        result: c.afterResult ? (c.afterResult as NonNullable<Match["result"]>) : null,
        status: c.afterResult ? "completed" : STATUS_TO_API[c.afterStatus as MatchStatus],
      }));
      // Fase 4/11: un'unica chiamata atomica al backend per tutta la giornata. Se anche
      // una sola voce non è valida, il backend non salva nulla.
      await saveMatchdayBulk({ matchdayId: matchday.id, editionId, entries });

      const completed = matches
        .filter((m) => bulkReview.some((c) => c.matchId === m.id && c.afterResult))
        .map((m) => {
          const change = bulkReview.find((c) => c.matchId === m.id)!;
          return { ...m, result: change.afterResult as Match["result"], status: "conclusa" as const };
        });

      if (createNews && completed.length > 0) {
        await createHomeNewsDraft(completed);
        showToast(`${bulkReview.length} partite aggiornate. Aggiornamento Home creato in bozza.`);
      } else {
        showToast(`${bulkReview.length} partite aggiornate.`);
      }
      setBulkMode(false);
      setBulkChoices({});
      setBulkReview(null);
    } catch (err) {
      console.error(err);
      const msg = err instanceof MatchApiError ? err.message : "Errore nel salvataggio massivo.";
      const details = err instanceof MatchApiError && Array.isArray(err.details) ? (err.details as string[]) : null;
      showToast(details && details.length > 0 ? `${msg} ${details.join(" ")}` : msg);
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-[rgba(251,243,222,0.58)] mb-3">
        <ArrowLeft size={13} /> Tutte le giornate
      </button>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE]">{matchday.number}ª giornata</h3>
        <div className="flex items-center gap-3">
          {perms.isSuperAdmin && (
            isActiveMatchday ? (
              <span className="text-xs font-semibold text-[#BBFF5E]">Giornata attiva</span>
            ) : (
              <button
                onClick={handleSetActive}
                disabled={settingActive || matches.length === 0}
                className="text-xs font-semibold text-[#BBFF5E] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {settingActive ? "Impostazione..." : "Imposta attiva"}
              </button>
            )
          )}
          {canEditResults && matches.length > 0 && !bulkMode && (
            <button onClick={() => setBulkMode(true)} className="text-xs text-[#BBFF5E] font-semibold">
              Aggiorna intera giornata
            </button>
          )}
        </div>
      </div>
      <div className="mb-3">
        <MatchdayShareButton
          input={{
            categoryName: typeName,
            season,
            matchdayNumber: matchday.number,
            matches: matches.map((match) => ({
              homeTeam: teamName(match.team1Id),
              awayTeam: teamName(match.team2Id),
              result: match.result,
              status: match.status,
              matchDate: match.matchDate,
              matchTime: match.matchTime,
              court: match.court,
            })),
          }}
          showToast={showToast}
        />
      </div>

      {pendingNotify && (
        <div className="bg-[#123008] border border-[rgba(251,243,222,0.18)] rounded-2xl p-3.5 mb-3">
          <p className="text-[13px] font-semibold mb-2">
            {teamName(pendingNotify.team1Id)} {pendingNotify.result} {teamName(pendingNotify.team2Id)}
          </p>
          {canCreateHomeNewsDraft ? (
            <>
              <p className="text-[12.5px] text-[rgba(251,243,222,0.58)] mb-2">Creare un aggiornamento?</p>
              <div className="flex gap-2">
                <button onClick={() => respondNotify(true)} className="flex-1 bg-lime text-[#081208] rounded-lg py-2 text-sm font-bold">
                  Crea aggiornamento Home
                </button>
                <button onClick={() => respondNotify(false)} className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2 text-sm font-semibold">
                  Non creare
                </button>
              </div>
            </>
          ) : (
            <button onClick={() => respondNotify(false)} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg py-2 text-sm font-semibold">
              Ok
            </button>
          )}
        </div>
      )}

      {bulkReview ? (
        <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5 mb-3">
          <p className="text-[13px] font-bold mb-2">Riepilogo modifiche</p>
          <div className="flex flex-col gap-2 mb-3">
            {bulkReview.map((c) => (
              <div key={c.matchId} className="bg-[#123008] rounded-lg p-2.5 text-[12px]">
                <p className="font-semibold mb-1">{c.team1} vs {c.team2}</p>
                <p className="text-[rgba(251,243,222,0.58)]">
                  Stato: {STATUS_LABELS[c.beforeStatus]} → {STATUS_LABELS[c.afterStatus as MatchStatus]}
                  {" · "}Risultato: {c.beforeResult ?? "—"} → {c.afterResult ?? "—"}
                </p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => saveBulk(false)}
              disabled={bulkSaving}
              className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {bulkSaving ? "Salvataggio in corso..." : "Salva senza aggiornamento Home"}
            </button>
            {canCreateHomeNewsDraft && (
              <button
                onClick={() => saveBulk(true)}
                disabled={bulkSaving}
                className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {bulkSaving ? "Salvataggio in corso..." : "Salva e crea aggiornamento Home"}
              </button>
            )}
            <button onClick={() => setBulkReview(null)} className="w-full text-xs text-[rgba(251,243,222,0.50)]">
              Torna indietro
            </button>
          </div>
        </div>
      ) : bulkMode ? (
        <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5 mb-3">
          <p className="text-[13px] font-bold mb-3">Aggiorna intera giornata</p>
          {matches.length === 0 ? (
            <p className="text-[12.5px] text-[rgba(251,243,222,0.50)] mb-3">Nessuna partita in questa giornata.</p>
          ) : (
            <div className="flex flex-col gap-3 mb-3">
              {matches.map((m) => (
                <div key={m.id}>
                  <p className="text-[12.5px] font-semibold mb-1.5">
                    {teamName(m.team1Id)} vs {teamName(m.team2Id)}
                    <span className="text-[rgba(251,243,222,0.50)] font-normal"> · attuale: {currentChoiceLabel(m)}</span>
                  </p>
                  <div className="flex gap-1.5 mb-1 flex-wrap items-center">
                    <BulkScoreSelectors
                      match={m}
                      homeName={teamName(m.team1Id)}
                      awayName={teamName(m.team2Id)}
                      onValid={(value) => setBulkChoices((previous) => ({ ...previous, [m.id]: { kind: "result", value } }))}
                      onInvalid={() => setBulkChoices((previous) => {
                        if (previous[m.id]?.kind !== "result") return previous;
                        const next = { ...previous };
                        delete next[m.id];
                        return next;
                      })}
                    />
                    {(["da_giocare", "rinviata", "annullata"] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setBulkChoices((p) => ({ ...p, [m.id]: { kind: "status", value: st } }))}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                          bulkChoices[m.id]?.kind === "status" && bulkChoices[m.id]?.value === st
                            ? "bg-lime text-[#081208]"
                            : "bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.85)]"
                        }`}
                      >
                        {STATUS_LABELS[st]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button onClick={openBulkReview} className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold">
              Rivedi e salva
            </button>
            <button
              onClick={() => {
                setBulkMode(false);
                setBulkChoices({});
              }}
              className="w-full text-xs text-[rgba(251,243,222,0.50)]"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-3">
          {matches.length === 0 && <p className="text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessuna partita in questa giornata.</p>}
          {matches.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              teamName={teamName}
              canEditResults={canEditResults}
              canDeleteMatches={canDeleteMatches}
              saving={savingMatchId === m.id}
              onSaveResult={(result) => saveResult(m, result)}
              onRemove={() => removeMatch(m)}
              onSetStatus={(status) => changeStatus(m, status)}
              canEditSchedule={canCreateMatches}
              teamOptions={enrolledTeams}
              matchdayOptions={matchdays}
              onUpdateSchedule={async (changes) => {
                try {
                  await updateMatch({ matchId: m.id, ...changes });
                  showToast("Partita aggiornata.");
                } catch (error) {
                  console.error(error);
                  showToast(error instanceof MatchApiError ? error.message : "Errore nell'aggiornamento.");
                }
              }}
            />
          ))}
        </div>
      )}

      {canCreateMatches && !bulkMode && (
        <div>
          {showAddMatch ? (
            <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-bold">Nuova partita</p>
                <button onClick={() => setShowAddMatch(false)}>
                  <X size={16} className="text-[rgba(251,243,222,0.50)]" />
                </button>
              </div>
              <select
                value={team1Id}
                onChange={(e) => setTeam1Id(e.target.value)}
                className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2"
              >
                <option value="">Squadra 1...</option>
                {editionTeams.map((et) => (
                  <option key={et.teamId} value={et.teamId}>
                    {teamName(et.teamId)}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <label className="text-[11px] text-[rgba(251,243,222,0.58)]">
                  Data della partita - facoltativa
                  <input type="date" value={matchDate} onChange={(event) => setMatchDate(event.target.value)} className="mt-1 w-full rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2 text-[13px]" />
                </label>
                <label className="text-[11px] text-[rgba(251,243,222,0.58)]">
                  Ora della partita - facoltativa
                  <input type="time" value={matchTime} onChange={(event) => setMatchTime(event.target.value)} className="mt-1 w-full rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2 text-[13px]" />
                </label>
              </div>
              <select
                value={team2Id}
                onChange={(e) => setTeam2Id(e.target.value)}
                className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2"
              >
                <option value="">Squadra 2...</option>
                {editionTeams.map((et) => (
                  <option key={et.teamId} value={et.teamId}>
                    {teamName(et.teamId)}
                  </option>
                ))}
              </select>
              <button
                onClick={addMatch}
                disabled={!team1Id || !team2Id || team1Id === team2Id}
                className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
              >
                Aggiungi
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAddMatch(true)} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#BBFF5E]">
              <Plus size={15} /> Aggiungi partita
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MatchRow({
  match,
  teamName,
  canEditResults,
  canDeleteMatches,
  saving,
  onSaveResult,
  onRemove,
  onSetStatus,
  canEditSchedule,
  onUpdateSchedule,
  teamOptions,
  matchdayOptions,
}: {
  match: Match;
  teamName: (id: string) => string;
  canEditResults: boolean;
  canDeleteMatches: boolean;
  saving: boolean;
  onSaveResult: (result: string) => void;
  onRemove: () => void;
  onSetStatus: (status: MatchStatus) => void;
  canEditSchedule: boolean;
  teamOptions: Team[];
  matchdayOptions: Matchday[];
  onUpdateSchedule: (changes: {
    team1Id: string;
    team2Id: string;
    matchdayId: string;
    matchDate: string | null;
    matchTime: string | null;
    court: string | null;
    notes: string | null;
    status: MatchStatus;
  }) => Promise<void>;
}) {
  // Fase 6: azione esplicita "Correggi risultato" su una partita già conclusa, invece
  // di dover prima riaprire e poi reinserire il risultato.
  const [correcting, setCorrecting] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [date, setDate] = useState(match.matchDate ?? "");
  const [time, setTime] = useState(match.matchTime ?? "");
  const [team1Id, setTeam1Id] = useState(match.team1Id);
  const [team2Id, setTeam2Id] = useState(match.team2Id);
  const [matchdayId, setMatchdayId] = useState(match.matchdayId);
  const [court, setCourt] = useState(match.court ?? "");
  const [notes, setNotes] = useState(match.notes ?? "");
  const [editStatus, setEditStatus] = useState<MatchStatus>(match.status);
  const initialScore = match.result?.split("-").map(Number) ?? [];
  const [homeScore, setHomeScore] = useState<number | "">(initialScore[0] ?? "");
  const [awayScore, setAwayScore] = useState<number | "">(initialScore[1] ?? "");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const selectedResult = `${homeScore}-${awayScore}`;
  const resultIsValid = RESULT_OPTIONS.includes(selectedResult as (typeof RESULT_OPTIONS)[number]);

  const submitResult = () => {
    if (!resultIsValid) return;
    if (!window.confirm(`Confermi il risultato ${teamName(match.team1Id)} ${selectedResult} ${teamName(match.team2Id)}?`)) return;
    onSaveResult(selectedResult);
    setCorrecting(false);
  };

  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-[13.5px] font-semibold truncate">
          {teamName(match.team1Id)} <span className="text-[rgba(251,243,222,0.50)]">vs</span> {teamName(match.team2Id)}
        </p>
        {match.status === "conclusa" && match.result && (
          <span className="font-display text-[15px] text-[#BBFF5E] shrink-0">{match.result}</span>
        )}
        {match.status === "rinviata" && (
          <span className="flex items-center gap-1 text-[11px] text-[#FF9B6B] shrink-0">
            <Clock size={12} /> Rinviata
          </span>
        )}
        {match.status === "annullata" && (
          <span className="flex items-center gap-1 text-[11px] text-[rgba(251,243,222,0.50)] shrink-0">
            <Ban size={12} /> Annullata
          </span>
        )}
      </div>
      {(match.matchDate || match.matchTime) && (
        <p className="mb-2 text-[11.5px] text-[rgba(251,243,222,0.55)]">
          {formatMatchSchedule(match.matchDate, match.matchTime)}
        </p>
      )}
      {editingSchedule && canEditSchedule && (
        <div className="mb-3 rounded-lg bg-[#123008] p-2.5">
          <div className="mb-2 grid grid-cols-2 gap-2 text-[11px] text-[rgba(251,243,222,0.58)]">
            <div><strong className="block text-[#FBF3DE]">Dati attuali</strong>{teamName(match.team1Id)} - {teamName(match.team2Id)}<br />{formatMatchSchedule(match.matchDate, match.matchTime) || "Senza data"}</div>
            <div><strong className="block text-[#BBFF5E]">Nuovi dati</strong>{teamName(team1Id)} - {teamName(team2Id)}<br />{formatMatchSchedule(date, time) || "Senza data"}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Nuova squadra di casa" value={team1Id} onChange={(event) => setTeam1Id(event.target.value)} className="rounded-lg border border-[rgba(251,243,222,0.18)] px-2 py-2 text-xs">
              {teamOptions.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <select aria-label="Nuova squadra ospite" value={team2Id} onChange={(event) => setTeam2Id(event.target.value)} className="rounded-lg border border-[rgba(251,243,222,0.18)] px-2 py-2 text-xs">
              {teamOptions.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <select aria-label="Nuova giornata" value={matchdayId} onChange={(event) => setMatchdayId(event.target.value)} className="rounded-lg border border-[rgba(251,243,222,0.18)] px-2 py-2 text-xs">
              {matchdayOptions.map((day) => <option key={day.id} value={day.id}>Giornata {day.number}</option>)}
            </select>
            <select aria-label="Nuovo stato partita" value={editStatus} onChange={(event) => setEditStatus(event.target.value as MatchStatus)} className="rounded-lg border border-[rgba(251,243,222,0.18)] px-2 py-2 text-xs">
              <option value="da_giocare">Programmata</option>{match.result && <option value="conclusa">Completata</option>}<option value="rinviata">Rinviata</option><option value="annullata">Annullata</option>
            </select>
            <input aria-label="Data della partita" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-lg border border-[rgba(251,243,222,0.18)] px-2 py-2 text-xs" />
            <input aria-label="Ora della partita" type="time" value={time} onChange={(event) => setTime(event.target.value)} className="rounded-lg border border-[rgba(251,243,222,0.18)] px-2 py-2 text-xs" />
            <input aria-label="Campo della partita" placeholder="Campo (opzionale)" value={court} onChange={(event) => setCourt(event.target.value)} className="rounded-lg border border-[rgba(251,243,222,0.18)] px-2 py-2 text-xs" />
            <input aria-label="Note della partita" placeholder="Note (opzionali)" value={notes} onChange={(event) => setNotes(event.target.value)} className="rounded-lg border border-[rgba(251,243,222,0.18)] px-2 py-2 text-xs" />
          </div>
          {team1Id === team2Id && <p className="mt-2 text-xs text-[#FF9B6B]">Le squadre devono essere diverse.</p>}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button disabled={team1Id === team2Id} onClick={async () => {
              await onUpdateSchedule({ team1Id, team2Id, matchdayId, matchDate: date || null, matchTime: time || null, court: court || null, notes: notes || null, status: editStatus });
              setEditingSchedule(false);
            }} className="rounded-lg bg-lime py-2 text-xs font-bold text-[#081208] disabled:opacity-40">Salva modifiche</button>
            <button onClick={() => setEditingSchedule(false)} className="rounded-lg border border-[rgba(251,243,222,0.18)] py-2 text-xs">Annulla</button>
          </div>
        </div>
      )}

      {match.status === "da_giocare" && canEditResults && (
        <div className="mb-3 rounded-lg bg-[#123008] p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_64px_16px_64px_minmax(0,1fr)] items-center gap-2">
            <span className="truncate text-right text-xs font-semibold">{teamName(match.team1Id)}</span>
            <ScoreSelect label={`Set vinti da ${teamName(match.team1Id)}`} value={homeScore} onChange={setHomeScore} />
            <span className="text-center font-bold">-</span>
            <ScoreSelect label={`Set vinti da ${teamName(match.team2Id)}`} value={awayScore} onChange={setAwayScore} />
            <span className="truncate text-xs font-semibold">{teamName(match.team2Id)}</span>
          </div>
          <button onClick={submitResult} disabled={saving || !resultIsValid}
            className="mt-3 w-full rounded-lg bg-lime py-2 text-xs font-bold text-[#081208] disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? "Salvataggio..." : "Salva risultato"}
          </button>
          {homeScore !== "" && awayScore !== "" && !resultIsValid && (
            <p className="mt-2 text-center text-[11px] text-[#FF9B6B]">Risultato non valido. Sono ammessi 2-0, 2-1, 1-2 e 0-2.</p>
          )}
        </div>
      )}

      {match.status === "conclusa" && canEditResults && correcting && (
        <div className="mb-2">
          <p className="text-[11px] text-[rgba(251,243,222,0.50)] mb-1.5">
            Risultato attuale: <strong className="text-[rgba(251,243,222,0.85)]">{match.result}</strong> — scegli il nuovo risultato
          </p>
          <div className="grid grid-cols-[1fr_64px_16px_64px_1fr] items-center gap-2">
            <span className="truncate text-right text-xs">{teamName(match.team1Id)}</span>
            <ScoreSelect label="Nuovo punteggio squadra di casa" value={homeScore} onChange={setHomeScore} />
            <span className="text-center">-</span>
            <ScoreSelect label="Nuovo punteggio squadra ospite" value={awayScore} onChange={setAwayScore} />
            <span className="truncate text-xs">{teamName(match.team2Id)}</span>
          </div>
          <button onClick={submitResult} disabled={saving || !resultIsValid} className="mt-2 w-full rounded-lg bg-lime py-2 text-xs font-bold text-[#081208] disabled:opacity-40">
            Conferma correzione
          </button>
        </div>
      )}

      {canEditResults && (
        <div className="flex items-center gap-3 flex-wrap">
          {match.status === "conclusa" && !correcting && (
            <button onClick={() => setCorrecting(true)} className="flex items-center gap-1 text-[11px] text-[#BBFF5E] font-semibold">
              <Pencil size={11} /> Correggi risultato
            </button>
          )}
          {match.status === "conclusa" && correcting && (
            <button onClick={() => setCorrecting(false)} className="text-[11px] text-[rgba(251,243,222,0.50)]">
              Annulla correzione
            </button>
          )}
          <div className="relative">
            <button onClick={() => setStatusMenuOpen((open) => !open)} aria-expanded={statusMenuOpen}
              className="rounded-lg border border-[rgba(251,243,222,0.16)] px-2.5 py-1.5 text-[11px] text-[rgba(251,243,222,0.72)]">
              Stato partita
            </button>
            {statusMenuOpen && (
              <div className="absolute bottom-full left-0 z-20 mb-2 min-w-36 rounded-lg border border-[rgba(251,243,222,0.16)] bg-[#081208] p-1 shadow-xl">
                {match.status !== "da_giocare" && <StatusAction label="Programmata / Riapri" onClick={() => { onSetStatus("da_giocare"); setStatusMenuOpen(false); }} />}
                {match.status !== "rinviata" && <StatusAction label="Rinviata" onClick={() => { onSetStatus("rinviata"); setStatusMenuOpen(false); }} />}
                {match.status !== "annullata" && <StatusAction label="Annullata" onClick={() => {
                  if (window.confirm("Annullare questa partita? Il risultato non sarà conteggiato.")) onSetStatus("annullata");
                  setStatusMenuOpen(false);
                }} />}
              </div>
            )}
          </div>
          {canDeleteMatches && (
            <button onClick={onRemove} className="text-[11px] text-[#FF6B6B] ml-auto flex items-center gap-1">
              <Trash2 size={11} /> Elimina
            </button>
          )}
          {canEditSchedule && !editingSchedule && (
            <button onClick={() => setEditingSchedule(true)} className="text-[11px] text-[#BBFF5E]">
              Modifica partita
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function BulkScoreSelectors({
  match,
  homeName,
  awayName,
  onValid,
  onInvalid,
}: {
  match: Match;
  homeName: string;
  awayName: string;
  onValid: (result: NonNullable<Match["result"]>) => void;
  onInvalid: () => void;
}) {
  const initial = match.result?.split("-").map(Number) ?? [];
  const [home, setHome] = useState<number | "">(initial[0] ?? "");
  const [away, setAway] = useState<number | "">(initial[1] ?? "");
  const update = (nextHome: number | "", nextAway: number | "") => {
    const result = `${nextHome}-${nextAway}`;
    if (RESULT_OPTIONS.includes(result as NonNullable<Match["result"]>)) onValid(result as NonNullable<Match["result"]>);
    else onInvalid();
  };
  return (
    <div className="mr-2 grid grid-cols-[64px_12px_64px] items-center gap-1">
      <ScoreSelect label={`Set vinti da ${homeName}`} value={home} onChange={(value) => { setHome(value); update(value, away); }} />
      <span className="text-center">-</span>
      <ScoreSelect label={`Set vinti da ${awayName}`} value={away} onChange={(value) => { setAway(value); update(home, value); }} />
    </div>
  );
}

function ScoreSelect({ label, value, onChange }: { label: string; value: number | ""; onChange: (value: number | "") => void }) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
      className="h-11 w-16 rounded-lg border border-[rgba(251,243,222,0.18)] bg-[#0A0B08] text-center text-lg font-bold text-[#FBF3DE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#BBFF5E]">
      <option value="">-</option>
      <option value="0">0</option>
      <option value="1">1</option>
      <option value="2">2</option>
    </select>
  );
}

function StatusAction({ label, onClick }: { label: string; onClick: () => void }) {
  return <button onClick={onClick} className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[rgba(251,243,222,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#BBFF5E]">{label}</button>;
}

function formatMatchSchedule(date?: string, time?: string) {
  const parts: string[] = [];
  if (date) {
    const parsed = new Date(`${date}T12:00:00`);
    parts.push(Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }));
  }
  if (time) parts.push(`ore ${time}`);
  return parts.join(" - ");
}
