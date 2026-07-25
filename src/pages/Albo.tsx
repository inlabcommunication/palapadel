import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import { confirmDelete } from "../lib/confirmDelete";
import { groupHallOfFameRows, type HallOfFameRow } from "../lib/hallOfFame";
import type { ChampionshipType, HistoricalWin, Team } from "../types";
import { BADGE_COLORS } from "../types";
import { Plus, X, Pencil, Trash2, Award, ChevronRight } from "lucide-react";

const RANK_COLORS = [
  { bg: "#F5C842", text: "#4A2E00" },
  { bg: "#D8D8D8", text: "#3A3A3A" },
  { bg: "#D8A066", text: "#4A2A0A" },
];


type HallRow = HallOfFameRow;

export function AlboPage() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";
  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const { data: teams } = useCollection<Team>("teams");
  const { data: wins } = useCollection<HistoricalWin>("historicalWins");
  const [tab, setTab] = useState<"teams" | "players">("teams");
  const [filterTypeId, setFilterTypeId] = useState("");
  const [selected, setSelected] = useState<HallRow | null>(null);
  const [showManagement, setShowManagement] = useState(false);

  const femaleTypeIds = new Set(
    types
      .filter((type) => !type.hasTeams || type.badgeColor === "femminile")
      .map((type) => type.id)
  );
  const teamTypes = types.filter(
    (type) =>
      type.hasTeams &&
      ["serie-b", "serie-c", "principianti"].includes(type.badgeColor)
  );
  const teamRows = groupHallOfFameRows(
    wins.filter((win) => !femaleTypeIds.has(win.typeId) && Boolean(win.teamId)),
    types,
    (win) => win.teamId ?? "unknown",
    (win) =>
      win.winnerNameSnapshot ??
      teams.find((team) => team.id === win.teamId)?.name ??
      "Squadra eliminata"
  );
  const playerRows = groupHallOfFameRows(
    wins.filter((win) => femaleTypeIds.has(win.typeId) && Boolean(win.participantName)),
    types,
    (win) => win.participantName?.trim().toLocaleLowerCase("it-IT") ?? "unknown",
    (win) => win.winnerNameSnapshot ?? win.participantName ?? "Giocatrice"
  );
  const visibleRows =
    tab === "players"
      ? playerRows
      : teamRows.filter(
          (row) => !filterTypeId || row.wins.some((win) => win.typeId === filterTypeId)
        );

  return (
    <div className="p-4 pb-6">
      <div className="mb-4 flex items-center gap-2">
        <Award size={16} className="text-[#BBFF5E]" />
        <h1 className="font-display text-[30px] leading-none text-[#FBF3DE]">ALBO D'ORO</h1>
      </div>

      <div className="mb-4 grid grid-cols-2 rounded-lg bg-[#0A0B08] p-1" role="tablist">
        {[
          { id: "teams" as const, label: "Squadre" },
          { id: "players" as const, label: "Giocatrici" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-md px-3 py-2.5 text-[13px] font-bold ${
              tab === item.id ? "bg-[#BBFF5E] text-[#081208]" : "text-[rgba(251,243,222,0.58)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "teams" && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <FilterButton active={!filterTypeId} onClick={() => setFilterTypeId("")}>
            Tutte
          </FilterButton>
          {teamTypes.map((type) => (
            <FilterButton
              key={type.id}
              active={filterTypeId === type.id}
              onClick={() => setFilterTypeId(type.id)}
            >
              {type.name}
            </FilterButton>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[rgba(251,243,222,0.10)] bg-[#0A0B08]">
        {visibleRows.length === 0 && (
          <p className="px-4 py-8 text-center text-[12.5px] text-[rgba(251,243,222,0.42)]">
            {tab === "teams"
              ? "Nessuna squadra vincitrice per questo filtro."
              : "Nessuna vincitrice femminile registrata."}
          </p>
        )}
        {visibleRows.map((row) => (
          <button
            type="button"
            key={row.key}
            onClick={() => setSelected(row)}
            className="flex w-full items-center gap-3 border-b border-[rgba(251,243,222,0.08)] px-3.5 py-3 text-left last:border-b-0 hover:bg-[rgba(251,243,222,0.04)]"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="truncate text-[14px] font-bold">{row.label}</span>
              <div className="flex flex-wrap gap-1.5" aria-label={`${row.wins.length} medaglie`}>
                {row.wins.map((win) => {
                  const badge = BADGE_COLORS[win.type?.badgeColor ?? "serie-b"];
                  return (
                    <span
                      key={win.id}
                      title={`${win.type?.name ?? "Campionato"} - ${win.season}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2"
                      style={{ background: badge.bg, color: badge.text, borderColor: badge.text }}
                    >
                      <Award size={14} aria-hidden="true" />
                      <span className="sr-only">{win.type?.name ?? "Campionato"}, {win.season}</span>
                    </span>
                  );
                })}
              </div>
            </div>
            <ChevronRight size={17} className="shrink-0 text-[#BBFF5E]" />
          </button>
        ))}
      </div>

      {isAdmin && (
        <div className="mt-5 border-t border-[rgba(251,243,222,0.10)] pt-4">
          <button
            type="button"
            onClick={() => setShowManagement((value) => !value)}
            className="text-[13px] font-bold text-[#BBFF5E]"
          >
            {showManagement ? "Chiudi gestione vittorie" : "Gestisci vittorie storiche"}
          </button>
          {showManagement && <AlboManagementPanel embedded />}
        </div>
      )}

      {selected && <HallDetailModal row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-semibold ${
        active
          ? "bg-[#BBFF5E] text-[#081208]"
          : "bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.82)]"
      }`}
    >
      {children}
    </button>
  );
}

function HallDetailModal({ row, onClose }: { row: HallRow; onClose: () => void }) {
  const groupedByType = new Map<string, { label: string; seasons: string[] }>();
  row.wins.forEach((win) => {
    const key = win.typeId;
    const entry = groupedByType.get(key) ?? {
      label: win.type?.name ?? "Campionato",
      seasons: [],
    };
    entry.seasons.push(win.season);
    groupedByType.set(key, entry);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hall-detail-title"
        className="max-h-[calc(100dvh-64px-env(safe-area-inset-bottom))] w-full max-w-md overflow-y-auto rounded-lg border border-[rgba(251,243,222,0.12)] bg-[#0A0B08] p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="hall-detail-title" className="font-display text-[26px] leading-tight">{row.label}</h2>
          <button type="button" aria-label="Chiudi" onClick={onClose} className="rounded-full bg-[rgba(251,243,222,0.08)] p-2">
            <X size={17} />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          {[...groupedByType.values()].map((group) => (
            <section key={group.label}>
              <h3 className="text-[12px] font-extrabold uppercase text-[#BBFF5E]">{group.label}</h3>
              {[...group.seasons].sort().reverse().map((season) => (
                <p key={season} className="mt-1 text-[14px] text-[rgba(251,243,222,0.78)]">{season}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AlboManagementPanel({ embedded = false }: { embedded?: boolean }) {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";

  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const { data: teams } = useCollection<Team>("teams");
  const { data: wins } = useCollection<HistoricalWin>("historicalWins");

  const [selectedType, setSelectedType] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const activeType = selectedType || types[0]?.id;
  const currentType = types.find((t) => t.id === activeType);

  const winsForType = wins.filter((w) => w.typeId === activeType);

  // Raggruppa per squadra (o per nome giocatrice nel femminile) e conta i titoli
  const grouped = new Map<string, { label: string; seasons: string[]; wins: HistoricalWin[] }>();
  for (const w of winsForType) {
    const key = w.teamId ?? w.participantName ?? "sconosciuto";
    const label = w.winnerNameSnapshot ?? (w.teamId ? teams.find((t) => t.id === w.teamId)?.name ?? "Squadra eliminata" : w.participantName ?? "—");
    if (!grouped.has(key)) grouped.set(key, { label, seasons: [], wins: [] });
    const entry = grouped.get(key)!;
    entry.seasons.push(w.season);
    entry.wins.push(w);
  }
  const rows = [...grouped.values()].sort((a, b) => b.seasons.length - a.seasons.length);

  const remove = async (w: HistoricalWin, label: string) => {
    if (!confirmDelete(`${label} — ${w.season}`)) return;
    try {
      await deleteDoc(doc(db, "historicalWins", w.id));
      showToast("Vittoria eliminata.");
    } catch (err) {
      console.error(err);
      showToast("Errore nell'eliminazione.");
    }
  };

  return (
    <div className={embedded ? "mt-4" : "p-4 pb-6"}>
      <div className="flex items-center gap-2 mb-3">
        <Award size={15} className="text-[#BBFF5E]" />
        <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE]">Albo d'oro</h2>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedType(t.id)}
            className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-semibold shrink-0 ${
              activeType === t.id ? "bg-lime text-[#081208]" : "bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.85)]"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl overflow-hidden mb-3">
        {rows.length === 0 && (
          <p className="px-3.5 py-3 text-[12.5px] text-[rgba(251,243,222,0.35)]">Nessun titolo registrato per questa categoria.</p>
        )}
        {rows.map((r, idx) => (
          <div key={r.label} className="flex gap-3 px-3.5 py-3 border-b border-[rgba(251,243,222,0.08)] last:border-b-0">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 text-[11px] font-extrabold mt-0.5"
              style={{
                background: RANK_COLORS[idx]?.bg ?? "rgba(251,243,222,0.08)",
                color: RANK_COLORS[idx]?.text ?? "rgba(251,243,222,0.58)",
              }}
            >
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="font-bold text-sm truncate">{r.label}</p>
                <span
                  className="text-[10.5px] font-bold px-2 py-1 rounded-full shrink-0"
                  style={{
                    background: BADGE_COLORS[currentType?.badgeColor ?? "serie-b"].bg,
                    color: BADGE_COLORS[currentType?.badgeColor ?? "serie-b"].text,
                  }}
                >
                  {r.seasons.length} {r.seasons.length === 1 ? "titolo" : "titoli"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {r.wins.map((w) =>
                  editingId === w.id ? (
                    <EditWinForm
                      key={w.id}
                      win={w}
                      onCancel={() => setEditingId(null)}
                      onDone={(msg) => {
                        showToast(msg);
                        setEditingId(null);
                      }}
                    />
                  ) : (
                    <div key={w.id} className="flex items-center justify-between text-[12.5px] text-[rgba(251,243,222,0.58)] gap-2">
                      <span>
                        {w.season}
                        {w.note && <span className="text-[rgba(251,243,222,0.35)]"> · {w.note}</span>}
                      </span>
                      {isAdmin && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => setEditingId(w.id)} className="text-[#BBFF5E] font-semibold">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => remove(w, r.label)} className="text-[#FF6B6B] font-semibold">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isAdmin && currentType && (
        <div>
          {showAdd ? (
            <AddWinForm
              type={currentType}
              teams={teams}
              onDone={(msg) => {
                showToast(msg);
                setShowAdd(false);
              }}
              onCancel={() => setShowAdd(false)}
            />
          ) : (
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#BBFF5E]">
              <Plus size={15} /> Aggiungi vittoria passata
            </button>
          )}
        </div>
      )}

      <p className="text-[12px] text-[rgba(251,243,222,0.35)] mt-4">
        Qui aggiungi le vittorie precedenti alla creazione dell'app. Quando in futuro un campionato gestito
        nell'app verrà concluso (Fase 4), l'Albo d'oro si aggiornerà automaticamente da solo.
      </p>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#0A0B08] text-[#FBF3DE] border border-[rgba(187,255,94,0.3)] px-4 py-2.5 rounded-full text-[12.5px] max-w-[90%] text-center z-20">
          {toast}
        </div>
      )}
    </div>
  );
}

function AddWinForm({
  type,
  teams,
  onDone,
  onCancel,
}: {
  type: ChampionshipType;
  teams: Team[];
  onDone: (msg: string) => void;
  onCancel: () => void;
}) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [participantName, setParticipantName] = useState("");
  const [season, setSeason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!season.trim()) return;
    if (type.hasTeams && !teamId) return;
    if (!type.hasTeams && !participantName.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "historicalWins"), {
        typeId: type.id,
        ...(type.hasTeams ? { teamId } : { participantName: participantName.trim() }),
        season: season.trim(),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setSeason("");
      setNote("");
      setParticipantName("");
      onDone("Vittoria aggiunta all'Albo d'oro.");
    } catch (err) {
      console.error(err);
      onDone("Errore nell'aggiunta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold">Aggiungi vittoria — {type.name}</p>
        <button onClick={onCancel}><X size={16} className="text-[rgba(251,243,222,0.35)]" /></button>
      </div>

      {type.hasTeams ? (
        teams.length === 0 ? (
          <p className="text-[12.5px] text-[rgba(251,243,222,0.35)] mb-2">
            Nessuna squadra esistente. Creane una prima nella pagina Campionati.
          </p>
        ) : (
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )
      ) : (
        <input
          placeholder="Nome giocatrice"
          value={participantName}
          onChange={(e) => setParticipantName(e.target.value)}
          className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
        />
      )}

      <input
        placeholder="Stagione o anno (es. 2019/2020 oppure 2019)"
        value={season}
        onChange={(e) => setSeason(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <input
        placeholder="Nota facoltativa"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <button
        onClick={submit}
        disabled={saving || !season.trim()}
        className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
      >
        {saving ? "In corso..." : "Aggiungi"}
      </button>
    </div>
  );
}

function EditWinForm({
  win,
  onCancel,
  onDone,
}: {
  win: HistoricalWin;
  onCancel: () => void;
  onDone: (msg: string) => void;
}) {
  const [season, setSeason] = useState(win.season);
  const [note, setNote] = useState(win.note ?? "");
  const [participantName, setParticipantName] = useState(win.participantName ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "historicalWins", win.id), {
        season: season.trim(),
        note: note.trim(),
        ...(win.participantName !== undefined ? { participantName: participantName.trim() } : {}),
      });
      onDone("Vittoria aggiornata.");
    } catch (err) {
      console.error(err);
      onDone("Errore nel salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#123008] border border-[rgba(251,243,222,0.18)] rounded-lg p-2.5 my-1">
      {win.participantName !== undefined && (
        <input
          value={participantName}
          onChange={(e) => setParticipantName(e.target.value)}
          className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm mb-2"
          placeholder="Nome giocatrice"
        />
      )}
      <input
        value={season}
        onChange={(e) => setSeason(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm mb-2"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota facoltativa"
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm mb-2"
      />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="flex-1 bg-lime text-[#081208] rounded-lg py-1.5 text-xs font-bold disabled:opacity-50">
          Salva
        </button>
        <button onClick={onCancel} className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-1.5 text-xs font-semibold">
          Annulla
        </button>
      </div>
    </div>
  );
}
