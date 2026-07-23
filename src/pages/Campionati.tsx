import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { addDoc, collection, deleteDoc, doc, setDoc, updateDoc, where } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import { Plus, Pencil, Trash2, Settings, X } from "lucide-react";
import type {
  ChampionshipEdition,
  ChampionshipType,
  EditionStatus,
  EditionTeam,
  FemaleParticipant,
  ParticipationStatus,
  Team,
} from "../types";
import { ChampionshipTypeManagement, TeamManagement } from "../components/ChampionshipManagement";

function confirmDelete(label: string) {
  return window.confirm(`Eliminare definitivamente "${label}"? L'operazione non si può annullare.`);
}

export function CampionatiPage() {
  const { editionId } = useParams();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";

  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const { data: editions } = useCollection<ChampionshipEdition>("championshipEditions");

  const [showNewEdition, setShowNewEdition] = useState(false);
  const [showTypeSettings, setShowTypeSettings] = useState(false);
  const [showTeamSettings, setShowTeamSettings] = useState(false);
  const [editingEdition, setEditingEdition] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const selected = editionId ?? editions[0]?.id;
  const edition = editions.find((e) => e.id === selected);
  const type = edition && types.find((t) => t.id === edition.typeId);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold">Campionati</h2>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTeamSettings((v) => !v)}
              className="flex items-center gap-1 text-xs text-[#7A7A75]"
            >
              <Settings size={14} /> Squadre
            </button>
            <button
              onClick={() => setShowTypeSettings((v) => !v)}
              className="flex items-center gap-1 text-xs text-[#7A7A75]"
            >
              <Settings size={14} /> Tipologie
            </button>
          </div>
        )}
      </div>

      {showTeamSettings && (
        <div className="mb-4 bg-white border border-[#EAE7DD] rounded-xl p-3.5">
          <TeamManagement onDone={showToast} />
        </div>
      )}

      {showTypeSettings && (
        <div className="mb-4 bg-white border border-[#EAE7DD] rounded-xl p-3.5">
          <ChampionshipTypeManagement onDone={showToast} />
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {editions.map((e) => {
          const t = types.find((x) => x.id === e.typeId);
          const isSel = e.id === selected;
          return (
            <button
              key={e.id}
              onClick={() => {
                navigate(`/campionati/${e.id}`);
                setEditingEdition(false);
              }}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-semibold shrink-0 ${
                isSel ? "bg-court text-white" : "bg-[#F1EFE8] text-[#3A3A36]"
              }`}
            >
              {t?.name} {e.season}
            </button>
          );
        })}
        {isAdmin && (
          <button
            onClick={() => setShowNewEdition((v) => !v)}
            className="rounded-full px-3 py-2 text-[12.5px] font-semibold shrink-0 border border-dashed border-[#B9B6AC] text-[#7A7A75] flex items-center gap-1"
          >
            <Plus size={14} /> Nuova edizione
          </button>
        )}
      </div>

      {showNewEdition && isAdmin && (
        <NewEditionForm
          types={types}
          onDone={(msg, newId) => {
            showToast(msg);
            setShowNewEdition(false);
            if (newId) navigate(`/campionati/${newId}`);
          }}
          onCancel={() => setShowNewEdition(false)}
        />
      )}

      {edition && type && (
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
              <p className="text-[13px] text-[#7A7A75]">
                {edition.status === "attiva" ? "Attiva" : edition.status === "conclusa" ? "Conclusa" : edition.status === "nascosta" ? "Nascosta" : "Bozza"}
              </p>
              {isAdmin && (
                <button onClick={() => setEditingEdition(true)} className="flex items-center gap-1 text-xs text-court font-semibold">
                  <Pencil size={13} /> Modifica edizione
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {edition && type?.hasTeams && <TeamStandings editionId={edition.id} isAdmin={isAdmin} showToast={showToast} />}
      {edition && type && !type.hasTeams && (
        <FemaleStandings editionId={edition.id} isAdmin={isAdmin} showToast={showToast} />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1A1A18] text-white px-4 py-2.5 rounded-full text-[12.5px] max-w-[90%] text-center z-20">
          {toast}
        </div>
      )}
    </div>
  );
}

/* =========================== Creazione / modifica edizione =========================== */

function NewEditionForm({
  types,
  onDone,
  onCancel,
}: {
  types: ChampionshipType[];
  onDone: (msg: string, newId?: string) => void;
  onCancel: () => void;
}) {
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [season, setSeason] = useState("");
  const [status, setStatus] = useState<EditionStatus>("bozza");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!typeId || !season.trim()) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "championshipEditions"), {
        typeId,
        season: season.trim(),
        status,
      });
      onDone("Edizione creata.", ref.id);
    } catch (err) {
      console.error(err);
      onDone("Errore nella creazione dell'edizione.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 bg-white border border-[#EAE7DD] rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold">Nuova edizione</p>
        <button onClick={onCancel}><X size={16} className="text-[#9A9A94]" /></button>
      </div>
      <select
        value={typeId}
        onChange={(e) => setTypeId(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-[13px] bg-white mb-2"
      >
        {types.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <input
        placeholder="Stagione (es. 2025/2026 oppure 2026)"
        value={season}
        onChange={(e) => setSeason(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as EditionStatus)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-[13px] bg-white mb-2"
      >
        <option value="bozza">Bozza</option>
        <option value="attiva">Attiva</option>
        <option value="conclusa">Conclusa</option>
        <option value="nascosta">Nascosta</option>
      </select>
      <button
        onClick={create}
        disabled={saving || !season.trim()}
        className="w-full bg-court text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
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
      await updateDoc(doc(db, "championshipEditions", edition.id), { typeId, season: season.trim(), status });
      onDone("Edizione aggiornata.");
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
      await deleteDoc(doc(db, "championshipEditions", edition.id));
      onDelete();
    } catch (err) {
      console.error(err);
      onDone("Errore nell'eliminazione.");
    }
  };

  return (
    <div className="bg-white border border-[#EAE7DD] rounded-xl p-3.5">
      <select
        value={typeId}
        onChange={(e) => setTypeId(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-[13px] bg-white mb-2"
      >
        {types.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <input
        value={season}
        onChange={(e) => setSeason(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-sm mb-2"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as EditionStatus)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-[13px] bg-white mb-2"
      >
        <option value="bozza">Bozza</option>
        <option value="attiva">Attiva</option>
        <option value="conclusa">Conclusa</option>
        <option value="nascosta">Nascosta</option>
      </select>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="flex-1 bg-court text-white rounded-lg py-2 text-sm font-bold disabled:opacity-50">
          Salva
        </button>
        <button onClick={onCancel} className="flex-1 border border-[#E5E3DC] rounded-lg py-2 text-sm font-semibold">
          Annulla
        </button>
      </div>
      <button onClick={remove} className="w-full text-red-600 text-xs font-semibold mt-2">
        Elimina questa edizione
      </button>
    </div>
  );
}

/* =========================== Classifica squadre (con gestione contestuale) =========================== */

function TeamStandings({
  editionId,
  isAdmin,
  showToast,
}: {
  editionId: string;
  isAdmin: boolean;
  showToast: (msg: string) => void;
}) {
  const { data: editionTeams } = useCollection<EditionTeam>("editionTeams", [where("editionId", "==", editionId)]);
  const { data: teams } = useCollection<Team>("teams");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const rows = editionTeams
    .map((et) => ({ ...et, team: teams.find((t) => t.id === et.teamId) }))
    .sort((a, b) => {
      const aOut = a.status !== "normale";
      const bOut = b.status !== "normale";
      if (aOut !== bOut) return aOut ? 1 : -1;
      if (b.points !== a.points) return b.points - a.points;
      return a.order - b.order;
    });

  const availableTeams = teams.filter((t) => !editionTeams.some((et) => et.teamId === t.id));

  return (
    <div>
      <div className="bg-white border border-[#EAE7DD] rounded-xl overflow-hidden">
        <div className="flex items-center px-3.5 py-2.5 text-xs font-bold text-[#7A7A75] border-b border-[#F1EFE8]">
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
              label={r.team?.name ?? ""}
              onCancel={() => setEditingId(null)}
              onDone={showToast}
            />
          ) : (
            <div key={r.id} className="flex items-center px-3.5 py-2.5 text-[13px] border-b border-[#F1EFE8] last:border-b-0">
              <span className="w-6 text-[#9A9A94]">{i + 1}</span>
              <span className="flex-1 font-semibold">{r.team?.name}</span>
              <span className="w-10 text-center">{r.played}</span>
              <span className="w-14 text-center font-bold">
                {r.status === "normale" ? r.points : (
                  <span className="text-[11px] font-bold text-[#993C1D]">
                    {r.status === "ritirata" ? "Ritirata" : "Squalificata"}
                  </span>
                )}
              </span>
              {isAdmin && (
                <button onClick={() => setEditingId(r.id)} className="w-16 text-court text-xs font-semibold text-right">
                  Modifica
                </button>
              )}
            </div>
          )
        )}
        {rows.length === 0 && <p className="px-3.5 py-2.5 text-[12.5px] text-[#9A9A94]">Nessuna squadra iscritta.</p>}
      </div>

      {isAdmin && (
        <div className="mt-3">
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
              className="flex items-center gap-1.5 text-[13px] font-semibold text-court"
            >
              <Plus size={15} /> Aggiungi squadra a questa classifica
            </button>
          )}
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

  const linkExisting = async (finalTeamId: string) => {
    const id = `${editionId}_${finalTeamId}`;
    await setDoc(doc(db, "editionTeams", id), {
      id,
      editionId,
      teamId: finalTeamId,
      points: 0,
      played: 0,
      order: 0,
      status: "normale",
    });
  };

  const submit = async () => {
    setSaving(true);
    try {
      if (mode === "existing") {
        if (!teamId) return;
        await linkExisting(teamId);
        onDone("Squadra aggiunta alla classifica.");
      } else {
        const roster = rosterText.split(",").map((s) => s.trim()).filter(Boolean);
        if (!name.trim() || roster.length < 2 || roster.length > 6) {
          onDone("Inserisci un nome e una rosa da 2 a 6 giocatori.");
          setSaving(false);
          return;
        }
        const ref = await addDoc(collection(db, "teams"), { name: name.trim(), roster });
        await linkExisting(ref.id);
        onDone(`Squadra "${name}" creata e aggiunta.`);
      }
    } catch (err) {
      console.error(err);
      onDone("Errore nell'operazione.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-[#EAE7DD] rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold">Aggiungi squadra</p>
        <button onClick={onCancel}><X size={16} className="text-[#9A9A94]" /></button>
      </div>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setMode("existing")}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold ${mode === "existing" ? "bg-court text-white" : "bg-[#F1EFE8] text-[#3A3A36]"}`}
        >
          Squadra esistente
        </button>
        <button
          onClick={() => setMode("new")}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold ${mode === "new" ? "bg-court text-white" : "bg-[#F1EFE8] text-[#3A3A36]"}`}
        >
          Nuova squadra
        </button>
      </div>
      {mode === "existing" ? (
        availableTeams.length === 0 ? (
          <p className="text-[12.5px] text-[#9A9A94] mb-2">Tutte le squadre esistenti sono già iscritte. Creane una nuova.</p>
        ) : (
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-[13px] bg-white mb-2"
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
            className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2.5 text-sm mb-2"
          />
          <input
            placeholder="Giocatori separati da virgola (min 2, max 6)"
            value={rosterText}
            onChange={(e) => setRosterText(e.target.value)}
            className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2.5 text-sm mb-2"
          />
        </>
      )}
      <button
        onClick={submit}
        disabled={saving}
        className="w-full bg-court text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
      >
        {saving ? "In corso..." : "Aggiungi"}
      </button>
    </div>
  );
}

function EditionTeamEditRow({
  editionTeam,
  label,
  onCancel,
  onDone,
}: {
  editionTeam: EditionTeam;
  label: string;
  onCancel: () => void;
  onDone: (msg: string) => void;
}) {
  const [points, setPoints] = useState(String(editionTeam.points));
  const [played, setPlayed] = useState(String(editionTeam.played));
  const [order, setOrder] = useState(String(editionTeam.order));
  const [status, setStatus] = useState<ParticipationStatus>(editionTeam.status);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "editionTeams", editionTeam.id), {
        points: Number(points) || 0,
        played: Number(played) || 0,
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
    if (!confirmDelete(label)) return;
    try {
      await deleteDoc(doc(db, "editionTeams", editionTeam.id));
      onDone("Squadra rimossa dalla classifica.");
      onCancel();
    } catch (err) {
      console.error(err);
      onDone("Errore nella rimozione.");
    }
  };

  return (
    <div className="px-3.5 py-3 border-b border-[#F1EFE8] last:border-b-0 bg-[#FAF8F3]">
      <p className="text-[12.5px] font-semibold mb-2">{label}</p>
      <div className="flex gap-2 mb-2">
        <div className="flex-1">
          <p className="text-[11px] text-[#9A9A94] mb-1">PG</p>
          <input type="number" value={played} onChange={(e) => setPlayed(e.target.value)} className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] text-[#9A9A94] mb-1">Punti</p>
          <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="w-16">
          <p className="text-[11px] text-[#9A9A94] mb-1">Ordine</p>
          <input type="number" value={order} onChange={(e) => setOrder(e.target.value)} className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as ParticipationStatus)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-[13px] bg-white mb-2"
      >
        <option value="normale">Normale</option>
        <option value="ritirata">Ritirata</option>
        <option value="squalificata">Squalificata</option>
      </select>
      <div className="flex gap-2 mb-2">
        <button onClick={save} disabled={saving} className="flex-1 bg-court text-white rounded-lg py-2 text-sm font-bold disabled:opacity-50">
          Salva
        </button>
        <button onClick={onCancel} className="flex-1 border border-[#E5E3DC] rounded-lg py-2 text-sm font-semibold">
          Annulla
        </button>
      </div>
      <button onClick={remove} className="w-full flex items-center justify-center gap-1 text-red-600 text-xs font-semibold">
        <Trash2 size={13} /> Rimuovi dalla classifica
      </button>
    </div>
  );
}

/* =========================== Classifica femminile (con gestione contestuale) =========================== */

function FemaleStandings({
  editionId,
  isAdmin,
  showToast,
}: {
  editionId: string;
  isAdmin: boolean;
  showToast: (msg: string) => void;
}) {
  const { data: participants } = useCollection<FemaleParticipant>("femaleParticipants", [
    where("editionId", "==", editionId),
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const rows = [...participants].sort((a, b) => {
    const aOut = a.status !== "normale";
    const bOut = b.status !== "normale";
    if (aOut !== bOut) return aOut ? 1 : -1;
    return b.points - a.points;
  });

  return (
    <div>
      <div className="bg-white border border-[#EAE7DD] rounded-xl overflow-hidden">
        <div className="flex items-center px-3.5 py-2.5 text-xs font-bold text-[#7A7A75] border-b border-[#F1EFE8]">
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
            <div key={r.id} className="flex items-center px-3.5 py-2.5 text-[13px] border-b border-[#F1EFE8] last:border-b-0">
              <span className="w-6 text-[#9A9A94]">{i + 1}</span>
              <span className="flex-1 font-semibold">{r.name}</span>
              <span className="w-14 text-center">{r.stages}</span>
              <span className="w-12 text-center font-bold">
                {r.status === "normale" ? r.points : (
                  <span className="text-[11px] font-bold text-[#993C1D]">{r.status === "ritirata" ? "Rit." : "Sq."}</span>
                )}
              </span>
              {isAdmin && (
                <button onClick={() => setEditingId(r.id)} className="w-16 text-court text-xs font-semibold text-right">
                  Modifica
                </button>
              )}
            </div>
          )
        )}
        {rows.length === 0 && <p className="px-3.5 py-2.5 text-[12.5px] text-[#9A9A94]">Nessuna giocatrice ancora.</p>}
      </div>

      {isAdmin && (
        <div className="mt-3">
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
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-[13px] font-semibold text-court">
              <Plus size={15} /> Aggiungi giocatrice
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
      await addDoc(collection(db, "femaleParticipants"), {
        editionId,
        name: name.trim(),
        points: 0,
        stages: 0,
        status: "normale",
      });
      onDone(`Giocatrice "${name}" aggiunta.`);
    } catch (err) {
      console.error(err);
      onDone("Errore nell'aggiunta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-[#EAE7DD] rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold">Aggiungi giocatrice</p>
        <button onClick={onCancel}><X size={16} className="text-[#9A9A94]" /></button>
      </div>
      <input
        placeholder="Nome giocatrice"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <button onClick={submit} disabled={saving} className="w-full bg-court text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50">
        {saving ? "In corso..." : "Aggiungi"}
      </button>
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
  const [points, setPoints] = useState(String(participant.points));
  const [stages, setStages] = useState(String(participant.stages));
  const [status, setStatus] = useState<ParticipationStatus>(participant.status);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "femaleParticipants", participant.id), {
        name: name.trim(),
        points: Number(points) || 0,
        stages: Number(stages) || 0,
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
      await deleteDoc(doc(db, "femaleParticipants", participant.id));
      onDone("Giocatrice eliminata.");
      onCancel();
    } catch (err) {
      console.error(err);
      onDone("Errore nell'eliminazione.");
    }
  };

  return (
    <div className="px-3.5 py-3 border-b border-[#F1EFE8] last:border-b-0 bg-[#FAF8F3]">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-sm mb-2"
      />
      <div className="flex gap-2 mb-2">
        <div className="flex-1">
          <p className="text-[11px] text-[#9A9A94] mb-1">Tappe</p>
          <input type="number" value={stages} onChange={(e) => setStages(e.target.value)} className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] text-[#9A9A94] mb-1">Punti</p>
          <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as ParticipationStatus)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-[13px] bg-white mb-2"
      >
        <option value="normale">Normale</option>
        <option value="ritirata">Ritirata</option>
        <option value="squalificata">Squalificata</option>
      </select>
      <div className="flex gap-2 mb-2">
        <button onClick={save} disabled={saving} className="flex-1 bg-court text-white rounded-lg py-2 text-sm font-bold disabled:opacity-50">
          Salva
        </button>
        <button onClick={onCancel} className="flex-1 border border-[#E5E3DC] rounded-lg py-2 text-sm font-semibold">
          Annulla
        </button>
      </div>
      <button onClick={remove} className="w-full flex items-center justify-center gap-1 text-red-600 text-xs font-semibold">
        <Trash2 size={13} /> Elimina giocatrice
      </button>
    </div>
  );
}
