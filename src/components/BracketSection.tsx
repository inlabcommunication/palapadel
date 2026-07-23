import { useState } from "react";
import { addDoc, collection, deleteDoc, deleteField, doc, updateDoc, where } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { db } from "../firebase";
import { confirmDelete } from "../lib/confirmDelete";
import type { BracketMatch, BracketRound, ChampionshipEdition, Team } from "../types";
import { Plus, X, Pencil, Trash2, ChevronUp, ChevronDown, Trophy, Wand2 } from "lucide-react";


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
  const [showNewRound, setShowNewRound] = useState(false);

  const sortedRounds = [...rounds].sort((a, b) => a.order - b.order);
  const selectedRound = sortedRounds.find((r) => r.id === selectedRoundId) ?? sortedRounds[0];
  const selectedRoundIndex = selectedRound ? sortedRounds.findIndex((r) => r.id === selectedRound.id) : -1;
  const nextRound = selectedRoundIndex >= 0 ? sortedRounds[selectedRoundIndex + 1] : undefined;

  const toggleBracket = async (enabled: boolean) => {
    try {
      await updateDoc(doc(db, "championshipEditions", edition.id), { bracketEnabled: enabled });
      showToast(enabled ? "Tabellone attivato." : "Tabellone disattivato.");
    } catch (err) {
      console.error(err);
      showToast("Errore nell'operazione.");
    }
  };

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
      const ref = await addDoc(collection(db, "bracketRounds"), {
        editionId: edition.id,
        name: name.trim(),
        order: nextOrder,
      });
      setSelectedRoundId(ref.id);
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
      await updateDoc(doc(db, "bracketRounds", round.id), { order: swapWith.order });
      await updateDoc(doc(db, "bracketRounds", swapWith.id), { order: round.order });
    } catch (err) {
      console.error(err);
      showToast("Errore nello spostamento.");
    }
  };

  const renameRound = async (round: BracketRound, name: string) => {
    if (!name.trim()) return;
    try {
      await updateDoc(doc(db, "bracketRounds", round.id), { name: name.trim() });
      showToast("Turno rinominato.");
    } catch (err) {
      console.error(err);
      showToast("Errore nel salvataggio.");
    }
  };

  const removeRound = async (round: BracketRound) => {
    if (!confirmDelete(round.name)) return;
    try {
      await deleteDoc(doc(db, "bracketRounds", round.id));
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
      for (const m of nextRoundMatches) {
        await deleteDoc(doc(db, "bracketMatches", m.id));
      }
      let order = 0;
      for (let i = 0; i < currentMatches.length; i += 2) {
        const winnerA = currentMatches[i]?.winnerTeamId;
        const winnerB = currentMatches[i + 1]?.winnerTeamId;
        await addDoc(collection(db, "bracketMatches"), {
          editionId: edition.id,
          roundId: nextRound.id,
          order: order++,
          ...(winnerA ? { team1Id: winnerA } : {}),
          ...(winnerB ? { team2Id: winnerB } : {}),
        });
      }
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
        {isAdmin && (
          <button onClick={() => toggleBracket(false)} className="text-xs text-[rgba(251,243,222,0.35)]">
            Disattiva
          </button>
        )}
      </div>

      {sortedRounds.length === 0 ? (
        <p className="text-[12.5px] text-[rgba(251,243,222,0.35)] mb-2">Nessun turno creato ancora.</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          {sortedRounds.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRoundId(r.id)}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-semibold shrink-0 ${
                (selectedRound?.id ?? sortedRounds[0]?.id) === r.id ? "bg-lime text-[#081208]" : "bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.85)]"
              }`}
            >
              {r.name}
            </button>
          ))}
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
          isAdmin={isAdmin}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function NewRoundForm({ onCreate, onCancel }: { onCreate: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold">Nuovo turno</p>
        <button onClick={onCancel}><X size={16} className="text-[rgba(251,243,222,0.35)]" /></button>
      </div>
      <input
        placeholder="Nome turno (es. Ottavi, Quarti, Semifinale, Finale, Spareggio...)"
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
  isAdmin: boolean;
  showToast: (msg: string) => void;
}) {
  const [editingRoundName, setEditingRoundName] = useState(false);
  const [nameDraft, setNameDraft] = useState(round.name);
  const [showNewMatch, setShowNewMatch] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

  const sortedMatches = [...matches].sort((a, b) => a.order - b.order);

  const teamName = (id?: string) => (id ? teams.find((t) => t.id === id)?.name ?? "Squadra eliminata" : "— vuoto —");

  const createMatch = async (team1Id: string, team2Id: string) => {
    try {
      const nextOrder = sortedMatches.length > 0 ? Math.max(...sortedMatches.map((m) => m.order)) + 1 : 0;
      await addDoc(collection(db, "bracketMatches"), {
        editionId: round.editionId,
        roundId: round.id,
        order: nextOrder,
        ...(team1Id ? { team1Id } : {}),
        ...(team2Id ? { team2Id } : {}),
      });
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
      await deleteDoc(doc(db, "bracketMatches", match.id));
      showToast("Incontro eliminato.");
    } catch (err) {
      console.error(err);
      showToast("Errore nell'eliminazione.");
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
          <p className="text-[12.5px] text-[rgba(251,243,222,0.35)]">Nessun incontro in questo turno ancora.</p>
        )}
        {sortedMatches.map((m) =>
          editingMatchId === m.id ? (
            <EditMatchForm
              key={m.id}
              match={m}
              teams={teams}
              onCancel={() => setEditingMatchId(null)}
              onDone={(msg) => {
                showToast(msg);
                setEditingMatchId(null);
              }}
            />
          ) : (
            <div key={m.id} className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className={`text-[13.5px] ${m.winnerTeamId && m.winnerTeamId === m.team1Id ? "font-bold" : ""}`}>
                  {teamName(m.team1Id)}
                </span>
                {!!m.winnerTeamId && m.winnerTeamId === m.team1Id && <Trophy size={13} className="text-[#BBFF5E]" />}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className={`text-[13.5px] ${m.winnerTeamId && m.winnerTeamId === m.team2Id ? "font-bold" : ""}`}>
                  {teamName(m.team2Id)}
                </span>
                {!!m.winnerTeamId && m.winnerTeamId === m.team2Id && <Trophy size={13} className="text-[#BBFF5E]" />}
              </div>
              {m.score && <p className="text-[11px] text-[rgba(251,243,222,0.35)] mt-1.5">{m.score}</p>}
              {isAdmin && (
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[rgba(251,243,222,0.08)]">
                  <button onClick={() => setEditingMatchId(m.id)} className="flex items-center gap-1 text-[#BBFF5E] text-xs font-semibold">
                    <Pencil size={12} /> Modifica
                  </button>
                  <button onClick={() => removeMatch(m)} className="flex items-center gap-1 text-[#FF6B6B] text-xs font-semibold">
                    <Trash2 size={12} /> Elimina
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {isAdmin && (
        <div className="mt-3">
          {showNewMatch ? (
            <NewMatchForm teams={teams} onCreate={createMatch} onCancel={() => setShowNewMatch(false)} />
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
  onCreate,
  onCancel,
}: {
  teams: Team[];
  onCreate: (team1Id: string, team2Id: string) => void;
  onCancel: () => void;
}) {
  const [team1Id, setTeam1Id] = useState("");
  const [team2Id, setTeam2Id] = useState("");

  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold">Nuovo incontro</p>
        <button onClick={onCancel}><X size={16} className="text-[rgba(251,243,222,0.35)]" /></button>
      </div>
      <select value={team1Id} onChange={(e) => setTeam1Id(e.target.value)} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2">
        <option value="">— vuoto (slot in attesa) —</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <select value={team2Id} onChange={(e) => setTeam2Id(e.target.value)} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2">
        <option value="">— vuoto (slot in attesa) —</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <button onClick={() => onCreate(team1Id, team2Id)} className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold">
        Aggiungi
      </button>
    </div>
  );
}

function EditMatchForm({
  match,
  teams,
  onCancel,
  onDone,
}: {
  match: BracketMatch;
  teams: Team[];
  onCancel: () => void;
  onDone: (msg: string) => void;
}) {
  const [team1Id, setTeam1Id] = useState(match.team1Id ?? "");
  const [team2Id, setTeam2Id] = useState(match.team2Id ?? "");
  const [score, setScore] = useState(match.score ?? "");
  const [winner, setWinner] = useState(match.winnerTeamId ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "bracketMatches", match.id), {
        team1Id: team1Id || deleteField(),
        team2Id: team2Id || deleteField(),
        score: score.trim() || deleteField(),
        winnerTeamId: winner || deleteField(),
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
    <div className="bg-[#123008] border border-[rgba(251,243,222,0.18)] rounded-xl p-3">
      <select value={team1Id} onChange={(e) => setTeam1Id(e.target.value)} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2">
        <option value="">— vuoto —</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <select value={team2Id} onChange={(e) => setTeam2Id(e.target.value)} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2">
        <option value="">— vuoto —</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <input
        placeholder="Risultato (es. 2-1, 6-3 6-4, ecc.)"
        value={score}
        onChange={(e) => setScore(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm mb-2"
      />
      <p className="text-[11px] text-[rgba(251,243,222,0.35)] mb-1">Squadra vincente</p>
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
