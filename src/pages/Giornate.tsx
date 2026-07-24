import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { addDoc, collection, deleteDoc, deleteField, doc, updateDoc, where } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import { confirmDelete } from "../lib/confirmDelete";
import { recalcStandingsFromMatches } from "../lib/recalcStandingsFromMatches";
import type { ChampionshipEdition, ChampionshipType, EditionTeam, Team, Matchday, Match, MatchStatus } from "../types";
import { ArrowLeft, Plus, Clock, Ban, Trash2, X } from "lucide-react";

const RESULT_OPTIONS: NonNullable<Match["result"]>[] = ["2-0", "2-1", "1-2", "0-2"];

export function GiornatePage() {
  const { editionId } = useParams();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";
  const canManage = isAdmin || appUser?.role === "gestore";

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
    setTimeout(() => setToast(null), 2500);
  };

  if (!canManage) {
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
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "Squadra eliminata";
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
          {isAdmin && (
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
          canManage={canManage}
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

function MatchdayDetail({
  matchday,
  matches,
  teams,
  editionTeams,
  editionId,
  typeName,
  season,
  canManage,
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
  canManage: boolean;
  onBack: () => void;
  showToast: (msg: string) => void;
}) {
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [team1Id, setTeam1Id] = useState("");
  const [team2Id, setTeam2Id] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkResults, setBulkResults] = useState<Record<string, string>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [pendingNotify, setPendingNotify] = useState<Match | null>(null);
  const [justCompleted, setJustCompleted] = useState<Match[] | null>(null);
  const [perMatchChoices, setPerMatchChoices] = useState<Record<string, boolean>>({});

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "Squadra eliminata";
  const missingMatches = matches.filter((m) => m.status === "da_giocare");

  const runRecalc = async () => {
    await recalcStandingsFromMatches(
      editionId,
      editionTeams.map((et) => ({ id: et.id, teamId: et.teamId, manualPointsAdjustment: et.manualPointsAdjustment }))
    );
  };

  /**
   * Le notifiche push vere (service worker + VAPID keys) arrivano in Fase 5 — vedi
   * src/pages/Notifiche.tsx. Fino ad allora, il modo reale per far arrivare un risultato
   * agli utenti è pubblicare una novità in Home: qui se ne crea una in bozza, così
   * l'amministratore la rivede e la pubblica (o la corregge) prima che diventi visibile.
   */
  const sendNotification = async (matchesToNotify: Match[]) => {
    if (matchesToNotify.length === 0) return;
    const lines = matchesToNotify.map((m) => `${teamName(m.team1Id)} ${m.result} ${teamName(m.team2Id)}`).join("\n");
    const title =
      matchesToNotify.length === 1 ? `Risultato — ${typeName}` : `Risultati ${matchday.number}ª giornata — ${typeName}`;
    await addDoc(collection(db, "homeNews"), {
      title,
      body: `${typeName} ${season}, ${matchday.number}ª giornata:\n${lines}`,
      date: new Date().toISOString(),
      status: "bozza",
    });
    for (const m of matchesToNotify) {
      await updateDoc(doc(db, "matches", m.id), { notifiedAt: new Date().toISOString() });
    }
  };

  const addMatch = async () => {
    if (!team1Id || !team2Id || team1Id === team2Id) return;
    try {
      await addDoc(collection(db, "matches"), {
        matchdayId: matchday.id,
        editionId,
        team1Id,
        team2Id,
        status: "da_giocare",
      });
      setShowAddMatch(false);
      setTeam1Id("");
      setTeam2Id("");
      showToast("Partita aggiunta.");
    } catch (err) {
      console.error(err);
      showToast("Errore nell'aggiunta.");
    }
  };

  const removeMatch = async (m: Match) => {
    if (!confirmDelete(`${teamName(m.team1Id)} vs ${teamName(m.team2Id)}`)) return;
    try {
      await deleteDoc(doc(db, "matches", m.id));
      await runRecalc();
      showToast("Partita eliminata.");
    } catch (err) {
      console.error(err);
      showToast("Errore nell'eliminazione.");
    }
  };

  const saveSingleResult = async (match: Match, result: string) => {
    try {
      await updateDoc(doc(db, "matches", match.id), { result, status: "conclusa" });
      await runRecalc();
      setPendingNotify({ ...match, result: result as Match["result"], status: "conclusa" });
    } catch (err) {
      console.error(err);
      showToast("Errore nel salvataggio.");
    }
  };

  const respondNotify = async (send: boolean) => {
    if (!pendingNotify) return;
    try {
      if (send) {
        await sendNotification([pendingNotify]);
        showToast("Risultato salvato e notifica creata come bozza su Home.");
      } else {
        showToast("Risultato salvato.");
      }
    } catch (err) {
      console.error(err);
      showToast("Risultato salvato, ma la notifica non è andata a buon fine.");
    } finally {
      setPendingNotify(null);
    }
  };

  const setMatchStatus = async (match: Match, status: MatchStatus) => {
    try {
      await updateDoc(
        doc(db, "matches", match.id),
        status === "da_giocare" ? { status, result: deleteField() } : { status }
      );
      await runRecalc();
      showToast("Stato aggiornato.");
    } catch (err) {
      console.error(err);
      showToast("Errore nell'aggiornamento.");
    }
  };

  const saveBulk = async (mode: "none" | "single" | "perMatch") => {
    setBulkSaving(true);
    try {
      const completed: Match[] = [];
      for (const m of missingMatches) {
        const result = bulkResults[m.id];
        if (!result) continue;
        await updateDoc(doc(db, "matches", m.id), { result, status: "conclusa" });
        completed.push({ ...m, result: result as Match["result"], status: "conclusa" });
      }
      if (completed.length === 0) {
        showToast("Nessun risultato inserito.");
        return;
      }
      await runRecalc();
      if (mode === "none") {
        showToast(`${completed.length} risultati salvati senza notifiche.`);
        setBulkMode(false);
        setBulkResults({});
      } else if (mode === "single") {
        await sendNotification(completed);
        showToast(`${completed.length} risultati salvati e notifica inviata (in bozza su Home).`);
        setBulkMode(false);
        setBulkResults({});
      } else {
        setJustCompleted(completed);
        setPerMatchChoices(Object.fromEntries(completed.map((m) => [m.id, true])));
      }
    } catch (err) {
      console.error(err);
      showToast("Errore nel salvataggio.");
    } finally {
      setBulkSaving(false);
    }
  };

  const confirmPerMatchNotifications = async () => {
    if (!justCompleted) return;
    const toNotify = justCompleted.filter((m) => perMatchChoices[m.id]);
    try {
      for (const m of toNotify) {
        await sendNotification([m]);
      }
      showToast(`Fatto. ${toNotify.length} notifiche create come bozza.`);
    } catch (err) {
      console.error(err);
      showToast("Errore nell'invio delle notifiche.");
    } finally {
      setJustCompleted(null);
      setBulkMode(false);
      setBulkResults({});
    }
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-[rgba(251,243,222,0.58)] mb-3">
        <ArrowLeft size={13} /> Tutte le giornate
      </button>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE]">{matchday.number}ª giornata</h3>
        {canManage && missingMatches.length > 0 && !bulkMode && (
          <button onClick={() => setBulkMode(true)} className="text-xs text-[#BBFF5E] font-semibold">
            Aggiorna intera giornata
          </button>
        )}
      </div>

      {pendingNotify && (
        <div className="bg-[#123008] border border-[rgba(251,243,222,0.18)] rounded-2xl p-3.5 mb-3">
          <p className="text-[13px] font-semibold mb-2">
            {teamName(pendingNotify.team1Id)} {pendingNotify.result} {teamName(pendingNotify.team2Id)}
          </p>
          <p className="text-[12.5px] text-[rgba(251,243,222,0.58)] mb-2">Vuoi inviare una notifica per questo risultato?</p>
          <div className="flex gap-2">
            <button onClick={() => respondNotify(true)} className="flex-1 bg-lime text-[#081208] rounded-lg py-2 text-sm font-bold">
              Sì, invia
            </button>
            <button onClick={() => respondNotify(false)} className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2 text-sm font-semibold">
              No
            </button>
          </div>
        </div>
      )}

      {justCompleted && (
        <div className="bg-[#123008] border border-[rgba(251,243,222,0.18)] rounded-2xl p-3.5 mb-3">
          <p className="text-[13px] font-semibold mb-2">Scegli per quali risultati inviare la notifica</p>
          <div className="flex flex-col gap-2 mb-3">
            {justCompleted.map((m) => (
              <label key={m.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span>
                  {teamName(m.team1Id)} {m.result} {teamName(m.team2Id)}
                </span>
                <input
                  type="checkbox"
                  checked={perMatchChoices[m.id] ?? false}
                  onChange={(e) => setPerMatchChoices((p) => ({ ...p, [m.id]: e.target.checked }))}
                />
              </label>
            ))}
          </div>
          <button onClick={confirmPerMatchNotifications} className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold">
            Conferma invii
          </button>
        </div>
      )}

      {bulkMode ? (
        <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5 mb-3">
          <p className="text-[13px] font-bold mb-3">Aggiorna intera giornata</p>
          {missingMatches.length === 0 ? (
            <p className="text-[12.5px] text-[rgba(251,243,222,0.35)] mb-3">Nessun risultato mancante in questa giornata.</p>
          ) : (
            <div className="flex flex-col gap-3 mb-3">
              {missingMatches.map((m) => (
                <div key={m.id}>
                  <p className="text-[12.5px] font-semibold mb-1.5">
                    {teamName(m.team1Id)} vs {teamName(m.team2Id)}
                  </p>
                  <div className="flex gap-1.5">
                    {RESULT_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setBulkResults((p) => ({ ...p, [m.id]: opt }))}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${
                          bulkResults[m.id] === opt ? "bg-lime text-[#081208]" : "bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.85)]"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => saveBulk("none")}
              disabled={bulkSaving}
              className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              Salva senza notifiche
            </button>
            <button
              onClick={() => saveBulk("single")}
              disabled={bulkSaving}
              className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
            >
              Invia una notifica unica
            </button>
            <button
              onClick={() => saveBulk("perMatch")}
              disabled={bulkSaving}
              className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              Scegli partita per partita
            </button>
            <button
              onClick={() => {
                setBulkMode(false);
                setBulkResults({});
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
              canManage={canManage}
              onSaveResult={saveSingleResult}
              onRemove={removeMatch}
              onSetStatus={(status) => setMatchStatus(m, status)}
            />
          ))}
        </div>
      )}

      {canManage && !bulkMode && (
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
  canManage,
  onSaveResult,
  onRemove,
  onSetStatus,
}: {
  match: Match;
  teamName: (id: string) => string;
  canManage: boolean;
  onSaveResult: (match: Match, result: string) => void;
  onRemove: (match: Match) => void;
  onSetStatus: (status: MatchStatus) => void;
}) {
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
      {match.status === "da_giocare" && canManage && (
        <div className="flex gap-1.5 mb-2">
          {RESULT_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => onSaveResult(match, opt)}
              className="flex-1 rounded-lg py-1.5 text-xs font-bold bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.85)]"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      {canManage && (
        <div className="flex items-center gap-3">
          {match.status === "da_giocare" && (
            <button onClick={() => onSetStatus("rinviata")} className="text-[11px] text-[rgba(251,243,222,0.35)]">
              Rinvia
            </button>
          )}
          {match.status !== "da_giocare" && (
            <button onClick={() => onSetStatus("da_giocare")} className="text-[11px] text-[rgba(251,243,222,0.35)]">
              Riapri
            </button>
          )}
          {match.status !== "annullata" && (
            <button onClick={() => onSetStatus("annullata")} className="text-[11px] text-[rgba(251,243,222,0.35)]">
              Annulla
            </button>
          )}
          <button onClick={() => onRemove(match)} className="text-[11px] text-[#FF6B6B] ml-auto flex items-center gap-1">
            <Trash2 size={11} /> Elimina
          </button>
        </div>
      )}
    </div>
  );
}
