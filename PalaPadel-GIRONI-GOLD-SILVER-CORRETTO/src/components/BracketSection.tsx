import { useState } from "react";
import { where } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { confirmDelete } from "../lib/confirmDelete";
import type { BracketMatch, BracketRound, ChampionshipEdition, Team } from "../types";
import { Plus, X, Pencil, Trash2, ChevronUp, ChevronDown, Trophy, Wand2 } from "lucide-react";
import {
  createBracketMatch,
  createBracketRound,
  deleteBracketMatch,
  deleteBracketRound,
  generateBracketRound,
  moveBracketRound,
  renameBracketRound,
  toggleBracket as toggleBracketViaApi,
  updateBracketMatch,
  type BracketMatchFields,
} from "../lib/bracketAdminApi";
import { resolveActiveBracketRoundId } from "../lib/activeBracketRound";


export function BracketSection({
  edition,
  isAdmin,
  showToast,
}: {
  edition: ChampionshipEdition;
  isAdmin: boolean;
  showToast: (msg: string) => void;
}) {
  const { data: rounds } = useCollection<BracketRound>(
    "bracketRounds",
    [where("editionId", "==", edition.id)],
    [edition.id]
  );
  const { data: allMatches } = useCollection<BracketMatch>(
    "bracketMatches",
    [where("editionId", "==", edition.id)],
    [edition.id]
  );
  const { data: teams } = useCollection<Team>("teams");
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [selectedFrozenRoundIndex, setSelectedFrozenRoundIndex] = useState<number | null>(null);
  const [showNewRound, setShowNewRound] = useState(false);
  const [showLive, setShowLive] = useState(false);

  const isFrozen = edition.status === "conclusa" && !!edition.frozenBracket;

  const sortedRounds = [...rounds].sort((a, b) => a.order - b.order);
  const automaticRoundId = resolveActiveBracketRoundId(sortedRounds, allMatches);
  const selectedRound = sortedRounds.find((r) => r.id === (selectedRoundId ?? automaticRoundId)) ?? sortedRounds[0];
  const selectedRoundIndex = selectedRound ? sortedRounds.findIndex((r) => r.id === selectedRound.id) : -1;
  const nextRound = selectedRoundIndex >= 0 ? sortedRounds[selectedRoundIndex + 1] : undefined;

  const toggleBracket = async (enabled: boolean) => {
    try {
      await toggleBracketViaApi(edition.id, enabled);
      showToast(enabled ? "Tabellone attivato." : "Tabellone disattivato.");
    } catch (err) {
      console.error(err);
      showToast("Errore nell'operazione.");
    }
  };

  if (isFrozen && !showLive) {
    const frozenRounds = edition.frozenBracket!;
    const frozenRoundIndex = selectedFrozenRoundIndex ?? Math.max(0, frozenRounds.length - 1);
    const frozenRound = frozenRounds[frozenRoundIndex];
    return (
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE] flex items-center gap-1.5">
            <Trophy size={15} /> Tabellone finale
          </h3>
          {isAdmin && (
            <button onClick={() => setShowLive(true)} className="text-xs text-[rgba(251,243,222,0.50)] flex items-center gap-1">
              Correggi e ricongela
            </button>
          )}
        </div>
        {frozenRounds.length > 0 && (
          <div className="relative mb-3">
            <label htmlFor={`frozen-bracket-round-${edition.id}`} className="mb-1.5 block text-[11px] font-bold uppercase text-[rgba(251,243,222,0.50)]">
              Fase visualizzata
            </label>
            <select
              id={`frozen-bracket-round-${edition.id}`}
              value={frozenRoundIndex}
              onChange={(event) => setSelectedFrozenRoundIndex(Number(event.target.value))}
              className="w-full appearance-none rounded-lg border border-[rgba(251,243,222,0.16)] bg-[#0A0B08] px-3 py-3 pr-10 text-sm font-bold text-[#FBF3DE]"
            >
              {frozenRounds.map((round, index) => <option key={`${round.name}-${index}`} value={index}>{round.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute bottom-3.5 right-3 text-[#BBFF5E]" size={16} />
          </div>
        )}
        <div className="flex flex-col gap-4">
          {frozenRound && (
            <div key={frozenRound.name}>
              <p className="text-[12.5px] font-semibold text-[rgba(251,243,222,0.58)] mb-2">{frozenRound.name}</p>
              <div className="flex flex-col gap-2">
                {frozenRound.matches.length === 0 && (
                  <p className="text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessun incontro in questo turno.</p>
                )}
                {frozenRound.matches.map((m, idx) => (
                  <div key={idx} className="grid grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] items-center bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5">
                    <div className={`min-w-0 rounded-lg px-2 py-2 text-left ${m.winnerSide === 1 ? "bg-[rgba(187,255,94,0.08)]" : ""}`}>
                      <span className={`block whitespace-normal break-words text-[13.5px] leading-snug ${m.winnerSide === 1 ? "font-bold text-[#BBFF5E]" : ""}`}>
                        {m.team1Name ?? "— vuoto —"}
                      </span>
                      {m.winnerSide === 1 && <p className="mt-1 text-[9px] font-extrabold uppercase text-[#BBFF5E]">Vincitore</p>}
                    </div>
                    <div className="flex items-center justify-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[rgba(251,243,222,0.3)]">vs</span>
                    </div>
                    <div className={`min-w-0 rounded-lg px-2 py-2 text-right ${m.winnerSide === 2 ? "bg-[rgba(187,255,94,0.08)]" : ""}`}>
                      <span className={`block whitespace-normal break-words text-[13.5px] leading-snug ${m.winnerSide === 2 ? "font-bold text-[#BBFF5E]" : ""}`}>
                        {m.team2Name ?? "— vuoto —"}
                      </span>
                      {m.winnerSide === 2 && <p className="mt-1 text-[9px] font-extrabold uppercase text-[#BBFF5E]">Vincitore</p>}
                    </div>
                    {m.score && <p className="col-span-3 font-display text-[15px] tracking-wide text-[#FBF3DE] text-center mt-2">{m.score}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!edition.bracketEnabled) {
    if (!isAdmin) return null;
    return (
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE] flex items-center gap-1.5">
            <Trophy size={15} /> Tabellone finale
          </h3>
        </div>
        <button
          onClick={() => toggleBracket(true)}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-[#BBFF5E]"
        >
          <Plus size={15} /> Attiva tabellone per questa edizione
        </button>
      </div>
    );
  }

  const createRound = async (name: string) => {
    if (!name.trim()) return;
    try {
      const nextOrder = sortedRounds.length > 0 ? Math.max(...sortedRounds.map((r) => r.order)) + 1 : 0;
      const response = await createBracketRound(edition.id, name.trim(), nextOrder);
      setSelectedRoundId(response.id);
      setShowNewRound(false);
      showToast("Turno creato.");
    } catch (err) {
      console.error(err);
      showToast("Errore nella creazione del turno.");
    }
  };

  const moveRound = async (round: BracketRound, direction: -1 | 1) => {
    const idx = sortedRounds.findIndex((r) => r.id === round.id);
    const swapWith = sortedRounds[idx + direction];
    if (!swapWith) return;
    try {
      await moveBracketRound(edition.id, round.id, swapWith.order, swapWith.id, round.order);
    } catch (err) {
      console.error(err);
      showToast("Errore nello spostamento.");
    }
  };

  const renameRound = async (round: BracketRound, name: string) => {
    if (!name.trim()) return;
    try {
      await renameBracketRound(edition.id, round.id, name.trim());
      showToast("Turno rinominato.");
    } catch (err) {
      console.error(err);
      showToast("Errore nel salvataggio.");
    }
  };

  const removeRound = async (round: BracketRound) => {
    if (!confirmDelete(round.name)) return;
    try {
      await deleteBracketRound(edition.id, round.id);
      if (selectedRoundId === round.id) setSelectedRoundId(null);
      showToast("Turno eliminato (gli incontri al suo interno restano ma non sono più visibili: eliminali se non servono più).");
    } catch (err) {
      console.error(err);
      showToast("Errore nell'eliminazione.");
    }
  };

  const generateNextRound = async () => {
    if (!selectedRound || !nextRound) return;
    const currentMatches = allMatches
      .filter((m) => m.roundId === selectedRound.id)
      .sort((a, b) => a.order - b.order);
    const nextRoundMatches = allMatches.filter((m) => m.roundId === nextRound.id);

    if (currentMatches.length === 0) {
      showToast(`Nessun incontro in "${selectedRound.name}" da cui generare il turno successivo.`);
      return;
    }
    if (nextRoundMatches.length > 0) {
      const proceed = window.confirm(
        `"${nextRound.name}" contiene già ${nextRoundMatches.length} incontro/i. Vuoi eliminarli e rigenerarli dai vincitori di "${selectedRound.name}"?`
      );
      if (!proceed) return;
    }
    const missingWinners = currentMatches.filter((m) => !m.winnerTeamId).length;
    if (missingWinners > 0) {
      const proceed = window.confirm(
        `${missingWinners} incontro/i di "${selectedRound.name}" non hanno ancora un vincitore assegnato: quegli slot resteranno vuoti nel turno successivo. Continuare comunque?`
      );
      if (!proceed) return;
    }

    try {
      const generated = [];
      let order = 0;
      for (let i = 0; i < currentMatches.length; i += 2) {
        const winnerA = currentMatches[i]?.winnerTeamId;
        const winnerB = currentMatches[i + 1]?.winnerTeamId;
        generated.push({
          order: order++,
          team1SourceMatchId: currentMatches[i]?.id ?? null,
          team2SourceMatchId: currentMatches[i + 1]?.id ?? null,
          ...(winnerA ? { team1Id: winnerA } : {}),
          ...(winnerB ? { team2Id: winnerB } : {}),
        });
      }
      await generateBracketRound(edition.id, nextRound.id, generated);
      setSelectedRoundId(nextRound.id);
      showToast(`"${nextRound.name}" generato automaticamente dai vincitori di "${selectedRound.name}".`);
    } catch (err) {
      console.error(err);
      showToast("Errore nella generazione automatica.");
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE] flex items-center gap-1.5">
          <Trophy size={15} /> Tabellone finale
        </h3>
        <div className="flex items-center gap-3">
          {isFrozen && isAdmin && (
            <button onClick={() => setShowLive(false)} className="text-xs text-[#BBFF5E] font-semibold">
              Torna al tabellone congelato
            </button>
          )}
          {isAdmin && (
            <button onClick={() => toggleBracket(false)} className="text-xs text-[rgba(251,243,222,0.50)]">
              Disattiva
            </button>
          )}
        </div>
      </div>

      {sortedRounds.length === 0 ? (
        <p className="text-[12.5px] text-[rgba(251,243,222,0.50)] mb-2">Nessun turno creato ancora.</p>
      ) : (
        <div className="relative mb-3">
          <label htmlFor={`bracket-round-${edition.id}`} className="mb-1.5 block text-[11px] font-bold uppercase text-[rgba(251,243,222,0.50)]">
            Fase visualizzata
          </label>
          <select
            id={`bracket-round-${edition.id}`}
            value={selectedRound?.id ?? ""}
            onChange={(event) => setSelectedRoundId(event.target.value)}
            className="w-full appearance-none rounded-lg border border-[rgba(251,243,222,0.16)] bg-[#0A0B08] px-3 py-3 pr-10 text-sm font-bold text-[#FBF3DE]"
          >
            {sortedRounds.map((round) => <option key={round.id} value={round.id}>{round.name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute bottom-3.5 right-3 text-[#BBFF5E]" size={16} />
        </div>
      )}

      {isAdmin && (
        <div className="mb-3 flex flex-col gap-2 items-start">
          {showNewRound ? (
            <NewRoundForm onCreate={createRound} onCancel={() => setShowNewRound(false)} />
          ) : (
            <button onClick={() => setShowNewRound(true)} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#BBFF5E]">
              <Plus size={15} /> Nuovo turno
            </button>
          )}
          {nextRound && (
            <button
              onClick={generateNextRound}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-[#BBFF5E]"
            >
              <Wand2 size={15} /> Genera "{nextRound.name}" dai vincitori di "{selectedRound?.name}"
            </button>
          )}
        </div>
      )}

      {selectedRound && (
        <RoundDetail
          round={selectedRound}
          matches={allMatches.filter((m) => m.roundId === selectedRound.id)}
          canMoveUp={sortedRounds.findIndex((r) => r.id === selectedRound.id) > 0}
          canMoveDown={sortedRounds.findIndex((r) => r.id === selectedRound.id) < sortedRounds.length - 1}
          onMove={(dir) => moveRound(selectedRound, dir)}
          onRename={(name) => renameRound(selectedRound, name)}
          onRemove={() => removeRound(selectedRound)}
          teams={teams}
          allMatches={allMatches}
          rounds={sortedRounds}
          isAdmin={isAdmin}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function NewRoundForm({ onCreate, onCancel }: { onCreate: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const presets = ["Qualificazioni", "Sedicesimi", "Ottavi", "Quarti", "Semifinale", "Finale"];
  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold">Nuovo turno</p>
        <button onClick={onCancel}><X size={16} className="text-[rgba(251,243,222,0.50)]" /></button>
      </div>
      <p className="mb-2 text-[11px] font-bold uppercase text-[rgba(251,243,222,0.55)]">Seleziona turno</p>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setName(preset)}
            className={`rounded-lg px-2 py-2.5 text-xs font-bold ${
              name === preset ? "bg-lime text-[#081208]" : "bg-[rgba(251,243,222,0.08)] text-[#FBF3DE]"
            }`}
          >
            {preset}
          </button>
        ))}
      </div>
      <label className="mb-1 block text-[11px] font-bold uppercase text-[rgba(251,243,222,0.55)]" htmlFor="custom-round-name">
        Oppure inserisci manualmente
      </label>
      <input
        id="custom-round-name"
        placeholder="Es. Spareggio"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <button
        onClick={() => onCreate(name)}
        disabled={!name.trim()}
        className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
      >
        Crea turno
      </button>
    </div>
  );
}

function RoundDetail({
  round,
  matches,
  canMoveUp,
  canMoveDown,
  onMove,
  onRename,
  onRemove,
  teams,
  allMatches,
  rounds,
  isAdmin,
  showToast,
}: {
  round: BracketRound;
  matches: BracketMatch[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  teams: Team[];
  allMatches: BracketMatch[];
  rounds: BracketRound[];
  isAdmin: boolean;
  showToast: (msg: string) => void;
}) {
  const [editingRoundName, setEditingRoundName] = useState(false);
  const [nameDraft, setNameDraft] = useState(round.name);
  const [showNewMatch, setShowNewMatch] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

  const sortedMatches = [...matches].sort((a, b) => a.order - b.order);
  const roundOrder = rounds.find((item) => item.id === round.id)?.order ?? 0;
  const sourceOptions = rounds
    .filter((item) => item.order < roundOrder)
    .flatMap((sourceRound) =>
      allMatches
        .filter((match) => match.roundId === sourceRound.id)
        .sort((a, b) => a.order - b.order)
        .map((match, index) => ({ matchId: match.id, label: `Vincente ${sourceRound.name} ${index + 1}` }))
    );
  const sourceLabel = (id?: string) => sourceOptions.find((option) => option.matchId === id)?.label;

  const teamName = (id?: string) => (id ? teams.find((t) => t.id === id)?.name ?? "Squadra eliminata" : "— vuoto —");

  const createMatch = async (fields: BracketMatchFields) => {
    try {
      const nextOrder = sortedMatches.length > 0 ? Math.max(...sortedMatches.map((m) => m.order)) + 1 : 0;
      await createBracketMatch(round.editionId, round.id, nextOrder, fields);
      setShowNewMatch(false);
      showToast("Incontro aggiunto.");
    } catch (err) {
      console.error(err);
      showToast("Errore nell'aggiunta.");
    }
  };

  const removeMatch = async (match: BracketMatch) => {
    if (!confirmDelete(`${teamName(match.team1Id)} vs ${teamName(match.team2Id)}`)) return;
    try {
      await deleteBracketMatch(round.editionId, match.id);
      showToast("Incontro eliminato.");
    } catch (err) {
      console.error(err);
      showToast("Errore nell'eliminazione.");
    }
  };

  const setWinner = async (match: BracketMatch, winnerTeamId: string) => {
    try {
      await updateBracketMatch(match.editionId, match.id, { winnerTeamId: winnerTeamId || null });
      showToast(winnerTeamId ? "Vincitore dell'incontro aggiornato." : "Vincitore rimosso.");
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Errore nel salvataggio del vincitore.");
    }
  };

  return (
    <div>
      {isAdmin && (
        <div className="flex items-center justify-between mb-3 bg-[#123008] rounded-lg p-2">
          {editingRoundName ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg px-2 py-1.5 text-[13px]"
              />
              <button
                onClick={() => {
                  onRename(nameDraft);
                  setEditingRoundName(false);
                }}
                className="text-[#BBFF5E] text-xs font-semibold"
              >
                Salva
              </button>
            </div>
          ) : (
            <>
              <span className="text-[12.5px] font-semibold">Turno: {round.name}</span>
              <div className="flex items-center gap-3">
                <button onClick={() => onMove(-1)} disabled={!canMoveUp} className="disabled:opacity-30">
                  <ChevronUp size={15} />
                </button>
                <button onClick={() => onMove(1)} disabled={!canMoveDown} className="disabled:opacity-30">
                  <ChevronDown size={15} />
                </button>
                <button onClick={() => setEditingRoundName(true)} className="text-[#BBFF5E]">
                  <Pencil size={14} />
                </button>
                <button onClick={onRemove} className="text-[#FF6B6B]">
                  <Trash2 size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {sortedMatches.length === 0 && (
          <p className="text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessun incontro in questo turno ancora.</p>
        )}
        {sortedMatches.map((m) =>
          editingMatchId === m.id ? (
            <EditMatchForm
              key={m.id}
              match={m}
              teams={teams}
              sourceOptions={sourceOptions}
              onCancel={() => setEditingMatchId(null)}
              onDone={(msg) => {
                showToast(msg);
                setEditingMatchId(null);
              }}
            />
          ) : (
            <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] items-center bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5">
              <div className={`min-w-0 rounded-lg px-2 py-2 text-left ${m.winnerTeamId && m.winnerTeamId === m.team1Id ? "bg-[rgba(187,255,94,0.08)]" : ""}`}>
                <span className={`block whitespace-normal break-words text-[13.5px] leading-snug ${m.winnerTeamId && m.winnerTeamId === m.team1Id ? "font-bold text-[#BBFF5E]" : ""}`}>
                  {m.team1Id ? teamName(m.team1Id) : sourceLabel(m.team1SourceMatchId) ?? teamName()}
                </span>
                {!!m.winnerTeamId && m.winnerTeamId === m.team1Id && <p className="mt-1 text-[9px] font-extrabold uppercase text-[#BBFF5E]">Vincitore</p>}
              </div>
              <div className="flex items-center justify-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[rgba(251,243,222,0.3)]">vs</span>
              </div>
              <div className={`min-w-0 rounded-lg px-2 py-2 text-right ${m.winnerTeamId && m.winnerTeamId === m.team2Id ? "bg-[rgba(187,255,94,0.08)]" : ""}`}>
                <span className={`block whitespace-normal break-words text-[13.5px] leading-snug ${m.winnerTeamId && m.winnerTeamId === m.team2Id ? "font-bold text-[#BBFF5E]" : ""}`}>
                  {m.team2Id ? teamName(m.team2Id) : sourceLabel(m.team2SourceMatchId) ?? teamName()}
                </span>
                {!!m.winnerTeamId && m.winnerTeamId === m.team2Id && <p className="mt-1 text-[9px] font-extrabold uppercase text-[#BBFF5E]">Vincitore</p>}
              </div>
              {m.score && <p className="col-span-3 font-display text-[15px] tracking-wide text-[#FBF3DE] text-center mt-2">{m.score}</p>}
              {isAdmin && (
                <div className="col-span-3 mt-3 border-t border-[rgba(251,243,222,0.08)] pt-3">
                  <label className="mb-1 block text-[11px] font-bold uppercase text-[rgba(251,243,222,0.55)]" htmlFor={`winner-${m.id}`}>
                    Vincitore incontro
                  </label>
                  <select
                    id={`winner-${m.id}`}
                    value={m.winnerTeamId ?? ""}
                    onChange={(event) => void setWinner(m, event.target.value)}
                    className="mb-3 w-full rounded-lg border border-[rgba(251,243,222,0.18)] bg-[#0A0B08] px-3 py-2 text-[13px]"
                  >
                    <option value="">Non ancora deciso</option>
                    {m.team1Id && <option value={m.team1Id}>{teamName(m.team1Id)}</option>}
                    {m.team2Id && <option value={m.team2Id}>{teamName(m.team2Id)}</option>}
                  </select>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEditingMatchId(m.id)} className="flex items-center gap-1 text-[#BBFF5E] text-xs font-semibold">
                      <Pencil size={12} /> Modifica
                    </button>
                    <button onClick={() => removeMatch(m)} className="flex items-center gap-1 text-[#FF6B6B] text-xs font-semibold">
                      <Trash2 size={12} /> Elimina
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {round.name.trim().toLowerCase() === "finale" && sortedMatches.some((match) => match.winnerTeamId) && (
        <div className="mt-4 rounded-2xl border border-[#BBFF5E] bg-[rgba(187,255,94,0.10)] px-5 py-6 text-center">
          <Trophy className="mx-auto mb-2 text-[#BBFF5E]" size={30} />
          <p className="text-[11px] font-extrabold uppercase text-[#BBFF5E]">Vincitore</p>
          <p className="mt-1 font-display text-3xl text-[#FBF3DE]">{teamName(sortedMatches.find((match) => match.winnerTeamId)?.winnerTeamId)}</p>
        </div>
      )}

      {isAdmin && (
        <div className="mt-3">
          {showNewMatch ? (
            <NewMatchForm teams={teams} sourceOptions={sourceOptions} onCreate={createMatch} onCancel={() => setShowNewMatch(false)} />
          ) : (
            <button onClick={() => setShowNewMatch(true)} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#BBFF5E]">
              <Plus size={15} /> Aggiungi incontro
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function NewMatchForm({
  teams,
  sourceOptions,
  onCreate,
  onCancel,
}: {
  teams: Team[];
  sourceOptions: { matchId: string; label: string }[];
  onCreate: (fields: BracketMatchFields) => void;
  onCancel: () => void;
}) {
  const [slot1, setSlot1] = useState("");
  const [slot2, setSlot2] = useState("");
  const fieldsFor = (slot: string, side: 1 | 2): BracketMatchFields => {
    const teamKey = side === 1 ? "team1Id" : "team2Id";
    const sourceKey = side === 1 ? "team1SourceMatchId" : "team2SourceMatchId";
    if (slot.startsWith("winner:")) return { [teamKey]: null, [sourceKey]: slot.slice(7) };
    return { [teamKey]: slot.replace(/^team:/, "") || null, [sourceKey]: null };
  };

  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold">Nuovo incontro</p>
        <button onClick={onCancel}><X size={16} className="text-[rgba(251,243,222,0.50)]" /></button>
      </div>
      <select value={slot1} onChange={(e) => setSlot1(e.target.value)} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2">
        <option value="">— vuoto (slot in attesa) —</option>
        {teams.map((t) => (
          <option key={t.id} value={`team:${t.id}`}>{t.name}</option>
        ))}
        {sourceOptions.map((option) => <option key={option.matchId} value={`winner:${option.matchId}`}>{option.label}</option>)}
      </select>
      <select value={slot2} onChange={(e) => setSlot2(e.target.value)} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2">
        <option value="">— vuoto (slot in attesa) —</option>
        {teams.map((t) => (
          <option key={t.id} value={`team:${t.id}`}>{t.name}</option>
        ))}
        {sourceOptions.map((option) => <option key={option.matchId} value={`winner:${option.matchId}`}>{option.label}</option>)}
      </select>
      <button onClick={() => onCreate({ ...fieldsFor(slot1, 1), ...fieldsFor(slot2, 2) })} className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold">
        Aggiungi
      </button>
    </div>
  );
}

function EditMatchForm({
  match,
  teams,
  sourceOptions,
  onCancel,
  onDone,
}: {
  match: BracketMatch;
  teams: Team[];
  sourceOptions: { matchId: string; label: string }[];
  onCancel: () => void;
  onDone: (msg: string) => void;
}) {
  const [slot1, setSlot1] = useState(match.team1SourceMatchId ? `winner:${match.team1SourceMatchId}` : match.team1Id ? `team:${match.team1Id}` : "");
  const [slot2, setSlot2] = useState(match.team2SourceMatchId ? `winner:${match.team2SourceMatchId}` : match.team2Id ? `team:${match.team2Id}` : "");
  const [score, setScore] = useState(match.score ?? "");
  const [winner, setWinner] = useState(match.winnerTeamId ?? "");
  const [saving, setSaving] = useState(false);
  const directTeamId = (slot: string) => slot.startsWith("team:") ? slot.slice(5) : "";
  const sourceMatchId = (slot: string) => slot.startsWith("winner:") ? slot.slice(7) : "";
  const team1Id = directTeamId(slot1) || (sourceMatchId(slot1) ? match.team1Id ?? "" : "");
  const team2Id = directTeamId(slot2) || (sourceMatchId(slot2) ? match.team2Id ?? "" : "");

  const save = async () => {
    setSaving(true);
    try {
      await updateBracketMatch(match.editionId, match.id, {
        team1Id: directTeamId(slot1) || null,
        team2Id: directTeamId(slot2) || null,
        team1SourceMatchId: sourceMatchId(slot1) || null,
        team2SourceMatchId: sourceMatchId(slot2) || null,
        score: score.trim(),
        winnerTeamId: winner || null,
      });
      onDone("Incontro aggiornato.");
    } catch (err) {
      console.error(err);
      onDone("Errore nel salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#123008] border border-[rgba(251,243,222,0.18)] rounded-2xl p-3">
      <select value={slot1} onChange={(e) => { setSlot1(e.target.value); setWinner(""); }} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2">
        <option value="">— vuoto —</option>
        {teams.map((t) => (
          <option key={t.id} value={`team:${t.id}`}>{t.name}</option>
        ))}
        {sourceOptions.map((option) => <option key={option.matchId} value={`winner:${option.matchId}`}>{option.label}</option>)}
      </select>
      <select value={slot2} onChange={(e) => { setSlot2(e.target.value); setWinner(""); }} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2">
        <option value="">— vuoto —</option>
        {teams.map((t) => (
          <option key={t.id} value={`team:${t.id}`}>{t.name}</option>
        ))}
        {sourceOptions.map((option) => <option key={option.matchId} value={`winner:${option.matchId}`}>{option.label}</option>)}
      </select>
      <input
        placeholder="Risultato (es. 2-1, 6-3 6-4, ecc.)"
        value={score}
        onChange={(e) => setScore(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm mb-2"
      />
      <p className="text-[11px] text-[rgba(251,243,222,0.50)] mb-1">Squadra vincente</p>
      <select value={winner} onChange={(e) => setWinner(e.target.value)} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2">
        <option value="">Non ancora deciso</option>
        {team1Id && <option value={team1Id}>{teams.find((t) => t.id === team1Id)?.name}</option>}
        {team2Id && <option value={team2Id}>{teams.find((t) => t.id === team2Id)?.name}</option>}
      </select>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="flex-1 bg-lime text-[#081208] rounded-lg py-2 text-sm font-bold disabled:opacity-50">
          Salva
        </button>
        <button onClick={onCancel} className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2 text-sm font-semibold">
          Annulla
        </button>
      </div>
    </div>
  );
}
