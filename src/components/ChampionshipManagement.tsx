import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { db } from "../firebase";
import type { ChampionshipType, Team } from "../types";
import { BADGE_COLORS } from "../types";

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function confirmDelete(label: string) {
  return window.confirm(`Eliminare definitivamente "${label}"? L'operazione non si può annullare.`);
}

/* =========================== Tipologie di campionato =========================== */

export function ChampionshipTypeManagement({ onDone }: { onDone: (msg: string) => void }) {
  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const [name, setName] = useState("");
  const [hasTeams, setHasTeams] = useState(true);
  const [badgeColor, setBadgeColor] = useState<string>("serie-b");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const badgeOptions = Object.keys(BADGE_COLORS);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const id = slugify(name);
      await setDoc(doc(db, "championshipTypes", id), {
        id,
        name: name.trim(),
        hasTeams,
        badgeColor,
      });
      setName("");
      onDone(`Tipologia "${name}" creata.`);
    } catch (err) {
      console.error(err);
      onDone("Errore nella creazione della tipologia.");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (t: ChampionshipType) => {
    if (!confirmDelete(t.name)) return;
    try {
      await deleteDoc(doc(db, "championshipTypes", t.id));
      onDone(`Tipologia "${t.name}" eliminata.`);
    } catch (err) {
      console.error(err);
      onDone("Errore nell'eliminazione.");
    }
  };

  return (
    <div className="mt-6">
      <p className="text-[13px] font-bold mb-2">Tipologie di campionato</p>
      <div className="bg-white border border-[#EAE7DD] rounded-xl overflow-hidden mb-3">
        {types.map((t) =>
          editingId === t.id ? (
            <EditTypeRow key={t.id} type={t} onCancel={() => setEditingId(null)} onDone={onDone} />
          ) : (
            <div
              key={t.id}
              className="flex items-center justify-between px-3.5 py-2.5 text-[13px] border-b border-[#F1EFE8] last:border-b-0 gap-2"
            >
              <span className="font-semibold flex-1">
                {t.name}{" "}
                <span className="text-[#9A9A94] font-normal">{t.hasTeams ? "· a squadre" : "· individuale"}</span>
              </span>
              <span
                className="text-[10.5px] font-bold px-2 py-1 rounded-full shrink-0"
                style={{ background: BADGE_COLORS[t.badgeColor]?.bg, color: BADGE_COLORS[t.badgeColor]?.text }}
              >
                {BADGE_COLORS[t.badgeColor]?.label}
              </span>
              <button onClick={() => setEditingId(t.id)} className="text-court text-xs font-semibold shrink-0">
                Modifica
              </button>
              <button onClick={() => remove(t)} className="text-red-600 text-xs font-semibold shrink-0">
                Elimina
              </button>
            </div>
          )
        )}
        {types.length === 0 && <p className="px-3.5 py-2.5 text-[12.5px] text-[#9A9A94]">Nessuna tipologia ancora.</p>}
      </div>

      <p className="text-xs text-[#9A9A94] mb-2">
        Crea una nuova tipologia se in futuro serve un campionato diverso da Serie B/C, Principianti, Femminile.
      </p>
      <input
        placeholder="Nome tipologia (es. Serie A, Under 18...)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <label className="flex items-center gap-2 text-[13px] mb-2">
        <input type="checkbox" checked={hasTeams} onChange={(e) => setHasTeams(e.target.checked)} />
        A squadre (disattiva per un campionato individuale come il Femminile)
      </label>
      <select
        value={badgeColor}
        onChange={(e) => setBadgeColor(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-[13px] bg-white mb-2"
      >
        {badgeOptions.map((k) => (
          <option key={k} value={k}>
            Badge {BADGE_COLORS[k].label}
          </option>
        ))}
      </select>
      <button
        onClick={create}
        disabled={creating || !name.trim()}
        className="w-full bg-court text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
      >
        {creating ? "Creazione in corso..." : "Crea tipologia"}
      </button>
    </div>
  );
}

function EditTypeRow({
  type,
  onCancel,
  onDone,
}: {
  type: ChampionshipType;
  onCancel: () => void;
  onDone: (msg: string) => void;
}) {
  const [name, setName] = useState(type.name);
  const [hasTeams, setHasTeams] = useState(type.hasTeams);
  const [badgeColor, setBadgeColor] = useState(type.badgeColor);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "championshipTypes", type.id), { name: name.trim(), hasTeams, badgeColor });
      onDone("Tipologia aggiornata.");
      onCancel();
    } catch (err) {
      console.error(err);
      onDone("Errore nel salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-3.5 py-3 border-b border-[#F1EFE8] last:border-b-0 bg-[#FAF8F3]">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-sm mb-2"
      />
      <label className="flex items-center gap-2 text-[13px] mb-2">
        <input type="checkbox" checked={hasTeams} onChange={(e) => setHasTeams(e.target.checked)} />
        A squadre
      </label>
      <select
        value={badgeColor}
        onChange={(e) => setBadgeColor(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-[13px] bg-white mb-2"
      >
        {Object.keys(BADGE_COLORS).map((k) => (
          <option key={k} value={k}>
            Badge {BADGE_COLORS[k].label}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 bg-court text-white rounded-lg py-2 text-sm font-bold disabled:opacity-50"
        >
          Salva
        </button>
        <button onClick={onCancel} className="flex-1 border border-[#E5E3DC] rounded-lg py-2 text-sm font-semibold">
          Annulla
        </button>
      </div>
    </div>
  );
}


/* =========================== Squadre =========================== */

export function TeamManagement({ onDone }: { onDone: (msg: string) => void }) {
  const { data: teams } = useCollection<Team>("teams");
  const [name, setName] = useState("");
  const [rosterText, setRosterText] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const roster = rosterText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const create = async () => {
    if (!name.trim()) return;
    if (roster.length < 2 || roster.length > 6) {
      onDone("La rosa deve avere tra 2 e 6 nomi (separati da virgola).");
      return;
    }
    setCreating(true);
    try {
      await addDoc(collection(db, "teams"), { name: name.trim(), roster });
      setName("");
      setRosterText("");
      onDone(`Squadra "${name}" creata.`);
    } catch (err) {
      console.error(err);
      onDone("Errore nella creazione della squadra.");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (t: Team) => {
    if (!confirmDelete(t.name)) return;
    try {
      await deleteDoc(doc(db, "teams", t.id));
      onDone(`Squadra "${t.name}" eliminata.`);
    } catch (err) {
      console.error(err);
      onDone("Errore nell'eliminazione.");
    }
  };

  return (
    <div className="mt-6">
      <p className="text-[13px] font-bold mb-2">Squadre</p>
      <div className="bg-white border border-[#EAE7DD] rounded-xl overflow-hidden mb-3 max-h-72 overflow-y-auto">
        {teams.length === 0 && <p className="px-3.5 py-2.5 text-[12.5px] text-[#9A9A94]">Nessuna squadra ancora.</p>}
        {teams.map((t) =>
          editingId === t.id ? (
            <EditTeamRow key={t.id} team={t} onCancel={() => setEditingId(null)} onDone={onDone} />
          ) : (
            <div key={t.id} className="px-3.5 py-2.5 text-[13px] border-b border-[#F1EFE8] last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold flex-1">{t.name}</p>
                <button onClick={() => setEditingId(t.id)} className="text-court text-xs font-semibold shrink-0">
                  Modifica
                </button>
                <button onClick={() => remove(t)} className="text-red-600 text-xs font-semibold shrink-0">
                  Elimina
                </button>
              </div>
              <p className="text-[12px] text-[#9A9A94]">{t.roster.join(", ")}</p>
            </div>
          )
        )}
      </div>
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
      <button
        onClick={create}
        disabled={creating || !name.trim()}
        className="w-full bg-court text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
      >
        {creating ? "Creazione in corso..." : "Crea squadra"}
      </button>
    </div>
  );
}

function EditTeamRow({
  team,
  onCancel,
  onDone,
}: {
  team: Team;
  onCancel: () => void;
  onDone: (msg: string) => void;
}) {
  const [name, setName] = useState(team.name);
  const [rosterText, setRosterText] = useState(team.roster.join(", "));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const roster = rosterText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (roster.length < 2 || roster.length > 6) {
      onDone("La rosa deve avere tra 2 e 6 nomi.");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "teams", team.id), { name: name.trim(), roster });
      onDone("Squadra aggiornata.");
      onCancel();
    } catch (err) {
      console.error(err);
      onDone("Errore nel salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-3.5 py-3 border-b border-[#F1EFE8] last:border-b-0 bg-[#FAF8F3]">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-sm mb-2"
      />
      <input
        value={rosterText}
        onChange={(e) => setRosterText(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-sm mb-2"
      />
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 bg-court text-white rounded-lg py-2 text-sm font-bold disabled:opacity-50"
        >
          Salva
        </button>
        <button onClick={onCancel} className="flex-1 border border-[#E5E3DC] rounded-lg py-2 text-sm font-semibold">
          Annulla
        </button>
      </div>
    </div>
  );
}
