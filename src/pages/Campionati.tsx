import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { where } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { useAuth } from "../contexts/AuthContext";
import { confirmDelete } from "../lib/confirmDelete";
import { compareStandingRows } from "../lib/standingsEngine";
import { importStandings, importFemaleStandings, StandingsApiError, type ImportStandingsRow, type ImportFemaleRow } from "../lib/standingsApi";
import {
  addEntryToStandings,
  updateStandingsEntry,
  removeStandingsEntry,
  recalculateStandings,
  setTeamStatus,
  type StandingsChange,
} from "../lib/standingsAdminApi";
import { computeTeamEditionStats } from "../lib/teamStats";
import { matchTeamName, findDuplicateImportedNames } from "../lib/teamNameMatch";
import { Plus, Pencil, Trash2, Settings, X, Upload, ChevronDown, ChevronUp, Lock, RefreshCw, Trophy, Calendar, Clock, Ban, Eye, EyeOff } from "lucide-react";
import type {
  ChampionshipEdition,
  ChampionshipType,
  EditionStatus,
  EditionTeam,
  FemaleParticipant,
  HistoricalWin,
  Match,
  Matchday,
  ParticipationStatus,
  Team,
} from "../types";
import { ChampionshipTypeManagement, TeamManagement } from "../components/ChampionshipManagement";
import { BracketSection } from "../components/BracketSection";
import { StandingsShareButton } from "../components/StandingsShareButton";
import { parsePastedTable } from "../lib/parsePastedTable";
import { resolveActiveMatchdayId } from "../lib/activeMatchday";
import { closeEdition, reorderChampionships, setChampionshipVisibility } from "../lib/championshipAdminApi";
import { createChampionshipEdition, deleteChampionshipEdition, updateChampionshipEdition } from "../lib/championshipApi";
import { createFemaleParticipant, deleteFemaleParticipant, recalculateFemaleParticipants, updateFemaleParticipant } from "../lib/femaleParticipantApi";


function statusLabel(status: EditionStatus) {
  return status === "attiva" ? "Attiva" : status === "conclusa" ? "Conclusa" : status === "nascosta" ? "Nascosta" : "Bozza";
}

/** Ordina le edizioni dalla più recente: usa createdAt se presente, altrimenti la stagione come testo. */
function sortEditionsRecentFirst(list: ChampionshipEdition[]) {
  return [...list].sort((a, b) => {
    if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
    return b.season.localeCompare(a.season);
  });
}

/** Sceglie l'edizione da mostrare di default per una tipologia: quella attiva, altrimenti la più recente conclusa, altrimenti la più recente in assoluto. */
function pickDefaultEdition(editionsOfType: ChampionshipEdition[]) {
  const active = editionsOfType.find((e) => e.status === "attiva");
  if (active) return active;
  const sorted = sortEditionsRecentFirst(editionsOfType);
  const concluded = sorted.find((e) => e.status === "conclusa");
  return concluded ?? sorted[0];
}

const RANK_COLORS = [
  { bg: "#F5C842", text: "#4A2E00" },
  { bg: "#D8D8D8", text: "#3A3A3A" },
  { bg: "#D8A066", text: "#4A2A0A" },
];

