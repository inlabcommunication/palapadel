import { useState } from "react";
import { addDoc, collection, doc, setDoc } from "firebase/firestore";
import { useCollection } from "../hooks/useCollection";
import { db } from "../firebase";
import type { ChampionshipEdition, ChampionshipType, EditionStatus, Team } from "../types";
import { BADGE_COLORS } from "../types";

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* =========================== Tipologie di campionato =========================== */

export function ChampionshipTypeManagement({ onDone }: { onDone: (msg: string) => void }) {
  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const [name, setName] = useState("");
  const [hasTeams, setHasTeams] = useState(true);
  const [badgeColor, setBadgeColor] = useState<string>("serie-b");
  const [creating, setCreating] = useState(false);

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

  return (
    <div className="mt-6">
      <p className="text-[13px] font-bold mb-2">Tipologie di campionato</p>
      <div className="bg-white border border-[#EAE7DD] rounded-xl overflow-hidden mb-3">
        {types.map((t) => {
          const badge = BADGE_COLORS[t.badgeColor] ?? BADGE_COLORS["serie-b"];
          return (
            <div
              key={t.id}
              className="flex items-center justify-between px-3.5 py-2.5 text-[13px] border-b border-[#F1EFE8] last:border-b-0"
            >
              <span className="font-semibold">
                {t.name} <span className="text-[#9A9A94] font-normal">{t.hasTeams ? "· a squadre" : "· individuale"}</span>
              </span>
              <span
                className="text-[10.5px] font-bold px-2 py-1 rounded-full"
                style={{ background: badge.bg, color: badge.text }}
              >
                {badge.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[#9A9A94] mb-2">
        Crea una nuova tipologia se in futuro serve un campionato diverso da Serie B/C, Principianti, Femminile
        (punto 1 della specifica: nessuna modifica al codice necessaria).
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

/* =========================== Edizioni =========================== */

export function EditionManagement({ onDone }: { onDone: (msg: string) => void }) {
  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const [typeId, setTypeId] = useState("");
  const [season, setSeason] = useState("");
  const [status, setStatus] = useState<EditionStatus>("bozza");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    const finalTypeId = typeId || types[0]?.id;
    if (!finalTypeId || !season.trim()) return;
    setCreating(true);
    try {
      await addDoc(collection(db, "championshipEditions"), {
        typeId: finalTypeId,
        season: season.trim(),
        status,
      });
      setSeason("");
      onDone("Edizione creata.");
    } catch (err) {
      console.error(err);
      onDone("Errore nella creazione dell'edizione.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mt-6">
      <p className="text-[13px] font-bold mb-2">Crea edizione</p>
      <select
        value={typeId}
        onChange={(e) => setTypeId(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-[13px] bg-white mb-2"
      >
        <option value="" disabled>
          Scegli tipologia...
        </option>
        {types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
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
        disabled={creating || !season.trim()}
        className="w-full bg-court text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
      >
        {creating ? "Creazione in corso..." : "Crea edizione"}
      </button>
    </div>
  );
}

/* =========================== Squadre =========================== */

export function TeamManagement({ onDone }: { onDone: (msg: string) => void }) {
  const { data: teams } = useCollection<Team>("teams");
  const [name, setName] = useState("");
  const [rosterText, setRosterText] = useState("");
  const [creating, setCreating] = useState(false);

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
      await addDoc(collection(db, "teams"), {
        name: name.trim(),
        roster,
      });
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

  return (
    <div className="mt-6">
      <p className="text-[13px] font-bold mb-2">Squadre</p>
      <div className="bg-white border border-[#EAE7DD] rounded-xl overflow-hidden mb-3 max-h-56 overflow-y-auto">
        {teams.length === 0 && <p className="px-3.5 py-2.5 text-[12.5px] text-[#9A9A94]">Nessuna squadra ancora.</p>}
        {teams.map((t) => (
          <div key={t.id} className="px-3.5 py-2.5 text-[13px] border-b border-[#F1EFE8] last:border-b-0">
            <p className="font-semibold">{t.name}</p>
            <p className="text-[12px] text-[#9A9A94]">{t.roster.join(", ")}</p>
          </div>
        ))}
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

/* =========================== Assegna squadra a un'edizione =========================== */

export function EditionTeamManagement({ onDone }: { onDone: (msg: string) => void }) {
  const { data: editions } = useCollection<ChampionshipEdition>("championshipEditions");
  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const { data: teams } = useCollection<Team>("teams");

  const teamEditions = editions.filter((e) => types.find((t) => t.id === e.typeId)?.hasTeams);

  const [editionId, setEditionId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [creating, setCreating] = useState(false);

  const link = async () => {
    const finalEditionId = editionId || teamEditions[0]?.id;
    const finalTeamId = teamId || teams[0]?.id;
    if (!finalEditionId || !finalTeamId) return;
    setCreating(true);
    try {
      const id = `${finalEditionId}_${finalTeamId}`;
      await setDoc(doc(db, "editionTeams", id), {
        id,
        editionId: finalEditionId,
        teamId: finalTeamId,
        points: 0,
        played: 0,
        order: 0,
        status: "normale",
      });
      onDone("Squadra iscritta all'edizione.");
    } catch (err) {
      console.error(err);
      onDone("Errore nell'iscrizione della squadra.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mt-6">
      <p className="text-[13px] font-bold mb-2">Iscrivi una squadra a un'edizione</p>
      <select
        value={editionId}
        onChange={(e) => setEditionId(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-[13px] bg-white mb-2"
      >
        <option value="" disabled>
          Scegli edizione...
        </option>
        {teamEditions.map((e) => {
          const t = types.find((x) => x.id === e.typeId);
          return (
            <option key={e.id} value={e.id}>
              {t?.name} {e.season}
            </option>
          );
        })}
      </select>
      <select
        value={teamId}
        onChange={(e) => setTeamId(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-[13px] bg-white mb-2"
      >
        <option value="" disabled>
          Scegli squadra...
        </option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        onClick={link}
        disabled={creating}
        className="w-full bg-court text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
      >
        {creating ? "Iscrizione in corso..." : "Iscrivi squadra"}
      </button>
      <p className="text-xs text-[#9A9A94] mt-2">
        Punti e partite giocate partono da zero e si possono correggere manualmente in Fase 3, oppure verranno
        aggiornati automaticamente dai risultati delle partite.
      </p>
    </div>
  );
}

/* =========================== Femminile: aggiungi giocatrice =========================== */

export function FemaleParticipantManagement({ onDone }: { onDone: (msg: string) => void }) {
  const { data: editions } = useCollection<ChampionshipEdition>("championshipEditions");
  const { data: types } = useCollection<ChampionshipType>("championshipTypes");

  const femaleEditions = editions.filter((e) => types.find((t) => t.id === e.typeId)?.hasTeams === false);

  const [editionId, setEditionId] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    const finalEditionId = editionId || femaleEditions[0]?.id;
    if (!finalEditionId || !name.trim()) return;
    setCreating(true);
    try {
      await addDoc(collection(db, "femaleParticipants"), {
        editionId: finalEditionId,
        name: name.trim(),
        points: 0,
        stages: 0,
        status: "normale",
      });
      setName("");
      onDone(`Giocatrice "${name}" aggiunta.`);
    } catch (err) {
      console.error(err);
      onDone("Errore nell'aggiunta della giocatrice.");
    } finally {
      setCreating(false);
    }
  };

  if (femaleEditions.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="text-[13px] font-bold mb-2">Aggiungi giocatrice (campionato individuale)</p>
      <select
        value={editionId}
        onChange={(e) => setEditionId(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-[13px] bg-white mb-2"
      >
        <option value="" disabled>
          Scegli edizione...
        </option>
        {femaleEditions.map((e) => {
          const t = types.find((x) => x.id === e.typeId);
          return (
            <option key={e.id} value={e.id}>
              {t?.name} {e.season}
            </option>
          );
        })}
      </select>
      <input
        placeholder="Nome giocatrice"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <button
        onClick={create}
        disabled={creating || !name.trim()}
        className="w-full bg-court text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
      >
        {creating ? "Aggiunta in corso..." : "Aggiungi giocatrice"}
      </button>
    </div>
  );
}
