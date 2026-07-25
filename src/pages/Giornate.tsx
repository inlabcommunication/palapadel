import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { addDoc, collection, where } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import { confirmDelete } from "../lib/confirmDelete";
import { findDuplicateTeamInMatchday, isSelfMatch } from "../lib/matchdayValidation";
import {
  saveMatchResult,
  setMatchStatus as apiSetMatchStatus,
  saveMatchdayBulk,
  createMatch,
  updateMatch,
  deleteMatch,
  createHomeNewsUpdate,
  MatchApiError,
  type ApiMatchStatus,
} from "../lib/matchApi";
import { derivePermissions } from "../lib/permissions";
import { MatchdayShareButton } from "../components/MatchdayShareButton";
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

  const { data: editions } = useCollection<ChampionshipEdition>("championshipEditions");
  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const { data: teams } = useCollection<Team>("teams");
  const { data: editionTeams } = useCollection<EditionTeam>(
    "editionTeams",
    editionId ? [where("editionId", "==", editionId)] : [],
    [editionId]
  );
  const { data: matchdays } = useCollection<Matchday>(
    "matchdays",
    editionId ? [where("editionId", "==", editionId)] : [],
    [editionId]
  );
  const { data: matches } = useCollection<Match>(
    "matches",
    editionId ? [where("editionId", "==", editionId)] : [],
    [editionId]
  );

  const [selectedMatchdayId, setSelectedMatchdayId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  if (!canEditResults) {
    return <div className="p-4 text-sm text-[rgba(251,243,222,0.58)]">Non hai i permessi per vedere questa pagina.</div>;
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
  const matchesFor = (matchdayId: string) => matches.filter((m) => m.matchdayId === matchdayId);
  const selectedMatchday = sortedMatchdays.find((m) => m.id === selectedMatchdayId);

  const createMatchday = async () => {
    const nextNumber = sortedMatchdays.length > 0 ? Math.max(...sortedMatchdays.map((m) => m.number)) + 1 : 1;
    try {
      const ref = await addDoc(collection(db, "matchdays"), { editionId, number: nextNumber });
      setSelectedMatchdayId(ref.id);
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
      <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE] mb-1">
        {type.name} {edition.season}
      </h2>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12.5px] text-[rgba(251,243,222,0.35)]">Giornate e risultati</p>
        <Link to={`/campionati/${edition.id}`} className="text-[12.5px] text-[#BBFF5E] font-semibold">
          Vedi classifica
        </Link>
      </div>

      {!selectedMatchday ? (
        <div>
          <div className="flex flex-col gap-2 mb-3">
            {sortedMatchdays.length === 0 && (
              <p className="text-[12.5px] text-[rgba(251,243,222,0.35)]">Nessuna giornata creata ancora.</p>
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
                  <p className="text-xs text-[rgba(251,243,222,0.35)] mt-1">
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
          editionTeams={editionTeams}
          editionId={editionId!}
          typeName={type.name}
          season={edition.season}
          perms={perms}
          onBack={() => setSelectedMatchdayId(null)}
          showToast={showToast}
        />
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
  editionTeams,
  editionId,
  typeName,
  season,
  perms,
  onBack,
  showToast,
}: {
  matchday: Matchday;
  matches: Match[];
  teams: Team[];
  editionTeams: EditionTeam[];
  editionId: string;
  typeName: string;
  season: string;
  perms: Perms;
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
        {canEditResults && matches.length > 0 && !bulkMode && (
          <button onClick={() => setBulkMode(true)} className="text-xs text-[#BBFF5E] font-semibold">
            Aggiorna intera giornata
          </button>
        )}
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
            <button onClick={() => setBulkReview(null)} className="w-full text-xs text-[rgba(251,243,222,0.35)]">
              Torna indietro
            </button>
          </div>
        </div>
      ) : bulkMode ? (
        <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5 mb-3">
          <p className="text-[13px] font-bold mb-3">Aggiorna intera giornata</p>
          {matches.length === 0 ? (
            <p className="text-[12.5px] text-[rgba(251,243,222,0.35)] mb-3">Nessuna partita in questa giornata.</p>
          ) : (
            <div className="flex flex-col gap-3 mb-3">
              {matches.map((m) => (
                <div key={m.id}>
                  <p className="text-[12.5px] font-semibold mb-1.5">
                    {teamName(m.team1Id)} vs {teamName(m.team2Id)}
                    <span className="text-[rgba(251,243,222,0.35)] font-normal"> · attuale: {currentChoiceLabel(m)}</span>
                  </p>
                  <div className="flex gap-1.5 mb-1 flex-wrap">
                    {RESULT_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setBulkChoices((p) => ({ ...p, [m.id]: { kind: "result", value: opt } }))}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                          bulkChoices[m.id]?.kind === "result" && bulkChoices[m.id]?.value === opt
                            ? "bg-lime text-[#081208]"
                            : "bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.85)]"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
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
              className="w-full text-xs text-[rgba(251,243,222,0.35)]"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-3">
          {matches.length === 0 && <p className="text-[12.5px] text-[rgba(251,243,222,0.35)]">Nessuna partita in questa giornata.</p>}
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
              onUpdateSchedule={async (date, time) => {
                try {
                  await updateMatch({ matchId: m.id, matchDate: date || null, matchTime: time || null });
                  showToast("Data e ora aggiornate.");
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
                  <X size={16} className="text-[rgba(251,243,222,0.35)]" />
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
  onUpdateSchedule: (date: string, time: string) => Promise<void>;
}) {
  // Fase 6: azione esplicita "Correggi risultato" su una partita già conclusa, invece
  // di dover prima riaprire e poi reinserire il risultato.
  const [correcting, setCorrecting] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [date, setDate] = useState(match.matchDate ?? "");
  const [time, setTime] = useState(match.matchTime ?? "");

  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-[13.5px] font-semibold truncate">
          {teamName(match.team1Id)} <span className="text-[rgba(251,243,222,0.35)]">vs</span> {teamName(match.team2Id)}
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
          <span className="flex items-center gap-1 text-[11px] text-[rgba(251,243,222,0.35)] shrink-0">
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
        <div className="mb-2 grid grid-cols-2 gap-2 rounded-lg bg-[#123008] p-2.5">
          <input aria-label="Data della partita" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-lg border border-[rgba(251,243,222,0.18)] px-2 py-2 text-xs" />
          <input aria-label="Ora della partita" type="time" value={time} onChange={(event) => setTime(event.target.value)} className="rounded-lg border border-[rgba(251,243,222,0.18)] px-2 py-2 text-xs" />
          <button onClick={async () => { await onUpdateSchedule(date, time); setEditingSchedule(false); }} className="rounded-lg bg-lime py-2 text-xs font-bold text-[#081208]">Salva</button>
          <button onClick={() => setEditingSchedule(false)} className="rounded-lg border border-[rgba(251,243,222,0.18)] py-2 text-xs">Annulla</button>
        </div>
      )}

      {match.status === "da_giocare" && canEditResults && (
        <div className="flex gap-1.5 mb-2">
          {RESULT_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => onSaveResult(opt)}
              disabled={saving}
              className="flex-1 rounded-lg py-1.5 text-xs font-bold bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.85)] disabled:opacity-50"
            >
              {saving ? "..." : opt}
            </button>
          ))}
        </div>
      )}

      {match.status === "conclusa" && canEditResults && correcting && (
        <div className="mb-2">
          <p className="text-[11px] text-[rgba(251,243,222,0.35)] mb-1.5">
            Risultato attuale: <strong className="text-[rgba(251,243,222,0.85)]">{match.result}</strong> — scegli il nuovo risultato
          </p>
          <div className="flex gap-1.5">
            {RESULT_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onSaveResult(opt);
                  setCorrecting(false);
                }}
                disabled={saving}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold disabled:opacity-50 ${
                  opt === match.result ? "bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.35)]" : "bg-lime text-[#081208]"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {canEditResults && (
        <div className="flex items-center gap-3 flex-wrap">
          {match.status === "da_giocare" && (
            <button onClick={() => onSetStatus("rinviata")} className="text-[11px] text-[rgba(251,243,222,0.35)]">
              Rinvia
            </button>
          )}
          {match.status === "conclusa" && !correcting && (
            <button onClick={() => setCorrecting(true)} className="flex items-center gap-1 text-[11px] text-[#BBFF5E] font-semibold">
              <Pencil size={11} /> Correggi risultato
            </button>
          )}
          {match.status === "conclusa" && correcting && (
            <button onClick={() => setCorrecting(false)} className="text-[11px] text-[rgba(251,243,222,0.35)]">
              Annulla correzione
            </button>
          )}
          {match.status !== "da_giocare" && (
            <button onClick={() => onSetStatus("da_giocare")} className="text-[11px] text-[rgba(251,243,222,0.35)]">
              Riapri
            </button>
          )}
          {match.status !== "annullata" && (
            <button onClick={() => onSetStatus("annullata")} className="text-[11px] text-[rgba(251,243,222,0.35)]">
              Annulla partita
            </button>
          )}
          {canDeleteMatches && (
            <button onClick={onRemove} className="text-[11px] text-[#FF6B6B] ml-auto flex items-center gap-1">
              <Trash2 size={11} /> Elimina
            </button>
          )}
          {canEditSchedule && !editingSchedule && (
            <button onClick={() => setEditingSchedule(true)} className="text-[11px] text-[#BBFF5E]">
              Data e ora
            </button>
          )}
        </div>
      )}
    </div>
  );
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