export function CampionatiPage() {
  const { editionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "superAdmin";

  const typesQuery = useCollection<ChampionshipType>("championshipTypes");
  const { data: types } = typesQuery;
  // Come in Home: il pubblico non deve interrogare edizioni bozza/nascoste, non solo
  // "non vederle" — altrimenti la query verrebbe comunque rifiutata dalle regole Firestore.
  const editionsQuery = useCollection<ChampionshipEdition>(
    "championshipEditions",
    isAdmin ? [] : [where("status", "in", ["attiva", "conclusa"]), where("isPubliclyVisible", "==", true)],
    [isAdmin]
  );
  const { data: loadedEditions } = editionsQuery;
  const editions = loadedEditions
    .filter((item) => isAdmin || item.isPubliclyVisible !== false)
    .sort((a, b) => (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER));

  const [showNewEdition, setShowNewEdition] = useState(false);
  const [showTypeSettings, setShowTypeSettings] = useState(false);
  const [managementTab, setManagementTab] = useState<"championships" | "teams">("championships");
  const [showSeasonPicker, setShowSeasonPicker] = useState(false);
  const [editingEdition, setEditingEdition] = useState(false);
  const [manualTypeId, setManualTypeId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [contentTab, setContentTab] = useState<"standings" | "calendar">(
    searchParams.get("tab") === "calendar" ? "calendar" : "standings"
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // L'edizione corrente dall'URL determina la tipologia selezionata, a meno che
  // l'utente non abbia appena cliccato un altro chip di tipologia (manualTypeId).
  const editionFromUrl = editionId ? editions.find((e) => e.id === editionId) : undefined;
  const activeTypeId = manualTypeId ?? editionFromUrl?.typeId ?? types[0]?.id;
  const activeType = types.find((t) => t.id === activeTypeId);

  const editionsOfActiveType = activeTypeId ? editions.filter((e) => e.typeId === activeTypeId) : [];
  const sortedEditionsOfType = sortEditionsRecentFirst(editionsOfActiveType);

  // Se l'edizione dall'URL appartiene alla tipologia selezionata, usa quella; altrimenti la scelta di default.
  const edition =
    editionFromUrl && editionFromUrl.typeId === activeTypeId
      ? editionFromUrl
      : pickDefaultEdition(editionsOfActiveType);

  const selectType = (typeId: string) => {
    setManualTypeId(typeId);
    setEditingEdition(false);
    setShowSeasonPicker(false);
    setContentTab("standings");
    const def = pickDefaultEdition(editions.filter((e) => e.typeId === typeId));
    if (def) navigate(`/campionati/${def.id}`);
    else navigate("/campionati");
  };

  const selectEdition = (ed: ChampionshipEdition) => {
    setManualTypeId(ed.typeId);
    setShowSeasonPicker(false);
    setEditingEdition(false);
    setContentTab("standings");
    navigate(`/campionati/${ed.id}`);
  };

  const orderedEditions = [...editions].sort(
    (a, b) => (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER) || a.season.localeCompare(b.season)
  );

  const moveEdition = async (id: string, direction: -1 | 1) => {
    const index = orderedEditions.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= orderedEditions.length) return;
    const next = [...orderedEditions];
    [next[index], next[target]] = [next[target], next[index]];
    setOrdering(true);
    try {
      await reorderChampionships(next.map((item) => item.id));
      showToast("Ordine dei campionati aggiornato.");
    } catch (err) {
      console.error(err);
      showToast("Impossibile aggiornare l'ordine.");
    } finally {
      setOrdering(false);
    }
  };

  const toggleVisibility = async (item: ChampionshipEdition) => {
    setOrdering(true);
    try {
      await setChampionshipVisibility(item.id, item.isPubliclyVisible === false);
      showToast(item.isPubliclyVisible === false ? "Campionato nuovamente visibile." : "Campionato nascosto al pubblico.");
    } catch (err) {
      console.error(err);
      showToast("Impossibile modificare la visibilità.");
    } finally {
      setOrdering(false);
    }
  };

  if (typesQuery.loading || editionsQuery.loading) {
    return <div className="p-4"><h2 className="text-[13px] font-extrabold uppercase">Campionati</h2><p className="mt-3 text-sm text-[rgba(251,243,222,0.58)]">Caricamento campionati...</p></div>;
  }

  const loadingError = typesQuery.error ?? editionsQuery.error;
  if (loadingError) {
    return (
      <div className="p-4">
        <h2 className="font-bold">Campionati non disponibili</h2>
        <p className="my-2 text-sm text-[rgba(251,243,222,0.58)]">{loadingError.message}</p>
        <button onClick={() => { typesQuery.retry(); editionsQuery.retry(); }} className="text-sm font-bold text-[#BBFF5E]">Riprova</button>
      </div>
    );
  }

  if (isAdmin && managementTab === "teams") {
    return (
      <div className="p-4">
        <div className="mb-4 grid grid-cols-2 rounded-lg bg-[#0A0B08] p-1" role="tablist" aria-label="Campionati e squadre">
          <button role="tab" aria-selected={false} onClick={() => setManagementTab("championships")}
            className="rounded-md px-3 py-2.5 text-sm font-bold text-[rgba(251,243,222,0.72)]">Campionati</button>
          <button role="tab" aria-selected className="rounded-md bg-[#BBFF5E] px-3 py-2.5 text-sm font-bold text-[#081208]">Squadre</button>
        </div>
        <TeamManagement onDone={showToast} />
        {toast && <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[rgba(187,255,94,0.3)] bg-[#0A0B08] px-4 py-2.5 text-center text-[12.5px]">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="p-4">
      {isAdmin && (
        <div className="mb-4 grid grid-cols-2 rounded-lg bg-[#0A0B08] p-1" role="tablist" aria-label="Campionati e squadre">
          <button role="tab" aria-selected className="rounded-md bg-[#BBFF5E] px-3 py-2.5 text-sm font-bold text-[#081208]">Campionati</button>
          <button role="tab" aria-selected={false} onClick={() => setManagementTab("teams")}
            className="rounded-md px-3 py-2.5 text-sm font-bold text-[rgba(251,243,222,0.72)]">Squadre</button>
        </div>
      )}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE]">Campionati</h2>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTypeSettings((v) => !v)}
              className="flex items-center gap-1 text-xs text-[rgba(251,243,222,0.58)]"
            >
              <Settings size={14} /> Tipologie
            </button>
          </div>
        )}
      </div>

      {showTypeSettings && (
        <div className="mb-4 bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5">
          <ChampionshipTypeManagement onDone={showToast} />
        </div>
      )}

      {isAdmin && (
        <section className="mb-4 rounded-lg border border-[rgba(251,243,222,0.10)] bg-[#0A0B08] p-3">
          <h3 className="mb-2 text-xs font-extrabold uppercase text-[#FBF3DE]">Ordine e visibilità</h3>
          <div className="space-y-1">
            {orderedEditions.map((item, index) => {
              const type = types.find((candidate) => candidate.id === item.typeId);
              return (
                <div key={item.id} className="flex items-center gap-2 rounded-lg bg-[rgba(251,243,222,0.05)] px-2 py-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{type?.name ?? "Campionato"} {item.season}</span>
                  <button aria-label="Sposta campionato in alto" disabled={ordering || index === 0} onClick={() => moveEdition(item.id, -1)}
                    className="rounded-md p-1.5 hover:bg-[rgba(251,243,222,0.08)] disabled:opacity-25"><ChevronUp size={15} /></button>
                  <button aria-label="Sposta campionato in basso" disabled={ordering || index === orderedEditions.length - 1} onClick={() => moveEdition(item.id, 1)}
                    className="rounded-md p-1.5 hover:bg-[rgba(251,243,222,0.08)] disabled:opacity-25"><ChevronDown size={15} /></button>
                  <button aria-label={item.isPubliclyVisible === false ? "Rendi visibile il campionato" : "Nascondi il campionato"}
                    disabled={ordering} onClick={() => toggleVisibility(item)}
                    className={`rounded-md p-1.5 ${item.isPubliclyVisible === false ? "text-[#FF9B6B]" : "text-[#BBFF5E]"}`}>
                    {item.isPubliclyVisible === false ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Riga 1: una scheda per ogni tipologia di campionato (Serie B, Serie C, Principianti, Femminile...) */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
        {types.map((t) => {
          const isSel = t.id === activeTypeId;
          return (
            <button
              key={t.id}
              onClick={() => selectType(t.id)}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-[12.5px] font-semibold shrink-0 ${
                isSel ? "bg-lime text-[#081208]" : "bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.85)]"
              }`}
            >
              {t.logoUrl && <img src={t.logoUrl} alt="" className="h-7 w-7 rounded-md object-cover" loading="lazy" />}
              {t.name}
            </button>
          );
        })}
      </div>

      {/* Riga 2: selettore di stagione per la tipologia scelta, + azioni admin */}
      <div className="flex items-center gap-2 mb-4 relative">
        {edition ? (
          <button
            onClick={() => setShowSeasonPicker((v) => !v)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold bg-[#0A0B08] border border-[rgba(251,243,222,0.18)]"
          >
            {edition.season}
            <ChevronDown size={13} />
          </button>
        ) : (
          <span className="text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessuna edizione ancora per questa tipologia.</span>
        )}
        {isAdmin && (
          <button
            onClick={() => setShowNewEdition((v) => !v)}
            className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold shrink-0 border border-dashed border-[rgba(251,243,222,0.30)] text-[rgba(251,243,222,0.58)] flex items-center gap-1"
          >
            <Plus size={13} /> Nuova edizione
          </button>
        )}

        {showSeasonPicker && sortedEditionsOfType.length > 0 && (
          <div className="absolute top-9 left-0 z-10 bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl shadow-md overflow-hidden min-w-[180px]">
            {sortedEditionsOfType.map((e) => (
              <button
                key={e.id}
                onClick={() => selectEdition(e)}
                className={`w-full text-left px-3.5 py-2.5 text-[13px] flex items-center justify-between gap-2 border-b border-[rgba(251,243,222,0.08)] last:border-b-0 ${
                  e.id === edition?.id ? "bg-[rgba(187,255,94,0.14)] font-semibold" : ""
                }`}
              >
                <span>{e.season}</span>
                <span className="text-[10px] text-[rgba(251,243,222,0.50)]">{statusLabel(e.status)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showNewEdition && isAdmin && (
        <NewEditionForm
          types={types}
          defaultTypeId={activeTypeId}
          onDone={(msg, newId) => {
            showToast(msg);
            setShowNewEdition(false);
            if (newId) navigate(`/campionati/${newId}`);
          }}
          onCancel={() => setShowNewEdition(false)}
        />
      )}

      {edition && (
        <div className="mb-4">
          {editingEdition && isAdmin ? (
            <EditEditionForm
              edition={edition}
              types={types}
              onCancel={() => setEditingEdition(false)}
              onDone={(msg) => {
                showToast(msg);
                setEditingEdition(false);
              }}
              onDelete={() => {
                setEditingEdition(false);
                navigate("/campionati");
              }}
            />
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-[rgba(251,243,222,0.58)] flex items-center gap-1.5">
                {!activeType ? (
                  <span className="text-[#FF9B6B] font-semibold">
                    Tipologia non trovata — modifica l'edizione per collegarla a una tipologia valida
                  </span>
                ) : (
                  <>
                    {statusLabel(edition.status)}
                    {edition.status === "conclusa" && edition.closedAt && (
                      <span className="text-[rgba(251,243,222,0.50)] flex items-center gap-1">
                        <Lock size={11} /> storico congelato
                      </span>
                    )}
                  </>
                )}
              </p>
              <div className="flex items-center gap-3">
                {isAdmin && (
                  <button onClick={() => setEditingEdition(true)} className="flex items-center gap-1 text-xs text-[#BBFF5E] font-semibold">
                    <Pencil size={13} /> Modifica edizione
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {edition && activeType?.hasTeams && (
        <>
          <div className="mb-4 grid grid-cols-2 rounded-lg bg-[#0A0B08] p-1" role="tablist" aria-label="Contenuti del campionato">
            <button role="tab" aria-selected={contentTab === "standings"} onClick={() => setContentTab("standings")}
              className={`rounded-md px-3 py-2.5 text-sm font-bold ${contentTab === "standings" ? "bg-[#BBFF5E] text-[#081208]" : "text-[rgba(251,243,222,0.72)]"}`}>
              Classifica
            </button>
            <button role="tab" aria-selected={contentTab === "calendar"} onClick={() => setContentTab("calendar")}
              className={`rounded-md px-3 py-2.5 text-sm font-bold ${contentTab === "calendar" ? "bg-[#BBFF5E] text-[#081208]" : "text-[rgba(251,243,222,0.72)]"}`}>
              Calendario
            </button>
          </div>
          {contentTab === "standings" ? (
            <TeamStandings edition={edition} championshipName={activeType.name} isAdmin={isAdmin} showToast={showToast} />
          ) : (
            <>
              <PublicCalendar edition={edition} />
              <BracketSection edition={edition} isAdmin={isAdmin} showToast={showToast} />
            </>
          )}
        </>
      )}
      {edition && activeType && !activeType.hasTeams && (
        <FemaleStandings edition={edition} championshipName={activeType.name} isAdmin={isAdmin} showToast={showToast} />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#0A0B08] text-[#FBF3DE] border border-[rgba(187,255,94,0.3)] px-4 py-2.5 rounded-full text-[12.5px] max-w-[90%] text-center z-20">
          {toast}
        </div>
      )}
    </div>
  );
}

/* =========================== Creazione / modifica edizione =========================== */

function NewEditionForm({
  types,
  defaultTypeId,
  onDone,
  onCancel,
}: {
  types: ChampionshipType[];
  defaultTypeId?: string;
  onDone: (msg: string, newId?: string) => void;
  onCancel: () => void;
}) {
  const [typeId, setTypeId] = useState(defaultTypeId ?? types[0]?.id ?? "");
  const [season, setSeason] = useState("");
  const [status, setStatus] = useState<EditionStatus>("bozza");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!typeId || !season.trim()) return;
    setSaving(true);
    try {
      const response = await createChampionshipEdition({
        typeId,
        season: season.trim(),
        status,
      });
      onDone("Edizione creata.", response.id);
    } catch (err) {
      console.error(err);
      onDone("Errore nella creazione dell'edizione.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold">Nuova edizione</p>
        <button onClick={onCancel}><X size={16} className="text-[rgba(251,243,222,0.50)]" /></button>
      </div>
      <select
        value={typeId}
        onChange={(e) => setTypeId(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2"
      >
        {types.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <input
        placeholder="Stagione (es. 2025/2026 oppure 2026)"
        value={season}
        onChange={(e) => setSeason(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as EditionStatus)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2"
      >
        <option value="bozza">Bozza</option>
        <option value="attiva">Attiva</option>
        <option value="conclusa">Conclusa</option>
        <option value="nascosta">Nascosta</option>
      </select>
      <button
        onClick={create}
        disabled={saving || !season.trim()}
        className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
      >
        {saving ? "Creazione in corso..." : "Crea edizione"}
      </button>
    </div>
  );
}

function EditEditionForm({
  edition,
  types,
  onCancel,
  onDone,
  onDelete,
}: {
  edition: ChampionshipEdition;
  types: ChampionshipType[];
  onCancel: () => void;
  onDone: (msg: string) => void;
  onDelete: () => void;
}) {
  const [typeId, setTypeId] = useState(edition.typeId);
  const [season, setSeason] = useState(edition.season);
  const [status, setStatus] = useState<EditionStatus>(edition.status);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const newStatus = status;
      const isNewlyConcluded = newStatus === "conclusa" && edition.status !== "conclusa";
      if (isNewlyConcluded) {
        await updateChampionshipEdition({ editionId: edition.id, typeId, season: season.trim(), status: edition.status === "conclusa" ? "attiva" : edition.status });
        await closeEdition(edition.id);
      } else {
        await updateChampionshipEdition({ editionId: edition.id, typeId, season: season.trim(), status: newStatus as Exclude<EditionStatus, "conclusa"> });
      }
      onDone(isNewlyConcluded ? "Edizione conclusa: classifica, tabellone e vincitore sono stati congelati." : "Edizione aggiornata.");
    } catch (err) {
      console.error(err);
      onDone("Errore nel salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const t = types.find((x) => x.id === edition.typeId);
    if (!confirmDelete(`${t?.name} ${edition.season}`)) return;
    try {
      await deleteChampionshipEdition(edition.id);
      onDelete();
    } catch (err) {
      console.error(err);
      onDone("Errore nell'eliminazione.");
    }
  };

  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5">
      <select
        value={typeId}
        onChange={(e) => setTypeId(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2"
      >
        {types.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <input
        value={season}
        onChange={(e) => setSeason(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm mb-2"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as EditionStatus)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2"
      >
        <option value="bozza">Bozza</option>
        <option value="attiva">Attiva</option>
        <option value="conclusa">Conclusa</option>
        <option value="nascosta">Nascosta</option>
      </select>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="flex-1 bg-lime text-[#081208] rounded-lg py-2 text-sm font-bold disabled:opacity-50">
          Salva
        </button>
        <button onClick={onCancel} className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2 text-sm font-semibold">
          Annulla
        </button>
      </div>
      <button onClick={remove} className="w-full text-[#FF6B6B] text-xs font-semibold mt-2">
        Elimina questa edizione
      </button>
    </div>
  );
}

/* =========================== Classifica squadre (con gestione contestuale) =========================== */

function TeamStandings({
  edition,
  championshipName,
  isAdmin,
  showToast,
}: {
  edition: ChampionshipEdition;
  championshipName: string;
  isAdmin: boolean;
  showToast: (msg: string) => void;
}) {
  const { appUser } = useAuth();
  const canShareAsResultManager = appUser?.role === "resultManager";
  const editionId = edition.id;
  const { data: editionTeams } = useCollection<EditionTeam>(
    "editionTeams",
    [where("editionId", "==", editionId)],
    [editionId]
  );
  const { data: teams } = useCollection<Team>("teams");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showLive, setShowLive] = useState(false);
  const [recalcPreview, setRecalcPreview] = useState<StandingsChange[] | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const isFrozen = edition.status === "conclusa" && !!edition.frozenStandings;

  const rows = editionTeams
    .map((et) => ({ ...et, team: teams.find((t) => t.id === et.teamId) }))
    .sort(compareStandingRows);

  const nameForTeamId = (teamId: string) => rows.find((r) => r.teamId === teamId)?.team?.name ?? "—";

  /**
   * Fase 2 — non esiste più un secondo motore di ricalcolo nel frontend: sia
   * l'anteprima (dryRun) sia il commit definitivo sono calcolati esclusivamente da
   * api/standings/recalculate.js. Il frontend si limita a mostrare quello che il
   * backend restituisce.
   */
  const openRecalcPreview = async () => {
    setRecalculating(true);
    try {
      const result = await recalculateStandings({ editionId, dryRun: true });
      const changes = result.preview ?? [];
      if (changes.length === 0) {
        showToast("La classifica è già aggiornata: nessuna modifica da applicare.");
        return;
      }
      setRecalcPreview(changes);
    } catch (err) {
      console.error(err);
      const msg = err instanceof StandingsApiError ? err.message : "Errore nel calcolo dell'anteprima.";
      showToast(msg);
    } finally {
      setRecalculating(false);
    }
  };

  const confirmRecalc = async () => {
    if (!recalcPreview || recalcPreview.length === 0) return;
    setRecalculating(true);
    try {
      await recalculateStandings({ editionId, dryRun: false });
      showToast("Classifica ricalcolata.");
      setRecalcPreview(null);
    } catch (err) {
      console.error(err);
      const msg = err instanceof StandingsApiError ? err.message : "Errore nel ricalcolo.";
      showToast(msg);
    } finally {
      setRecalculating(false);
    }
  };

  const availableTeams = teams.filter((t) => !editionTeams.some((et) => et.teamId === t.id));

  if (isFrozen && !showLive) {
    const frozenRows = edition.frozenStandings!;
    const frozenShareRows = frozenRows.map((r, i) => ({
      position: i + 1,
      name: r.name,
      points: r.points,
      played: r.played ?? 0,
      status: r.status,
    }));
    return (
      <div>
        <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl overflow-hidden">
          <div className="flex items-center px-3.5 py-2.5 text-xs font-bold text-[rgba(251,243,222,0.58)] border-b border-[rgba(251,243,222,0.08)]">
            <span className="w-6">#</span>
            <span className="flex-1">Squadra</span>
            <span className="w-10 text-center">PG</span>
            <span className="w-14 text-center">Pt</span>
          </div>
          {frozenRows.map((r, i) => (
            <div key={r.id} className="flex items-center px-3.5 py-2.5 text-[13px] border-b border-[rgba(251,243,222,0.08)] last:border-b-0">
              <span className="w-6 flex items-center justify-center shrink-0">
                {i < 3 ? (
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold"
                    style={{ background: RANK_COLORS[i].bg, color: RANK_COLORS[i].text }}
                  >
                    {i + 1}
                  </span>
                ) : (
                  <span className="text-[rgba(251,243,222,0.50)]">{i + 1}</span>
                )}
              </span>
              <button onClick={() => setSelectedTeamId(r.id)} className="flex-1 text-left font-semibold truncate">
                {r.name}
              </button>
              <span className="w-10 text-center">{r.played ?? "—"}</span>
              <span className="w-14 text-center">
                {r.status === "normale" ? (
                  <span className="font-display text-[15px] text-[#BBFF5E]">{r.points}</span>
                ) : (
                  <span className="text-[11px] font-bold text-[#FF9B6B]">
                    {r.status === "ritirata" ? "Ritirata" : "Squalificata"}
                  </span>
                )}
              </span>
            </div>
          ))}
          {frozenRows.length === 0 && (
            <p className="px-3.5 py-2.5 text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessuna squadra iscritta.</p>
          )}
        </div>
        {canShareAsResultManager && (
          <div className="mt-3">
            <StandingsShareButton
              input={{ categoryName: championshipName, season: edition.season, kind: "team", rows: frozenShareRows }}
              showToast={showToast}
            />
          </div>
        )}
        {isAdmin && (
          <div className="mt-3 flex flex-col gap-2 items-start">
            <StandingsShareButton
              input={{ categoryName: championshipName, season: edition.season, kind: "team", rows: frozenShareRows }}
              showToast={showToast}
            />
            <button onClick={() => setShowLive(true)} className="flex items-center gap-1 text-xs text-[rgba(251,243,222,0.50)]">
              <Lock size={11} /> Correggi dati e ricongela
            </button>
          </div>
        )}
        {selectedTeamId && <TeamProfileModal teamId={selectedTeamId} edition={edition} onClose={() => setSelectedTeamId(null)} />}
      </div>
    );
  }

  return (
    <div>
      {isFrozen && isAdmin && (
        <button onClick={() => setShowLive(false)} className="mb-2 flex items-center gap-1 text-xs text-[#BBFF5E] font-semibold">
          <Lock size={11} /> Torna alla classifica congelata
        </button>
      )}
      <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl overflow-hidden">
        <div className="flex items-center px-3.5 py-2.5 text-xs font-bold text-[rgba(251,243,222,0.58)] border-b border-[rgba(251,243,222,0.08)]">
          <span className="w-6">#</span>
          <span className="flex-1">Squadra</span>
          <span className="w-10 text-center">PG</span>
          <span className="w-14 text-center">Pt</span>
          {isAdmin && <span className="w-16" />}
        </div>
        {rows.map((r, i) =>
          editingId === r.id ? (
            <EditionTeamEditRow
              key={r.id}
              editionTeam={r}
              editionId={editionId}
              label={r.team?.name ?? ""}
              onCancel={() => setEditingId(null)}
              onDone={showToast}
            />
          ) : (
            <div key={r.id} className="flex items-center px-3.5 py-2.5 text-[13px] border-b border-[rgba(251,243,222,0.08)] last:border-b-0">
              <span className="w-6 flex items-center justify-center shrink-0">
                {i < 3 ? (
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold"
                    style={{ background: RANK_COLORS[i].bg, color: RANK_COLORS[i].text }}
                  >
                    {i + 1}
                  </span>
                ) : (
                  <span className="text-[rgba(251,243,222,0.50)]">{i + 1}</span>
                )}
              </span>
              <button
                onClick={() => r.team && setSelectedTeamId(r.team.id)}
                className="flex-1 text-left font-semibold truncate"
              >
                {r.team?.name}
              </button>
              <span className="w-10 text-center">{r.played}</span>
              <span className="w-14 text-center">
                {r.status === "normale" ? (
                  <span className="font-display text-[15px] text-[#BBFF5E]">{r.points}</span>
                ) : (
                  <span className="text-[11px] font-bold text-[#FF9B6B]">
                    {r.status === "ritirata" ? "Ritirata" : "Squalificata"}
                  </span>
                )}
              </span>
              {isAdmin && (
                <button onClick={() => setEditingId(r.id)} className="w-16 text-[#BBFF5E] text-xs font-semibold text-right">
                  Modifica
                </button>
              )}
            </div>
          )
        )}
        {rows.length === 0 && <p className="px-3.5 py-2.5 text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessuna squadra iscritta.</p>}
      </div>

      {canShareAsResultManager && (
        <div className="mt-3">
          <StandingsShareButton
            input={{
              categoryName: championshipName,
              season: edition.season,
              kind: "team",
              rows: rows.map((r, i) => ({
                position: i + 1,
                name: r.team?.name ?? "Squadra",
                points: r.points,
                played: r.played,
                status: r.status,
              })),
            }}
            showToast={showToast}
          />
        </div>
      )}
      {isAdmin && (
        <div className="mt-3 flex flex-col gap-2 items-start">
          <StandingsShareButton
            input={{
              categoryName: championshipName,
              season: edition.season,
              kind: "team",
              rows: rows.map((r, i) => ({
                position: i + 1,
                name: r.team?.name ?? "Squadra",
                points: r.points,
                played: r.played,
                status: r.status,
              })),
            }}
            showToast={showToast}
          />

          {showAdd ? (
            <AddTeamToEdition
              editionId={editionId}
              availableTeams={availableTeams}
              onDone={(msg) => {
                showToast(msg);
                setShowAdd(false);
              }}
              onCancel={() => setShowAdd(false)}
            />
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-[#BBFF5E]"
            >
              <Plus size={15} /> Aggiungi squadra a questa classifica
            </button>
          )}

          {showImport ? (
            <ImportTeamStandings
              editionId={editionId}
              existingEditionTeams={rows}
              allTeams={teams}
              onDone={(msg) => {
                showToast(msg);
                setShowImport(false);
              }}
              onCancel={() => setShowImport(false)}
            />
          ) : (
            <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#BBFF5E]">
              <Upload size={15} /> Incolla classifica da Excel o Word
            </button>
          )}

          {recalcPreview ? (
            <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5 w-full">
              <p className="text-[13px] font-bold mb-2">Ricalcola classifica</p>
              <div className="flex flex-col gap-1 mb-3 text-[12.5px]">
                {recalcPreview.map((c) => (
                  <p key={c.teamId}>
                    <strong>{nameForTeamId(c.teamId)}</strong>: punti da {c.fromPoints} a {c.toPoints}
                    {c.fromPlayed !== c.toPlayed && <>, partite giocate da {c.fromPlayed} a {c.toPlayed}</>}
                  </p>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmRecalc}
                  disabled={recalculating}
                  className="flex-1 bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
                >
                  {recalculating ? "Ricalcolo in corso..." : "Conferma ricalcolo"}
                </button>
                <button
                  onClick={() => setRecalcPreview(null)}
                  className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2.5 text-sm font-semibold"
                >
                  Annulla
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={openRecalcPreview}
              disabled={recalculating}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-[#BBFF5E] disabled:opacity-50"
            >
              <RefreshCw size={15} /> {recalculating ? "Calcolo anteprima..." : "Ricalcola classifica"}
            </button>
          )}
        </div>
      )}

      {selectedTeamId && <TeamProfileModal teamId={selectedTeamId} edition={edition} onClose={() => setSelectedTeamId(null)} />}
    </div>
  );
}

/**
 * Popup con il profilo di una squadra: nome, foto (o iniziali se assente), rosa
 * giocatori e i titoli vinti (dall'Albo d'oro, sia storici che generati automaticamente).
 */
function TeamProfileModal({
  teamId,
  edition,
  onClose,
}: {
  teamId: string;
  edition: ChampionshipEdition;
  onClose: () => void;
}) {
  const { data: teams } = useCollection<Team>("teams");
  const { data: wins } = useCollection<HistoricalWin>("historicalWins", [where("teamId", "==", teamId)], [teamId]);
  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const { data: matches, loading: statsLoading } = useCollection<Match>(
    "matches",
    [where("editionId", "==", edition.id)],
    [edition.id]
  );
  const team = teams.find((t) => t.id === teamId);
  const currentType = types.find((x) => x.id === edition.typeId);
  const stats = computeTeamEditionStats(matches, teamId);
  const roster = team?.roster ?? [];
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () => Array.from(
      dialog?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []
    ).filter((element) => !element.hasAttribute("disabled"));
    (focusable()[0] ?? dialog)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 pb-[calc(104px+env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))] sm:p-6"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Profilo ${team?.name ?? "squadra"}`}
        className="w-full max-w-2xl bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-lg overflow-hidden max-h-[calc(100dvh-24px-104px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:max-h-[calc(100dvh-48px)] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fase 7 — foto di gruppo della squadra: grande, orizzontale (16:9), object-cover.
            Se manca, un placeholder sportivo con le iniziali (mai un logo/avatar quadrato). */}
        <div className="relative w-full aspect-video bg-[#123008]">
          {team?.teamPhotoUrl ? (
            <img src={team.teamPhotoUrl} alt={team.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
              <Trophy size={28} className="text-[rgba(187,255,94,0.35)]" />
              <p className="text-[22px] font-extrabold text-[rgba(187,255,94,0.35)]">
                {(team?.name ?? "?").slice(0, 2).toUpperCase()}
              </p>
            </div>
          )}
          <button aria-label="Chiudi profilo squadra" onClick={onClose} className="absolute top-2.5 right-2.5 bg-black/60 rounded-full p-2">
            <X size={16} className="text-[#FBF3DE]" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
        </div>

        <div className="p-4">
          <h3 className="text-[18px] font-extrabold leading-tight text-[#FBF3DE] mb-1">{team?.name ?? "Squadra"}</h3>
          <p className="text-[11px] uppercase tracking-wider text-[rgba(251,243,222,0.50)] font-bold mb-2">
            Statistiche {currentType?.name ?? "campionato"} {edition.season}
          </p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "PG", value: stats.played },
              { label: "Vinte", value: stats.wins },
              { label: "Perse", value: stats.losses },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-[#123008] px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wider text-[rgba(251,243,222,0.50)] font-bold">{item.label}</p>
                <p className="font-display text-[20px] text-[#BBFF5E]">{statsLoading ? "..." : item.value}</p>
              </div>
            ))}
          </div>

          <p className="text-[11px] uppercase tracking-wider text-[rgba(251,243,222,0.50)] font-bold mb-1">Rosa</p>
          <p className="text-[13px] text-[rgba(251,243,222,0.85)] leading-snug mb-4">
            {roster.length > 0 ? roster.join(", ") : "Nessun giocatore registrato."}
          </p>

          <p className="text-[11px] uppercase tracking-wider text-[rgba(251,243,222,0.50)] font-bold mb-2">Titoli vinti</p>
          {wins.length === 0 ? (
            <p className="text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessun titolo vinto ancora.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {wins.map((w) => {
                const t = types.find((x) => x.id === w.typeId);
                return (
                  <div key={w.id} className="flex items-center gap-2.5 bg-[#123008] rounded-lg px-3 py-2">
                    <Trophy size={15} className="text-[#F5C842] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold truncate">{t?.name ?? "Campionato"}</p>
                      <p className="text-[11px] text-[rgba(251,243,222,0.50)]">{w.season}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Fase 12 — Calendario pubblico, integrato nella pagina campionato (non una app separata).
 * Sola lettura: nessun controllo amministrativo, nessuna modifica possibile qui.
 * Selezione di default all'apertura: 1) la prima giornata con partite incomplete,
 * 2) altrimenti l'ultima giornata disputata, 3) altrimenti la prima disponibile.
 */
function PublicCalendar({ edition }: { edition: ChampionshipEdition }) {
  const editionId = edition.id;
  const { data: matchdays } = useCollection<Matchday>("matchdays", [where("editionId", "==", editionId)], [editionId]);
  const { data: matches } = useCollection<Match>("matches", [where("editionId", "==", editionId)], [editionId]);
  const { data: teams } = useCollection<Team>("teams");
  const [selectedMatchdayId, setSelectedMatchdayId] = useState<string | null>(null);

  const sortedMatchdays = [...matchdays].sort((a, b) => a.number - b.number);
  const matchesFor = (matchdayId: string) => matches.filter((m) => m.matchdayId === matchdayId);
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "Squadra eliminata";

  const defaultMatchdayId = resolveActiveMatchdayId(edition.activeMatchdayId, sortedMatchdays, matches);

  const activeMatchdayId = selectedMatchdayId ?? defaultMatchdayId;
  const activeMatchday = sortedMatchdays.find((md) => md.id === activeMatchdayId);

  if (sortedMatchdays.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Calendar size={15} className="text-[#BBFF5E]" />
        <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE]">Calendario</h3>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
        {sortedMatchdays.map((md) => (
          <button
            key={md.id}
            onClick={() => setSelectedMatchdayId(md.id)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold shrink-0 ${
              md.id === activeMatchdayId ? "bg-lime text-[#081208]" : "bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.85)]"
            }`}
          >
            {md.number}ª giornata
          </button>
        ))}
      </div>

      {activeMatchday && (
        <div className="flex flex-col gap-2">
          {matchesFor(activeMatchday.id).length === 0 && (
            <p className="text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessuna partita in questa giornata.</p>
          )}
          {matchesFor(activeMatchday.id).map((m) => (
            <div key={m.id} className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl px-3.5 py-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate">
                  {teamName(m.team1Id)} <span className="text-[rgba(251,243,222,0.50)]">vs</span> {teamName(m.team2Id)}
                </p>
                {(m.matchDate || m.matchTime) && (
                  <p className="mt-1 text-[11px] text-[rgba(251,243,222,0.48)]">
                    {formatPublicMatchSchedule(m.matchDate, m.matchTime)}
                  </p>
                )}
              </div>
              {m.status === "conclusa" && m.result && (
                <span className="font-display text-[15px] text-[#BBFF5E] shrink-0">{m.result}</span>
              )}
              {m.status === "da_giocare" && (
                <span className="text-[12px] text-[rgba(251,243,222,0.50)] font-semibold shrink-0">VS</span>
              )}
              {m.status === "rinviata" && (
                <span className="flex items-center gap-1 text-[11px] text-[#FF9B6B] shrink-0">
                  <Clock size={12} /> Rinviata
                </span>
              )}
              {m.status === "annullata" && (
                <span className="flex items-center gap-1 text-[11px] text-[rgba(251,243,222,0.50)] shrink-0">
                  <Ban size={12} /> Annullata
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatPublicMatchSchedule(date?: string, time?: string) {
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

function ImportTeamStandings({
  editionId,
  existingEditionTeams,
  allTeams,
  onDone,
  onCancel,
}: {
  editionId: string;
  existingEditionTeams: (EditionTeam & { team?: Team })[];
  allTeams: Team[];
  onDone: (msg: string) => void;
  onCancel: () => void;
}) {
  const { data: matchdays } = useCollection<Matchday>("matchdays", [where("editionId", "==", editionId)], [editionId]);
  const sortedMatchdays = [...matchdays].sort((a, b) => a.number - b.number);

  const [mode, setMode] = useState<1 | 2 | 3>(1);
  const [mode2Choice, setMode2Choice] = useState<"A" | "B">("A");
  const [thresholdMatchdayNumber, setThresholdMatchdayNumber] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [duplicateError, setDuplicateError] = useState<string[] | null>(null);
  const [ambiguousRows, setAmbiguousRows] = useState<
    { index: number; name: string; points: number; played: number; similarTeamId: string; similarTeamName: string }[] | null
  >(null);
  const [ambiguousChoices, setAmbiguousChoices] = useState<Record<number, "link" | "create" | "ignore">>({});
  const [preview, setPreview] = useState<{
    rows: ImportStandingsRow[];
    enrolledCount: number;
    globalExistingCount: number;
    newCount: number;
    ignoredCount: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = allTeams.map((t) => ({ id: t.id, name: t.name }));
  const enrolledTeamIds = new Set(existingEditionTeams.map((et) => et.teamId));

  /**
   * Fase 13 — analizza il testo incollato: blocca subito se ci sono righe duplicate
   * (stesso nome dopo normalizzazione) nello stesso file. Poi classifica ogni riga:
   * corrispondenza esatta (nessuna azione richiesta), "simile" (richiede una scelta
   * esplicita: collega / crea comunque / ignora), o nessuna corrispondenza (nuova
   * squadra, nessuna ambiguità).
   */
  const analyze = () => {
    setError(null);
    const { rows: parsedRows } = parsePastedTable(text);
    const duplicates = findDuplicateImportedNames(parsedRows.map((r) => r.name));
    if (duplicates.length > 0) {
      setDuplicateError(duplicates);
      setPreview(null);
      setAmbiguousRows(null);
      return;
    }
    setDuplicateError(null);

    const ambiguous: { index: number; name: string; points: number; played: number; similarTeamId: string; similarTeamName: string }[] = [];
    parsedRows.forEach((row, index) => {
      const match = matchTeamName(row.name, candidates);
      if (match.kind === "similar") {
        ambiguous.push({
          index,
          name: row.name,
          points: row.num1,
          played: row.num2,
          similarTeamId: match.candidate.id,
          similarTeamName: match.candidate.name,
        });
      }
    });

    if (ambiguous.length > 0) {
      setAmbiguousRows(ambiguous);
      setAmbiguousChoices({});
      setPreview(null);
      return;
    }

    buildPreview(parsedRows, {});
  };

  const buildPreview = (
    parsedRows: { name: string; num1: number; num2: number }[],
    resolutions: Record<number, "link" | "create" | "ignore">
  ) => {
    const finalRows: ImportStandingsRow[] = [];
    let enrolledCount = 0;
    let globalExistingCount = 0;
    let newCount = 0;
    let ignoredCount = 0;

    parsedRows.forEach((row, index) => {
      const choice = resolutions[index];
      if (choice === "ignore") {
        ignoredCount++;
        return;
      }
      if (choice === "create") {
        finalRows.push({ name: row.name, points: row.num1, played: row.num2, createNewTeam: true });
        newCount++;
        return;
      }
      const match = matchTeamName(row.name, candidates);
      if (choice === "link" && match.kind === "similar") {
        finalRows.push({ name: row.name, points: row.num1, played: row.num2, linkedTeamId: match.candidate.id });
        if (enrolledTeamIds.has(match.candidate.id)) enrolledCount++;
        else globalExistingCount++;
        return;
      }
      if (match.kind === "exact") {
        finalRows.push({ name: row.name, points: row.num1, played: row.num2, linkedTeamId: match.candidate.id });
        if (enrolledTeamIds.has(match.candidate.id)) enrolledCount++;
        else globalExistingCount++;
        return;
      }
      // Nessuna corrispondenza: nuova squadra, nessuna ambiguità da confermare.
      finalRows.push({ name: row.name, points: row.num1, played: row.num2, createNewTeam: true });
      newCount++;
    });

    setPreview({ rows: finalRows, enrolledCount, globalExistingCount, newCount, ignoredCount });
    setAmbiguousRows(null);
  };

  const confirmAmbiguousChoices = () => {
    if (!ambiguousRows) return;
    const allChosen = ambiguousRows.every((r) => ambiguousChoices[r.index]);
    if (!allChosen) {
      setError("Scegli un'azione per ogni riga simile prima di continuare.");
      return;
    }
    setError(null);
    const { rows: parsedRows } = parsePastedTable(text);
    buildPreview(parsedRows, ambiguousChoices);
  };

  const missingFromText = existingEditionTeams.filter(
    (et) => !preview?.rows.some((r) => r.linkedTeamId === et.teamId)
  );

  const confirm = async () => {
    if (!preview) return;
    setSaving(true);
    setError(null);
    try {
      const result = await importStandings({
        editionId,
        mode,
        mode2Choice: mode === 2 ? mode2Choice : undefined,
        mode2ThresholdMatchdayNumber: mode === 2 && mode2Choice === "B" ? thresholdMatchdayNumber ?? undefined : undefined,
        rows: preview.rows,
      });
      onDone(
        `Importazione completata: ${result.matchedCount} aggiornate, ${result.createdCount} create/iscritte.` +
          (missingFromText.length > 0 ? ` ${missingFromText.length} non presenti nel testo hanno mantenuto i dati precedenti.` : "") +
          (result.warnings.length > 0 ? ` Attenzione: ${result.warnings.join(" ")}` : "")
      );
    } catch (err) {
      console.error(err);
      const msg = err instanceof StandingsApiError ? err.message : "Errore durante l'importazione.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5 w-full">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold">Importa classifica (incolla da Excel/Word)</p>
        <button onClick={onCancel}><X size={16} className="text-[rgba(251,243,222,0.50)]" /></button>
      </div>

      {!ambiguousRows && !preview && (
        <>
          <p className="text-[12px] text-[rgba(251,243,222,0.50)] mb-2">Scegli la modalità di importazione:</p>
          <div className="flex flex-col gap-1.5 mb-3">
            <label className="flex items-start gap-2 text-[12.5px]">
              <input type="radio" checked={mode === 1} onChange={() => setMode(1)} className="mt-0.5" />
              <span><strong>Situazione iniziale</strong> — i valori diventano la base di partenza; i risultati già presenti nell'app si sommano sopra.</span>
            </label>
            <label className="flex items-start gap-2 text-[12.5px]">
              <input type="radio" checked={mode === 2} onChange={() => setMode(2)} className="mt-0.5" />
              <span><strong>Classifica attuale completa</strong> — i valori rappresentano già tutti i risultati fino ad oggi.</span>
            </label>
            {mode === 2 && (
              <div className="ml-5 flex flex-col gap-1.5 mb-1 pl-2 border-l border-[rgba(251,243,222,0.18)]">
                <label className="flex items-start gap-2 text-[12px]">
                  <input type="radio" checked={mode2Choice === "A"} onChange={() => setMode2Choice("A")} className="mt-0.5" />
                  <span>Azzera il contributo delle partite già inserite e usa l'importazione come nuova baseline.</span>
                </label>
                <label className="flex items-start gap-2 text-[12px]">
                  <input type="radio" checked={mode2Choice === "B"} onChange={() => setMode2Choice("B")} className="mt-0.5" />
                  <span>Conserva solo le partite successive a una giornata selezionata:</span>
                </label>
                {mode2Choice === "B" && (
                  <select
                    value={thresholdMatchdayNumber ?? ""}
                    onChange={(e) => setThresholdMatchdayNumber(e.target.value ? Number(e.target.value) : null)}
                    className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[12.5px] bg-[#0A0B08]"
                  >
                    <option value="">Scegli la giornata soglia...</option>
                    {sortedMatchdays.map((md) => (
                      <option key={md.id} value={md.number}>{md.number}ª giornata (valgono solo le successive)</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <label className="flex items-start gap-2 text-[12.5px]">
              <input type="radio" checked={mode === 3} onChange={() => setMode(3)} className="mt-0.5" />
              <span><strong>Aggiornamento parziale</strong> — aggiorna solo le squadre presenti nel testo, le altre restano invariate.</span>
            </label>
          </div>
        </>
      )}

      {!ambiguousRows && !preview && (
        <>
          <p className="text-[12px] text-[rgba(251,243,222,0.50)] mb-2">
            Copia le righe da Excel o da una tabella Word e incollale qui sotto. Ogni riga deve contenere il nome
            della squadra seguito da <strong>Punti</strong> e <strong>Partite giocate</strong> (in quest'ordine). Le
            squadre non ancora esistenti vengono create automaticamente (con rosa vuota da completare dopo).
          </p>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDuplicateError(null);
            }}
            placeholder={"Los Locos Padel\t9\t4\nSmash Taranto\t7\t4\n..."}
            className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2 min-h-[120px] font-mono"
          />
          {duplicateError && (
            <p className="text-[12px] text-[#FF6B6B] mb-2">
              Righe duplicate nel file (sembrano la stessa squadra): {duplicateError.join(", ")}. Correggi il testo prima di continuare.
            </p>
          )}
          <button
            onClick={analyze}
            disabled={!text.trim() || (mode === 2 && mode2Choice === "B" && thresholdMatchdayNumber === null)}
            className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
          >
            Analizza
          </button>
        </>
      )}

      {ambiguousRows && (
        <div>
          <p className="text-[12.5px] font-semibold mb-2">
            Alcuni nomi somigliano a squadre già esistenti. Conferma cosa fare per ciascuno (non vengono mai uniti automaticamente):
          </p>
          <div className="flex flex-col gap-3 mb-3">
            {ambiguousRows.map((r) => (
              <div key={r.index} className="bg-[#123008] rounded-lg p-2.5">
                <p className="text-[12.5px] mb-1.5">
                  <strong>"{r.name}"</strong> potrebbe corrispondere a <strong>"{r.similarTeamName}"</strong>
                </p>
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-2 text-[12px]">
                    <input
                      type="radio"
                      name={`choice-${r.index}`}
                      checked={ambiguousChoices[r.index] === "link"}
                      onChange={() => setAmbiguousChoices((p) => ({ ...p, [r.index]: "link" }))}
                    />
                    Collega alla squadra esistente "{r.similarTeamName}"
                  </label>
                  <label className="flex items-center gap-2 text-[12px]">
                    <input
                      type="radio"
                      name={`choice-${r.index}`}
                      checked={ambiguousChoices[r.index] === "create"}
                      onChange={() => setAmbiguousChoices((p) => ({ ...p, [r.index]: "create" }))}
                    />
                    Crea una nuova squadra comunque
                  </label>
                  <label className="flex items-center gap-2 text-[12px]">
                    <input
                      type="radio"
                      name={`choice-${r.index}`}
                      checked={ambiguousChoices[r.index] === "ignore"}
                      onChange={() => setAmbiguousChoices((p) => ({ ...p, [r.index]: "ignore" }))}
                    />
                    Ignora questa riga
                  </label>
                </div>
              </div>
            ))}
          </div>
          {error && <p className="text-[12px] text-[#FF6B6B] mb-2">{error}</p>}
          <div className="flex gap-2">
            <button onClick={confirmAmbiguousChoices} className="flex-1 bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold">
              Continua
            </button>
            <button
              onClick={() => setAmbiguousRows(null)}
              className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2.5 text-sm font-semibold"
            >
              Modifica testo
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div>
          <div className="bg-[#123008] rounded-lg p-2.5 mb-2 text-[12.5px]">
            <p className="mb-1">
              <strong>{preview.enrolledCount}</strong> squadre già iscritte verranno aggiornate,{" "}
              <strong>{preview.globalExistingCount}</strong> squadre esistenti verranno iscritte,{" "}
              <strong>{preview.newCount}</strong> nuove squadre verranno create.
            </p>
            {preview.ignoredCount > 0 && <p className="mb-1">{preview.ignoredCount} riga/righe ignorate su tua scelta.</p>}
            {missingFromText.length > 0 && (
              <p className="text-[rgba(251,243,222,0.50)]">
                Non presenti nel testo (manterranno i dati attuali): {missingFromText.map((m) => m.team?.name).join(", ")}
              </p>
            )}
          </div>
          {error && <p className="text-[12px] text-[#FF6B6B] mb-2">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={confirm}
              disabled={saving}
              className="flex-1 bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {saving ? "Importazione in corso..." : "Conferma importazione"}
            </button>
            <button
              onClick={() => setPreview(null)}
              className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2.5 text-sm font-semibold"
            >
              Modifica testo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddTeamToEdition({
  editionId,
  availableTeams,
  onDone,
  onCancel,
}: {
  editionId: string;
  availableTeams: Team[];
  onDone: (msg: string) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">(availableTeams.length > 0 ? "existing" : "new");
  const [teamId, setTeamId] = useState(availableTeams[0]?.id ?? "");
  const [name, setName] = useState("");
  const [rosterText, setRosterText] = useState("");
  const [saving, setSaving] = useState(false);

  // Fase 2 — l'aggiunta di una squadra alla classifica passa dal backend
  // (api/standings/manage-entry.js), mai più un setDoc diretto su editionTeams.
  const submit = async () => {
    setSaving(true);
    try {
      if (mode === "existing") {
        if (!teamId) return;
        await addEntryToStandings({ editionId, teamId });
        onDone("Squadra aggiunta alla classifica.");
      } else {
        const roster = rosterText.split(",").map((s) => s.trim()).filter(Boolean);
        if (!name.trim() || roster.length < 2 || roster.length > 6) {
          onDone("Inserisci un nome e una rosa da 2 a 6 giocatori.");
          setSaving(false);
          return;
        }
        await addEntryToStandings({ editionId, newTeam: { name: name.trim(), roster } });
        onDone(`Squadra "${name}" creata e aggiunta.`);
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof StandingsApiError ? err.message : "Errore nell'operazione.";
      onDone(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold">Aggiungi squadra</p>
        <button onClick={onCancel}><X size={16} className="text-[rgba(251,243,222,0.50)]" /></button>
      </div>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setMode("existing")}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold ${mode === "existing" ? "bg-lime text-[#081208]" : "bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.85)]"}`}
        >
          Squadra esistente
        </button>
        <button
          onClick={() => setMode("new")}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold ${mode === "new" ? "bg-lime text-[#081208]" : "bg-[rgba(251,243,222,0.08)] text-[rgba(251,243,222,0.85)]"}`}
        >
          Nuova squadra
        </button>
      </div>
      {mode === "existing" ? (
        availableTeams.length === 0 ? (
          <p className="text-[12.5px] text-[rgba(251,243,222,0.50)] mb-2">Tutte le squadre esistenti sono già iscritte. Creane una nuova.</p>
        ) : (
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2"
          >
            {availableTeams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )
      ) : (
        <>
          <input
            placeholder="Nome squadra"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
          />
          <input
            placeholder="Giocatori separati da virgola (min 2, max 6)"
            value={rosterText}
            onChange={(e) => setRosterText(e.target.value)}
            className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
          />
        </>
      )}
      <button
        onClick={submit}
        disabled={saving}
        className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
      >
        {saving ? "In corso..." : "Aggiungi"}
      </button>
    </div>
  );
}

const STATUS_POLICIES: { value: 1 | 2 | 3 | 4; label: string }[] = [
  { value: 1, label: "Annulla tutte le partite (passate e future)" },
  { value: 2, label: "Conserva le partite già giocate, annulla solo le future" },
  { value: 3, label: "Assegna 2-0 agli avversari per tutte le partite" },
  { value: 4, label: "Conserva le partite già giocate, assegna 2-0 agli avversari nelle future" },
];

function EditionTeamEditRow({
  editionTeam,
  editionId,
  label,
  onCancel,
  onDone,
}: {
  editionTeam: EditionTeam;
  editionId: string;
  label: string;
  onCancel: () => void;
  onDone: (msg: string) => void;
}) {
  // "Punti calcolati" / "PG" in questa scheda rappresentano la BASELINE manuale: il
  // ricalcolo automatico (Fase 5) somma sopra questi valori i punti/partite giocate
  // che derivano dalle partite in matches (matchPoints/matchPlayed), che qui restano
  // invariati e non vanno persi salvando questa scheda.
  const [baselinePoints, setBaselinePoints] = useState(
    String(editionTeam.baselinePoints ?? editionTeam.calculatedPoints ?? editionTeam.points)
  );
  const [manualAdjustment, setManualAdjustment] = useState(String(editionTeam.manualPointsAdjustment ?? 0));
  const [baselinePlayed, setBaselinePlayed] = useState(String(editionTeam.baselinePlayed ?? editionTeam.played));
  const [manualPlayedAdjustment, setManualPlayedAdjustment] = useState(String(editionTeam.manualPlayedAdjustment ?? 0));
  const [order, setOrder] = useState(String(editionTeam.order));
  const [status, setStatus] = useState<ParticipationStatus>(editionTeam.status);
  const [policy, setPolicy] = useState<1 | 2 | 3 | 4>(1);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const matchPoints = editionTeam.matchPoints ?? 0;
  const matchPlayed = editionTeam.matchPlayed ?? 0;
  const finalPoints = (Number(baselinePoints) || 0) + matchPoints + (Number(manualAdjustment) || 0);
  const finalPlayed = (Number(baselinePlayed) || 0) + matchPlayed + (Number(manualPlayedAdjustment) || 0);
  const statusChanged = status !== editionTeam.status;
  const statusNeedsPolicy = statusChanged && (status === "ritirata" || status === "squalificata");

  // Fase 2 — nessuna scrittura diretta su editionTeams: i valori numerici passano da
  // manage-entry.js, l'eventuale cambio di stato (con effetto a cascata sulle partite
  // coinvolte) passa separatamente da set-status.js.
  const save = async () => {
    if (reason.trim().length < 5) {
      onDone("Inserisci una motivazione di almeno 5 caratteri.");
      return;
    }
    setSaving(true);
    try {
      if (statusChanged) {
        await setTeamStatus({
          editionId,
          editionTeamId: editionTeam.id,
          newStatus: status,
          policy: statusNeedsPolicy ? policy : undefined,
          reason: reason.trim(),
        });
      }
      await updateStandingsEntry({
        editionId,
        editionTeamId: editionTeam.id,
        baselinePoints: Number(baselinePoints) || 0,
        baselinePlayed: Number(baselinePlayed) || 0,
        manualPointsAdjustment: Number(manualAdjustment) || 0,
        manualPlayedAdjustment: Number(manualPlayedAdjustment) || 0,
        order: Number(order) || 0,
        reason: reason.trim(),
      });
      onDone("Dati aggiornati.");
      onCancel();
    } catch (err) {
      console.error(err);
      const msg = err instanceof StandingsApiError ? err.message : "Errore nel salvataggio.";
      onDone(msg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (reason.trim().length < 5) {
      onDone("Inserisci una motivazione di almeno 5 caratteri.");
      return;
    }
    if (!confirmDelete(label)) return;
    try {
      await removeStandingsEntry({ editionId, editionTeamId: editionTeam.id, reason: reason.trim() });
      onDone("Squadra rimossa dalla classifica.");
      onCancel();
    } catch (err) {
      console.error(err);
      const msg = err instanceof StandingsApiError ? err.message : "Errore nella rimozione.";
      onDone(msg);
    }
  };

  return (
    <div className="px-3.5 py-3 border-b border-[rgba(251,243,222,0.08)] last:border-b-0 bg-[#123008]">
      <p className="text-[12.5px] font-semibold mb-2">{label}</p>
      <div className="flex gap-2 mb-2">
        <div className="flex-1">
          <p className="text-[11px] text-[rgba(251,243,222,0.50)] mb-1">Punti calcolati</p>
          <input
            type="number"
            value={baselinePoints}
            onChange={(e) => setBaselinePoints(e.target.value)}
            className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1">
          <p className="text-[11px] text-[rgba(251,243,222,0.50)] mb-1">Correzione (+/-)</p>
          <input
            type="number"
            value={manualAdjustment}
            onChange={(e) => setManualAdjustment(e.target.value)}
            className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>
      {(matchPoints !== 0 || matchPlayed !== 0) && (
        <p className="text-[11px] text-[rgba(251,243,222,0.50)] mb-2">
          + {matchPoints} pt / {matchPlayed} PG dalle partite già registrate in questa edizione
        </p>
      )}
      <p className="text-[12px] text-[rgba(251,243,222,0.58)] mb-2">
        Punti finali: <span className="font-display text-[15px] text-[#BBFF5E]">{finalPoints}</span>
        {Number(manualAdjustment) !== 0 && (
          <span className="text-[rgba(251,243,222,0.50)]"> · sopravvive a un futuro import Excel</span>
        )}
        {" · "}PG finali: <span className="font-display text-[15px] text-[#BBFF5E]">{finalPlayed}</span>
      </p>
      <div className="flex gap-2 mb-2">
        <div className="flex-1">
          <p className="text-[11px] text-[rgba(251,243,222,0.50)] mb-1">PG</p>
          <input type="number" value={baselinePlayed} onChange={(e) => setBaselinePlayed(e.target.value)} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] text-[rgba(251,243,222,0.50)] mb-1">Correzione PG (+/-)</p>
          <input type="number" value={manualPlayedAdjustment} onChange={(e) => setManualPlayedAdjustment(e.target.value)} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="w-16">
          <p className="text-[11px] text-[rgba(251,243,222,0.50)] mb-1">Ordine</p>
          <input type="number" value={order} onChange={(e) => setOrder(e.target.value)} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as ParticipationStatus)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2"
      >
        <option value="normale">Normale (attiva)</option>
        <option value="ritirata">Ritirata</option>
        <option value="squalificata">Squalificata</option>
      </select>
      {statusNeedsPolicy && (
        <div className="bg-[#0A0B08] rounded-lg p-2.5 mb-2">
          <p className="text-[11px] text-[rgba(251,243,222,0.58)] mb-1.5">
            Cosa fare delle partite di questa squadra:
          </p>
          <div className="flex flex-col gap-1">
            {STATUS_POLICIES.map((p) => (
              <label key={p.value} className="flex items-start gap-2 text-[11.5px]">
                <input type="radio" checked={policy === p.value} onChange={() => setPolicy(p.value)} className="mt-0.5" />
                {p.label}
              </label>
            ))}
          </div>
        </div>
      )}
      <label className="mb-2 block text-[11px] font-bold text-[rgba(251,243,222,0.72)]">
        Motivazione obbligatoria
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2}
          className="mt-1 w-full rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2 text-sm" />
      </label>
      <div className="flex gap-2 mb-2">
        <button onClick={save} disabled={saving || reason.trim().length < 5} className="flex-1 bg-lime text-[#081208] rounded-lg py-2 text-sm font-bold disabled:opacity-50">
          {saving ? "Salvataggio..." : "Salva"}
        </button>
        <button onClick={onCancel} className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2 text-sm font-semibold">
          Annulla
        </button>
      </div>
      <button onClick={remove} className="w-full flex items-center justify-center gap-1 text-[#FF6B6B] text-xs font-semibold">
        <Trash2 size={13} /> Rimuovi dalla classifica
      </button>
    </div>
  );
}

/* =========================== Classifica femminile (con gestione contestuale) =========================== */

function FemaleStandings({
  edition,
  championshipName,
  isAdmin,
  showToast,
}: {
  edition: ChampionshipEdition;
  championshipName: string;
  isAdmin: boolean;
  showToast: (msg: string) => void;
}) {
  const { appUser } = useAuth();
  const canShareAsResultManager = appUser?.role === "resultManager";
  const editionId = edition.id;
  const { data: participants } = useCollection<FemaleParticipant>(
    "femaleParticipants",
    [where("editionId", "==", editionId)],
    [editionId]
  );
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showLive, setShowLive] = useState(false);
  const [recalcPreview, setRecalcPreview] = useState<{ id: string; name: string; from: number; to: number }[] | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const isFrozen = edition.status === "conclusa" && !!edition.frozenStandings;

  const rows = [...participants].sort(compareStandingRows);

  const openRecalcPreview = () => {
    const changes = rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        from: r.points,
        to: (r.calculatedPoints ?? r.points) + (r.manualPointsAdjustment ?? 0),
      }))
      .filter((c) => c.from !== c.to);
    if (changes.length === 0) {
      showToast("La classifica è già aggiornata: nessuna modifica da applicare.");
      return;
    }
    setRecalcPreview(changes);
  };

  const confirmRecalc = async () => {
    if (!recalcPreview || recalcPreview.length === 0) return;
    setRecalculating(true);
    try {
      await recalculateFemaleParticipants(editionId, recalcPreview.map((change) => ({ participantId: change.id, points: change.to })));
      showToast("Classifica ricalcolata.");
      setRecalcPreview(null);
    } catch (err) {
      console.error(err);
      showToast("Errore nel ricalcolo.");
    } finally {
      setRecalculating(false);
    }
  };

  if (isFrozen && !showLive) {
    const frozenRows = edition.frozenStandings!;
    const frozenShareRows = frozenRows.map((r, i) => ({
      position: i + 1,
      name: r.name,
      points: r.points,
      stages: r.stages ?? 0,
      status: r.status,
    }));
    return (
      <div>
        <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl overflow-hidden">
          <div className="flex items-center px-3.5 py-2.5 text-xs font-bold text-[rgba(251,243,222,0.58)] border-b border-[rgba(251,243,222,0.08)]">
            <span className="w-6">#</span>
            <span className="flex-1">Giocatrice</span>
            <span className="w-14 text-center">Tappe</span>
            <span className="w-12 text-center">Pt</span>
          </div>
          {frozenRows.map((r, i) => (
            <div key={r.id} className="flex items-center px-3.5 py-2.5 text-[13px] border-b border-[rgba(251,243,222,0.08)] last:border-b-0">
              <span className="w-6 flex items-center justify-center shrink-0">
                {i < 3 ? (
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold"
                    style={{ background: RANK_COLORS[i].bg, color: RANK_COLORS[i].text }}
                  >
                    {i + 1}
                  </span>
                ) : (
                  <span className="text-[rgba(251,243,222,0.50)]">{i + 1}</span>
                )}
              </span>
              <span className="flex-1 font-semibold truncate">{r.name}</span>
              <span className="w-14 text-center">{r.stages ?? "—"}</span>
              <span className="w-12 text-center">
                {r.status === "normale" ? (
                  <span className="font-display text-[15px] text-[#BBFF5E]">{r.points}</span>
                ) : (
                  <span className="text-[11px] font-bold text-[#FF9B6B]">{r.status === "ritirata" ? "Rit." : "Sq."}</span>
                )}
              </span>
            </div>
          ))}
          {frozenRows.length === 0 && (
            <p className="px-3.5 py-2.5 text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessuna giocatrice ancora.</p>
          )}
        </div>
        {canShareAsResultManager && (
          <div className="mt-3">
            <StandingsShareButton
              input={{ categoryName: championshipName, season: edition.season, kind: "female", rows: frozenShareRows }}
              showToast={showToast}
            />
          </div>
        )}
        {isAdmin && (
          <div className="mt-3 flex flex-col gap-2 items-start">
            <StandingsShareButton
              input={{ categoryName: championshipName, season: edition.season, kind: "female", rows: frozenShareRows }}
              showToast={showToast}
            />
            <button onClick={() => setShowLive(true)} className="flex items-center gap-1 text-xs text-[rgba(251,243,222,0.50)]">
              <Lock size={11} /> Correggi dati e ricongela
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {isFrozen && isAdmin && (
        <button onClick={() => setShowLive(false)} className="mb-2 flex items-center gap-1 text-xs text-[#BBFF5E] font-semibold">
          <Lock size={11} /> Torna alla classifica congelata
        </button>
      )}
      <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl overflow-hidden">
        <div className="flex items-center px-3.5 py-2.5 text-xs font-bold text-[rgba(251,243,222,0.58)] border-b border-[rgba(251,243,222,0.08)]">
          <span className="w-6">#</span>
          <span className="flex-1">Giocatrice</span>
          <span className="w-14 text-center">Tappe</span>
          <span className="w-12 text-center">Pt</span>
          {isAdmin && <span className="w-16" />}
        </div>
        {rows.map((r, i) =>
          editingId === r.id ? (
            <FemaleEditRow key={r.id} participant={r} onCancel={() => setEditingId(null)} onDone={showToast} />
          ) : (
            <div key={r.id} className="flex items-center px-3.5 py-2.5 text-[13px] border-b border-[rgba(251,243,222,0.08)] last:border-b-0">
              <span className="w-6 flex items-center justify-center shrink-0">
                {i < 3 ? (
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold"
                    style={{ background: RANK_COLORS[i].bg, color: RANK_COLORS[i].text }}
                  >
                    {i + 1}
                  </span>
                ) : (
                  <span className="text-[rgba(251,243,222,0.50)]">{i + 1}</span>
                )}
              </span>
              <span className="flex-1 font-semibold">{r.name}</span>
              <span className="w-14 text-center">{r.stages}</span>
              <span className="w-12 text-center">
                {r.status === "normale" ? (
                  <span className="font-display text-[15px] text-[#BBFF5E]">{r.points}</span>
                ) : (
                  <span className="text-[11px] font-bold text-[#FF9B6B]">{r.status === "ritirata" ? "Rit." : "Sq."}</span>
                )}
              </span>
              {isAdmin && (
                <button onClick={() => setEditingId(r.id)} className="w-16 text-[#BBFF5E] text-xs font-semibold text-right">
                  Modifica
                </button>
              )}
            </div>
          )
        )}
        {rows.length === 0 && <p className="px-3.5 py-2.5 text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessuna giocatrice ancora.</p>}
      </div>

      {canShareAsResultManager && (
        <div className="mt-3">
          <StandingsShareButton
            input={{
              categoryName: championshipName,
              season: edition.season,
              kind: "female",
              rows: rows.map((r, i) => ({
                position: i + 1,
                name: r.name,
                points: r.points,
                stages: r.stages,
                status: r.status,
              })),
            }}
            showToast={showToast}
          />
        </div>
      )}
      {isAdmin && (
        <div className="mt-3 flex flex-col gap-2 items-start">
          <StandingsShareButton
            input={{
              categoryName: championshipName,
              season: edition.season,
              kind: "female",
              rows: rows.map((r, i) => ({
                position: i + 1,
                name: r.name,
                points: r.points,
                stages: r.stages,
                status: r.status,
              })),
            }}
            showToast={showToast}
          />

          {showAdd ? (
            <AddFemaleParticipant
              editionId={editionId}
              onDone={(msg) => {
                showToast(msg);
                setShowAdd(false);
              }}
              onCancel={() => setShowAdd(false)}
            />
          ) : (
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#BBFF5E]">
              <Plus size={15} /> Aggiungi giocatrice
            </button>
          )}

          {showImport ? (
            <ImportFemaleParticipants
              editionId={editionId}
              existing={participants}
              onDone={(msg) => {
                showToast(msg);
                setShowImport(false);
              }}
              onCancel={() => setShowImport(false)}
            />
          ) : (
            <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#BBFF5E]">
              <Upload size={15} /> Incolla classifica da Excel o Word
            </button>
          )}

          {recalcPreview ? (
            <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5 w-full">
              <p className="text-[13px] font-bold mb-2">Ricalcola classifica</p>
              <div className="flex flex-col gap-1 mb-3 text-[12.5px]">
                {recalcPreview.map((c) => (
                  <p key={c.id}>
                    <strong>{c.name}</strong>: da {c.from} a {c.to} punti
                  </p>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmRecalc}
                  disabled={recalculating}
                  className="flex-1 bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
                >
                  {recalculating ? "Ricalcolo in corso..." : "Conferma ricalcolo"}
                </button>
                <button
                  onClick={() => setRecalcPreview(null)}
                  className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2.5 text-sm font-semibold"
                >
                  Annulla
                </button>
              </div>
            </div>
          ) : (
            <button onClick={openRecalcPreview} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#BBFF5E]">
              <RefreshCw size={15} /> Ricalcola classifica
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AddFemaleParticipant({
  editionId,
  onDone,
  onCancel,
}: {
  editionId: string;
  onDone: (msg: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createFemaleParticipant(editionId, name.trim());
      onDone(`Giocatrice "${name}" aggiunta.`);
    } catch (err) {
      console.error(err);
      onDone("Errore nell'aggiunta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold">Aggiungi giocatrice</p>
        <button onClick={onCancel}><X size={16} className="text-[rgba(251,243,222,0.50)]" /></button>
      </div>
      <input
        placeholder="Nome giocatrice"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <button onClick={submit} disabled={saving} className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50">
        {saving ? "In corso..." : "Aggiungi"}
      </button>
    </div>
  );
}

function ImportFemaleParticipants({
  editionId,
  existing,
  onDone,
  onCancel,
}: {
  editionId: string;
  existing: FemaleParticipant[];
  onDone: (msg: string) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<1 | 2 | 3>(existing.length === 0 ? 1 : 3);
  const [mode2AbsentPolicy, setMode2AbsentPolicy] = useState<"keep" | "retire" | "remove">("keep");
  const [text, setText] = useState("");
  const [duplicateError, setDuplicateError] = useState<string[] | null>(null);
  const [ambiguousRows, setAmbiguousRows] = useState<
    { index: number; name: string; points: number; stages: number; similarId: string; similarName: string }[] | null
  >(null);
  const [ambiguousChoices, setAmbiguousChoices] = useState<Record<number, "link" | "create" | "ignore">>({});
  const [preview, setPreview] = useState<{
    rows: ImportFemaleRow[];
    matchedCount: number;
    newCount: number;
    ignoredCount: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = existing.map((e) => ({ id: e.id, name: e.name }));

  /**
   * Fase 3/13 — stessa logica del riconoscimento nomi simili già usata per le squadre:
   * corrispondenza esatta (nessuna azione), simile-ma-non-esatta (richiede scelta
   * esplicita), nessuna corrispondenza (nuova voce, nessuna ambiguità).
   */
  const analyze = () => {
    setError(null);
    const { rows: parsedRows } = parsePastedTable(text);
    if (parsedRows.length === 0) {
      setError("Nessuna riga riconosciuta nel testo incollato.");
      return;
    }
    const duplicates = findDuplicateImportedNames(parsedRows.map((r) => r.name));
    if (duplicates.length > 0) {
      setDuplicateError(duplicates);
      setPreview(null);
      setAmbiguousRows(null);
      return;
    }
    setDuplicateError(null);

    const ambiguous: { index: number; name: string; points: number; stages: number; similarId: string; similarName: string }[] = [];
    parsedRows.forEach((row, index) => {
      const match = matchTeamName(row.name, candidates);
      if (match.kind === "similar") {
        ambiguous.push({
          index,
          name: row.name,
          points: row.num1,
          stages: row.num2,
          similarId: match.candidate.id,
          similarName: match.candidate.name,
        });
      }
    });

    if (ambiguous.length > 0) {
      setAmbiguousRows(ambiguous);
      setAmbiguousChoices({});
      setPreview(null);
      return;
    }
    buildPreview(parsedRows, {});
  };

  const buildPreview = (
    parsedRows: { name: string; num1: number; num2: number }[],
    resolutions: Record<number, "link" | "create" | "ignore">
  ) => {
    const finalRows: ImportFemaleRow[] = [];
    let matchedCount = 0;
    let newCount = 0;
    let ignoredCount = 0;

    parsedRows.forEach((row, index) => {
      const choice = resolutions[index];
      if (choice === "ignore") {
        ignoredCount++;
        return;
      }
      if (choice === "create") {
        finalRows.push({ name: row.name, points: row.num1, stages: row.num2, createNew: true });
        newCount++;
        return;
      }
      const match = matchTeamName(row.name, candidates);
      if (choice === "link" && match.kind === "similar") {
        finalRows.push({ name: row.name, points: row.num1, stages: row.num2, linkedParticipantId: match.candidate.id });
        matchedCount++;
        return;
      }
      if (match.kind === "exact") {
        finalRows.push({ name: row.name, points: row.num1, stages: row.num2, linkedParticipantId: match.candidate.id });
        matchedCount++;
        return;
      }
      finalRows.push({ name: row.name, points: row.num1, stages: row.num2, createNew: true });
      newCount++;
    });

    setPreview({ rows: finalRows, matchedCount, newCount, ignoredCount });
    setAmbiguousRows(null);
  };

  const confirmAmbiguousChoices = () => {
    if (!ambiguousRows) return;
    if (!ambiguousRows.every((r) => ambiguousChoices[r.index])) {
      setError("Scegli un'azione per ogni riga simile prima di continuare.");
      return;
    }
    setError(null);
    const { rows: parsedRows } = parsePastedTable(text);
    buildPreview(parsedRows, ambiguousChoices);
  };

  const missingFromText = existing.filter((e) => !preview?.rows.some((r) => r.linkedParticipantId === e.id));

  const confirm = async () => {
    if (!preview) return;
    setSaving(true);
    setError(null);
    try {
      const result = await importFemaleStandings({
        editionId,
        mode,
        mode2AbsentPolicy: mode === 2 ? mode2AbsentPolicy : undefined,
        rows: preview.rows,
      });
      const parts = [`${result.matchedCount} aggiornate, ${result.createdCount} create`];
      if (result.retiredCount) parts.push(`${result.retiredCount} contrassegnate come ritirate`);
      if (result.removedCount) parts.push(`${result.removedCount} rimosse`);
      onDone(`Importazione completata: ${parts.join(", ")}.`);
    } catch (err) {
      console.error(err);
      const msg = err instanceof StandingsApiError ? err.message : "Errore durante l'importazione.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl p-3.5 w-full">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold">Importa classifica (incolla da Excel/Word)</p>
        <button onClick={onCancel}><X size={16} className="text-[rgba(251,243,222,0.50)]" /></button>
      </div>

      {!ambiguousRows && !preview && (
        <>
          <p className="text-[12px] text-[rgba(251,243,222,0.50)] mb-2">Scegli la modalità di importazione:</p>
          <div className="flex flex-col gap-1.5 mb-3">
            <label className="flex items-start gap-2 text-[12.5px]">
              <input type="radio" checked={mode === 1} onChange={() => setMode(1)} className="mt-0.5" disabled={existing.length > 0} />
              <span><strong>Importazione iniziale</strong> — solo se la classifica non esiste ancora {existing.length > 0 && "(non disponibile: ci sono già giocatrici)"}</span>
            </label>
            <label className="flex items-start gap-2 text-[12.5px]">
              <input type="radio" checked={mode === 2} onChange={() => setMode(2)} className="mt-0.5" />
              <span><strong>Sostituzione completa</strong> — il file rappresenta l'intera classifica di oggi.</span>
            </label>
            {mode === 2 && (
              <div className="ml-5 flex flex-col gap-1.5 mb-1 pl-2 border-l border-[rgba(251,243,222,0.18)]">
                <p className="text-[11.5px] text-[rgba(251,243,222,0.58)]">Le giocatrici assenti dal file:</p>
                <label className="flex items-center gap-2 text-[12px]">
                  <input type="radio" checked={mode2AbsentPolicy === "keep"} onChange={() => setMode2AbsentPolicy("keep")} /> restano invariate, in fondo
                </label>
                <label className="flex items-center gap-2 text-[12px]">
                  <input type="radio" checked={mode2AbsentPolicy === "retire"} onChange={() => setMode2AbsentPolicy("retire")} /> vengono contrassegnate come ritirate
                </label>
                <label className="flex items-center gap-2 text-[12px]">
                  <input type="radio" checked={mode2AbsentPolicy === "remove"} onChange={() => setMode2AbsentPolicy("remove")} /> vengono rimosse dall'edizione
                </label>
              </div>
            )}
            <label className="flex items-start gap-2 text-[12.5px]">
              <input type="radio" checked={mode === 3} onChange={() => setMode(3)} className="mt-0.5" />
              <span><strong>Aggiornamento parziale</strong> — aggiorna solo le giocatrici presenti nel testo, le altre restano invariate.</span>
            </label>
          </div>
          <p className="text-[12px] text-[rgba(251,243,222,0.50)] mb-2">
            Copia le righe da Excel o da una tabella Word e incollale qui sotto. Ogni riga deve contenere il nome
            della giocatrice seguito da <strong>Punti</strong> e <strong>Tappe disputate</strong> (in quest'ordine).
          </p>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDuplicateError(null);
            }}
            placeholder={"Gabriella Schino\t19\t4\nFrancesca Boccardi\t16\t4\n..."}
            className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2 min-h-[120px] font-mono"
          />
          {duplicateError && (
            <p className="text-[12px] text-[#FF6B6B] mb-2">
              Righe duplicate nel file (sembrano la stessa giocatrice): {duplicateError.join(", ")}.
            </p>
          )}
          {error && <p className="text-[12px] text-[#FF6B6B] mb-2">{error}</p>}
          <button
            onClick={analyze}
            disabled={!text.trim()}
            className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
          >
            Analizza
          </button>
        </>
      )}

      {ambiguousRows && (
        <div>
          <p className="text-[12.5px] font-semibold mb-2">
            Alcuni nomi somigliano a giocatrici già esistenti. Conferma cosa fare per ciascuno:
          </p>
          <div className="flex flex-col gap-3 mb-3">
            {ambiguousRows.map((r) => (
              <div key={r.index} className="bg-[#123008] rounded-lg p-2.5">
                <p className="text-[12.5px] mb-1.5">
                  <strong>"{r.name}"</strong> potrebbe corrispondere a <strong>"{r.similarName}"</strong>
                </p>
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-2 text-[12px]">
                    <input type="radio" name={`fchoice-${r.index}`} checked={ambiguousChoices[r.index] === "link"} onChange={() => setAmbiguousChoices((p) => ({ ...p, [r.index]: "link" }))} />
                    Collega alla giocatrice esistente "{r.similarName}"
                  </label>
                  <label className="flex items-center gap-2 text-[12px]">
                    <input type="radio" name={`fchoice-${r.index}`} checked={ambiguousChoices[r.index] === "create"} onChange={() => setAmbiguousChoices((p) => ({ ...p, [r.index]: "create" }))} />
                    Crea una nuova voce comunque
                  </label>
                  <label className="flex items-center gap-2 text-[12px]">
                    <input type="radio" name={`fchoice-${r.index}`} checked={ambiguousChoices[r.index] === "ignore"} onChange={() => setAmbiguousChoices((p) => ({ ...p, [r.index]: "ignore" }))} />
                    Ignora questa riga
                  </label>
                </div>
              </div>
            ))}
          </div>
          {error && <p className="text-[12px] text-[#FF6B6B] mb-2">{error}</p>}
          <div className="flex gap-2">
            <button onClick={confirmAmbiguousChoices} className="flex-1 bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold">
              Continua
            </button>
            <button onClick={() => setAmbiguousRows(null)} className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2.5 text-sm font-semibold">
              Modifica testo
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div>
          <div className="bg-[#123008] rounded-lg p-2.5 mb-2 text-[12.5px]">
            <p className="mb-1">
              <strong>{preview.matchedCount}</strong> giocatrici verranno aggiornate,{" "}
              <strong>{preview.newCount}</strong> verranno create come nuove.
            </p>
            {preview.ignoredCount > 0 && <p className="mb-1">{preview.ignoredCount} riga/righe ignorate su tua scelta.</p>}
            {mode !== 2 && missingFromText.length > 0 && (
              <p className="text-[rgba(251,243,222,0.50)]">
                Non presenti nel testo (manterranno i dati attuali): {missingFromText.map((m) => m.name).join(", ")}
              </p>
            )}
            {mode === 2 && missingFromText.length > 0 && (
              <p className="text-[rgba(251,243,222,0.50)]">
                Assenti dal testo ({mode2AbsentPolicy === "keep" ? "resteranno invariate" : mode2AbsentPolicy === "retire" ? "diventeranno ritirate" : "verranno rimosse"}):{" "}
                {missingFromText.map((m) => m.name).join(", ")}
              </p>
            )}
          </div>
          {error && <p className="text-[12px] text-[#FF6B6B] mb-2">{error}</p>}
          <div className="flex gap-2">
            <button onClick={confirm} disabled={saving} className="flex-1 bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50">
              {saving ? "Importazione in corso..." : "Conferma importazione"}
            </button>
            <button onClick={() => setPreview(null)} className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2.5 text-sm font-semibold">
              Modifica testo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function FemaleEditRow({
  participant,
  onCancel,
  onDone,
}: {
  participant: FemaleParticipant;
  onCancel: () => void;
  onDone: (msg: string) => void;
}) {
  const [name, setName] = useState(participant.name);
  const [calculatedPoints, setCalculatedPoints] = useState(String(participant.calculatedPoints ?? participant.points));
  const [manualAdjustment, setManualAdjustment] = useState(String(participant.manualPointsAdjustment ?? 0));
  const [stages, setStages] = useState(String(participant.stages));
  const [order, setOrder] = useState(String(participant.order ?? 0));
  const [status, setStatus] = useState<ParticipationStatus>(participant.status);
  const [saving, setSaving] = useState(false);

  const finalPoints = (Number(calculatedPoints) || 0) + (Number(manualAdjustment) || 0);

  const save = async () => {
    setSaving(true);
    try {
      await updateFemaleParticipant({
        participantId: participant.id,
        editionId: participant.editionId,
        name: name.trim(),
        calculatedPoints: Number(calculatedPoints) || 0,
        manualPointsAdjustment: Number(manualAdjustment) || 0,
        stages: Number(stages) || 0,
        order: Number(order) || 0,
        status,
      });
      onDone("Dati aggiornati.");
      onCancel();
    } catch (err) {
      console.error(err);
      onDone("Errore nel salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete(participant.name)) return;
    try {
      await deleteFemaleParticipant(participant.editionId, participant.id);
      onDone("Giocatrice eliminata.");
      onCancel();
    } catch (err) {
      console.error(err);
      onDone("Errore nell'eliminazione.");
    }
  };

  return (
    <div className="px-3.5 py-3 border-b border-[rgba(251,243,222,0.08)] last:border-b-0 bg-[#123008]">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm mb-2"
      />
      <div className="flex gap-2 mb-2">
        <div className="flex-1">
          <p className="text-[11px] text-[rgba(251,243,222,0.50)] mb-1">Tappe</p>
          <input type="number" value={stages} onChange={(e) => setStages(e.target.value)} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] text-[rgba(251,243,222,0.50)] mb-1">Punti calcolati</p>
          <input type="number" value={calculatedPoints} onChange={(e) => setCalculatedPoints(e.target.value)} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] text-[rgba(251,243,222,0.50)] mb-1">Correzione (+/-)</p>
          <input type="number" value={manualAdjustment} onChange={(e) => setManualAdjustment(e.target.value)} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="flex gap-2 mb-2">
        <div className="w-20">
          <p className="text-[11px] text-[rgba(251,243,222,0.50)] mb-1">Ordine</p>
          <input type="number" value={order} onChange={(e) => setOrder(e.target.value)} className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <p className="text-[12px] text-[rgba(251,243,222,0.58)] mb-2">
        Punti finali: <span className="font-display text-[15px] text-[#BBFF5E]">{finalPoints}</span>
      </p>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as ParticipationStatus)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2"
      >
        <option value="normale">Normale</option>
        <option value="ritirata">Ritirata</option>
        <option value="squalificata">Squalificata</option>
      </select>
      <div className="flex gap-2 mb-2">
        <button onClick={save} disabled={saving} className="flex-1 bg-lime text-[#081208] rounded-lg py-2 text-sm font-bold disabled:opacity-50">
          Salva
        </button>
        <button onClick={onCancel} className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2 text-sm font-semibold">
          Annulla
        </button>
      </div>
      <button onClick={remove} className="w-full flex items-center justify-center gap-1 text-[#FF6B6B] text-xs font-semibold">
        <Trash2 size={13} /> Elimina giocatrice
      </button>
    </div>
  );
}
