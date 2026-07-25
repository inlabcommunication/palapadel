import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { confirmDelete } from "../lib/confirmDelete";
import { ImageUploadField } from "./ImageUploadField";
import { TypeBadge } from "./TypeBadge";
import { uploadTeamPhotoAsset, deleteTeamPhotoByPath, TeamPhotoError } from "../lib/teamPhotoUpload";
import { uploadChampionshipLogo, deleteChampionshipLogo, getChampionshipLogoAlt } from "../lib/championshipLogoUpload";
import { getImageErrorMessage } from "../lib/imageFilePolicy";
import type { ChampionshipType, Team } from "../types";
import { BADGE_COLORS } from "../types";
import { deleteTeam, saveTeam } from "../lib/teamAdminApi";
import { createChampionshipType, deleteChampionshipType, updateChampionshipType } from "../lib/championshipApi";
import { reorderChampionshipTypes } from "../lib/championshipAdminApi";
import { ChevronUp, ChevronDown } from "lucide-react";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const badgeOptions = Object.keys(BADGE_COLORS);
  // Ordine di visualizzazione: per "order" (assente = 0), poi alfabetico. Le frecce
  // riscrivono "order" con valori sequenziali puliti (0,1,2...) su tutta la lista,
  // così restano sempre coerenti anche se una tipologia non lo aveva mai avuto.
  const sortedTypes = [...types].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));

  const moveType = async (type: ChampionshipType, direction: -1 | 1) => {
    const index = sortedTypes.findIndex((t) => t.id === type.id);
    const swapWith = sortedTypes[index + direction];
    if (!swapWith) return;
    const reordered = [...sortedTypes];
    [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
    setReorderingId(type.id);
    try {
      await reorderChampionshipTypes(reordered.map((t) => t.id));
    } catch (err) {
      console.error(err);
      onDone(getImageErrorMessage(err, "Errore nel riordino delle tipologie."));
    } finally {
      setReorderingId(null);
    }
  };

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const id = slugify(name);
      await createChampionshipType({
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
      await deleteChampionshipType(t.id);
      onDone(`Tipologia "${t.name}" eliminata.`);
    } catch (err) {
      console.error(err);
      onDone("Errore nell'eliminazione.");
    }
  };

  return (
    <div className="mt-6">
      <p className="text-[13px] font-bold mb-2">Tipologie di campionato</p>
      <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl overflow-hidden mb-3">
        {sortedTypes.map((t, index) =>
          editingId === t.id ? (
            <EditTypeRow key={t.id} type={t} onCancel={() => setEditingId(null)} onDone={onDone} />
          ) : (
            <div
              key={t.id}
              className="flex items-center justify-between px-3.5 py-2.5 text-[13px] border-b border-[rgba(251,243,222,0.08)] last:border-b-0 gap-2"
            >
              <div className="flex flex-col shrink-0">
                <button
                  onClick={() => moveType(t, -1)}
                  disabled={index === 0 || reorderingId !== null}
                  className="text-[rgba(251,243,222,0.55)] disabled:opacity-25"
                  aria-label={`Sposta ${t.name} su`}
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => moveType(t, 1)}
                  disabled={index === sortedTypes.length - 1 || reorderingId !== null}
                  className="text-[rgba(251,243,222,0.55)] disabled:opacity-25"
                  aria-label={`Sposta ${t.name} giù`}
                >
                  <ChevronDown size={14} />
                </button>
              </div>
              <TypeBadge type={t} size={34} />
              <span className="font-semibold flex-1">
                {t.name}{" "}
                <span className="text-[rgba(251,243,222,0.50)] font-normal">{t.hasTeams ? "· a squadre" : "· individuale"}</span>
              </span>
              <span
                className="text-[10.5px] font-bold px-2 py-1 rounded-full shrink-0"
                style={{ background: BADGE_COLORS[t.badgeColor]?.bg, color: BADGE_COLORS[t.badgeColor]?.text }}
              >
                {BADGE_COLORS[t.badgeColor]?.label}
              </span>
              <button onClick={() => setEditingId(t.id)} className="text-[#BBFF5E] text-xs font-semibold shrink-0">
                Modifica
              </button>
              <button onClick={() => remove(t)} className="text-[#FF6B6B] text-xs font-semibold shrink-0">
                Elimina
              </button>
            </div>
          )
        )}
        {sortedTypes.length === 0 && <p className="px-3.5 py-2.5 text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessuna tipologia ancora.</p>}
      </div>

      <p className="text-xs text-[rgba(251,243,222,0.50)] mb-2">
        Crea una nuova tipologia se in futuro serve un campionato diverso da Serie B/C, Principianti, Femminile.
      </p>
      <input
        placeholder="Nome tipologia (es. Serie A, Under 18...)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <label className="flex items-center gap-2 text-[13px] mb-2">
        <input type="checkbox" checked={hasTeams} onChange={(e) => setHasTeams(e.target.checked)} />
        A squadre (disattiva per un campionato individuale come il Femminile)
      </label>
      <select
        value={badgeColor}
        onChange={(e) => setBadgeColor(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2"
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
        className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingLogo, setDeletingLogo] = useState(false);

  const save = async () => {
    setSaving(true);
    setLogoError(null);
    let uploadedLogo: Awaited<ReturnType<typeof uploadChampionshipLogo>> | null = null;
    try {
      const updates: Parameters<typeof updateChampionshipType>[0] = { id: type.id, name: name.trim(), hasTeams, badgeColor };
      if (logoFile) {
        uploadedLogo = await uploadChampionshipLogo(type.id, logoFile);
        updates.logoUrl = uploadedLogo.url;
        updates.logoStoragePath = uploadedLogo.storagePath;
        updates.logoAlt = getChampionshipLogoAlt(type, type.logoAlt);
      }

      await updateChampionshipType(updates);
      // Il vecchio file va eliminato solo DOPO che Firestore ha confermato: mai prima,
      // altrimenti un fallimento a metà lascerebbe la tipologia senza nessun logo.
      if (uploadedLogo && type.logoStoragePath) await deleteChampionshipLogo(type.logoStoragePath);
      onDone("Tipologia aggiornata.");
      onCancel();
    } catch (err) {
      // Se l'upload era riuscito ma il salvataggio su Firestore fallisce, il file nuovo
      // appena caricato va eliminato: non deve restare orfano, e il logo precedente resta
      // quello valido. Nessun falso messaggio di successo.
      if (uploadedLogo) await deleteChampionshipLogo(uploadedLogo.storagePath);
      console.error(err);
      const msg = getImageErrorMessage(err, "Errore nel salvataggio della tipologia.");
      setLogoError(msg);
      onDone(msg);
    } finally {
      setSaving(false);
    }
  };

  // Eliminazione immediata e indipendente dal Salva (stesso pattern dell'immagine
  // delle news): chiede conferma, aggiorna subito Firestore, poi elimina il file.
  const removeLogoNow = async () => {
    if (!type.logoUrl) return;
    if (!confirmDelete(`il logo di ${type.name}`)) return;
    setDeletingLogo(true);
    setLogoError(null);
    try {
      await updateChampionshipType({
        id: type.id,
        name: type.name,
        hasTeams: type.hasTeams,
        badgeColor: type.badgeColor,
        logoUrl: null,
        logoStoragePath: null,
        logoAlt: null,
      });
      await deleteChampionshipLogo(type.logoStoragePath ?? type.logoUrl);
      onDone("Logo eliminato.");
    } catch (err) {
      console.error(err);
      setLogoError(getImageErrorMessage(err, "Errore nell'eliminazione del logo."));
    } finally {
      setDeletingLogo(false);
    }
  };

  return (
    <div className="px-3.5 py-3 border-b border-[rgba(251,243,222,0.08)] last:border-b-0 bg-[#123008]">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm mb-2"
      />
      <label className="flex items-center gap-2 text-[13px] mb-2">
        <input type="checkbox" checked={hasTeams} onChange={(e) => setHasTeams(e.target.checked)} />
        A squadre
      </label>
      <select
        value={badgeColor}
        onChange={(e) => setBadgeColor(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2"
      >
        {Object.keys(BADGE_COLORS).map((k) => (
          <option key={k} value={k}>
            Badge {BADGE_COLORS[k].label}
          </option>
        ))}
      </select>

      <ImageUploadField
        label="Logo della categoria"
        currentUrl={type.logoUrl}
        currentAlt={getChampionshipLogoAlt(type, type.logoAlt)}
        selectedFile={logoFile}
        loading={saving || deletingLogo}
        error={logoError}
        uploadLabel="Carica logo"
        replaceLabel="Sostituisci logo"
        removeLabel="Elimina logo"
        previewAspectClassName="aspect-square"
        previewObjectFit="contain"
        onFileChange={(file) => {
          setLogoError(null);
          setLogoFile(file);
        }}
        onRemoveImage={removeLogoNow}
      />

      <div className="flex gap-2 mt-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 bg-lime text-[#081208] rounded-lg py-2 text-sm font-bold disabled:opacity-50"
        >
          {saving ? "Salvataggio in corso..." : "Salva"}
        </button>
        <button onClick={onCancel} className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2 text-sm font-semibold">
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
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
    setPhotoError(null);
    let uploadedPhoto: Awaited<ReturnType<typeof uploadTeamPhotoAsset>> | null = null;
    try {
      const ref = { id: crypto.randomUUID() };
      if (photoFile) {
        uploadedPhoto = await uploadTeamPhotoAsset(ref.id, photoFile);
      }
      await saveTeam({
        operation: "create",
        teamId: ref.id,
        name: name.trim(),
        roster,
        ...(uploadedPhoto
          ? { teamPhotoUrl: uploadedPhoto.url, teamPhotoStoragePath: uploadedPhoto.storagePath }
          : {}),
      });
      setName("");
      setRosterText("");
      setPhotoFile(null);
      onDone(`Squadra "${name}" creata.`);
    } catch (err) {
      if (uploadedPhoto) await deleteTeamPhotoByPath(uploadedPhoto.storagePath);
      console.error(err);
      const msg = err instanceof TeamPhotoError ? err.message : "Errore nella creazione della squadra.";
      setPhotoError(msg);
      onDone(msg);
    } finally {
      setCreating(false);
    }
  };

  const remove = async (t: Team) => {
    if (!confirmDelete(t.name)) return;
    try {
      await deleteTeam(t.id);
      onDone(`Squadra "${t.name}" eliminata.`);
    } catch (err) {
      console.error(err);
      onDone("Errore nell'eliminazione.");
    }
  };

  return (
    <div id="squadre" className="mt-6 scroll-mt-24">
      <p className="text-[13px] font-bold mb-2">Squadre</p>
      <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl overflow-hidden mb-3 max-h-72 overflow-y-auto">
        {teams.length === 0 && <p className="px-3.5 py-2.5 text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessuna squadra ancora.</p>}
        {teams.map((t) =>
          editingId === t.id ? (
            <EditTeamRow key={t.id} team={t} onCancel={() => setEditingId(null)} onDone={onDone} />
          ) : (
            <div key={t.id} className="px-3.5 py-2.5 text-[13px] border-b border-[rgba(251,243,222,0.08)] last:border-b-0">
              <div className="flex items-center gap-3">
                {t.teamPhotoUrl ? (
                  <img src={t.teamPhotoUrl} alt={`Foto di gruppo: ${t.name}`} className="h-12 w-20 shrink-0 rounded-lg object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-[#123008] text-[10px] font-bold text-[rgba(187,255,94,0.48)]">
                    FOTO
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{t.name}</p>
                  <p className="text-[12px] text-[rgba(251,243,222,0.50)] truncate">{t.roster.join(", ")}</p>
                </div>
                <button onClick={() => setEditingId(t.id)} className="text-[#BBFF5E] text-xs font-semibold shrink-0">
                  Modifica
                </button>
                <button onClick={() => remove(t)} className="text-[#FF6B6B] text-xs font-semibold shrink-0">
                  Elimina
                </button>
              </div>
            </div>
          )
        )}
      </div>
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
      <div className="mb-2">
        <ImageUploadField
          label="Foto di gruppo della squadra"
          selectedFile={photoFile}
          loading={creating}
          error={photoError}
          currentAlt={`Foto di gruppo: ${name || "squadra"}`}
          onFileChange={(file) => {
            setPhotoError(null);
            setPhotoFile(file);
          }}
        />
      </div>
      <button
        onClick={create}
        disabled={creating || !name.trim()}
        className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
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
    setPhotoError(null);
    let uploadedPhoto: Awaited<ReturnType<typeof uploadTeamPhotoAsset>> | null = null;
    try {
      if (photoFile) {
        // Fase 7 — carica prima la nuova foto e ottieni l'URL; elimina quella
        // precedente SOLO dopo che il salvataggio su Firestore è andato a buon fine.
        uploadedPhoto = await uploadTeamPhotoAsset(team.id, photoFile);
      }
      await saveTeam({
        operation: "update",
        teamId: team.id,
        name: name.trim(),
        roster,
        ...(uploadedPhoto
          ? { teamPhotoUrl: uploadedPhoto.url, teamPhotoStoragePath: uploadedPhoto.storagePath }
          : removePhoto
            ? { teamPhotoStoragePath: null }
            : {}),
      });
      const previousPhoto = team.teamPhotoStoragePath ?? team.teamPhotoUrl;
      if (uploadedPhoto && previousPhoto) await deleteTeamPhotoByPath(previousPhoto);
      if (removePhoto && !uploadedPhoto && previousPhoto) await deleteTeamPhotoByPath(previousPhoto);
      onDone("Squadra aggiornata.");
      onCancel();
    } catch (err) {
      if (uploadedPhoto) await deleteTeamPhotoByPath(uploadedPhoto.storagePath);
      console.error(err);
      const msg = err instanceof TeamPhotoError ? err.message : "Errore nel salvataggio.";
      setPhotoError(msg);
      onDone(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-3.5 py-3 border-b border-[rgba(251,243,222,0.08)] last:border-b-0 bg-[#123008]">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm mb-2"
      />
      <input
        value={rosterText}
        onChange={(e) => setRosterText(e.target.value)}
        className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-sm mb-2"
      />
      <div className="mb-2">
        <ImageUploadField
          label="Foto di gruppo della squadra"
          currentUrl={removePhoto ? null : team.teamPhotoUrl}
          currentAlt={`Foto di gruppo: ${name}`}
          selectedFile={photoFile}
          loading={saving}
          error={photoError}
          onFileChange={(file) => {
            setPhotoError(null);
            setPhotoFile(file);
            setRemovePhoto(false);
          }}
          onRemoveImage={() => {
            if (!confirmDelete("la foto di gruppo della squadra")) return;
            setPhotoFile(null);
            setRemovePhoto(true);
          }}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 bg-lime text-[#081208] rounded-lg py-2 text-sm font-bold disabled:opacity-50"
        >
          {saving ? "Salvataggio..." : "Salva"}
        </button>
        <button onClick={onCancel} className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2 text-sm font-semibold">
          Annulla
        </button>
      </div>
    </div>
  );
}
