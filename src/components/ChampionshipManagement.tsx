import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useCollection } from "../hooks/useCollection";
import { confirmDelete } from "../lib/confirmDelete";
import { ImageUploadField } from "./ImageUploadField";
import { uploadTeamPhotoAsset, deleteTeamPhotoByPath, TeamPhotoError } from "../lib/teamPhotoUpload";
import type { ChampionshipType, Team } from "../types";
import { BADGE_COLORS } from "../types";
import { deleteTeam, saveTeam } from "../lib/teamAdminApi";
import { BackendApiError } from "../lib/backendClient";
import {
  createChampionshipType,
  deleteChampionshipType,
  removeChampionshipTypeLogo,
  setChampionshipTypeLogo,
  updateChampionshipType,
} from "../lib/championshipApi";
import { deleteChampionshipTypeLogo, uploadChampionshipTypeLogo } from "../lib/championshipLogoUpload";

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

  const badgeOptions = Object.keys(BADGE_COLORS);

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
        {types.map((t) =>
          editingId === t.id ? (
            <EditTypeRow key={t.id} type={t} onCancel={() => setEditingId(null)} onDone={onDone} />
          ) : (
            <div
              key={t.id}
              className="flex items-center justify-between px-3.5 py-2.5 text-[13px] border-b border-[rgba(251,243,222,0.08)] last:border-b-0 gap-2"
            >
              {t.logoUrl ? (
                <img src={t.logoUrl} alt={t.logoAlt ?? `Logo ${t.name}`} className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" />
              ) : (
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[rgba(251,243,222,0.08)] text-[10px] font-bold text-[rgba(251,243,222,0.50)]">LOGO</div>
              )}
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
                {t.logoUrl ? "Modifica" : "Aggiungi logo"}
              </button>
              <button onClick={() => remove(t)} className="text-[#FF6B6B] text-xs font-semibold shrink-0">
                Elimina
              </button>
            </div>
          )
        )}
        {types.length === 0 && <p className="px-3.5 py-2.5 text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessuna tipologia ancora.</p>}
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
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setLogoError(null);
    let uploadedLogo: Awaited<ReturnType<typeof uploadChampionshipTypeLogo>> | null = null;
    try {
      if (logoFile) uploadedLogo = await uploadChampionshipTypeLogo(type.id, logoFile);
      await updateChampionshipType({ id: type.id, name: name.trim(), hasTeams, badgeColor });
      if (uploadedLogo) {
        await setChampionshipTypeLogo({
          id: type.id,
          logoUrl: uploadedLogo.url,
          logoStoragePath: uploadedLogo.storagePath,
          logoAlt: `Logo ${name.trim()}`,
        });
      } else if (removeLogo) {
        await removeChampionshipTypeLogo(type.id);
      }
      const previousLogo = type.logoStoragePath ?? type.logoUrl;
      if ((uploadedLogo || removeLogo) && previousLogo) await deleteChampionshipTypeLogo(previousLogo);
      onDone("Tipologia aggiornata.");
      onCancel();
    } catch (err) {
      if (uploadedLogo) await deleteChampionshipTypeLogo(uploadedLogo.storagePath);
      console.error(err);
      const message = err instanceof Error ? err.message : "Errore nel salvataggio.";
      setLogoError(message);
      onDone(message);
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
      <div className="mb-3">
        <ImageUploadField
          label="Logo del campionato"
          currentUrl={removeLogo ? null : type.logoUrl}
          currentAlt={type.logoAlt ?? `Logo ${name}`}
          selectedFile={logoFile}
          loading={saving}
          error={logoError}
          uploadLabel="Aggiungi logo"
          replaceLabel="Sostituisci logo"
          removeLabel="Elimina logo"
          aspectClass="aspect-square"
          onFileChange={(file) => {
            setLogoFile(file);
            setRemoveLogo(false);
            setLogoError(null);
          }}
          onRemoveImage={() => {
            if (!confirmDelete(`il logo di ${type.name}`)) return;
            setLogoFile(null);
            setRemoveLogo(true);
          }}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 bg-lime text-[#081208] rounded-lg py-2 text-sm font-bold disabled:opacity-50"
        >
          Salva
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
  const [teamSearch, setTeamSearch] = useState("");
  const [name, setName] = useState("");
  const [rosterText, setRosterText] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPositionY, setPhotoPositionY] = useState(50);
  const [photoScale, setPhotoScale] = useState(1);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const roster = rosterText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const filteredTeams = teams.filter((team) => {
    const query = teamSearch.trim().toLocaleLowerCase("it");
    if (!query) return true;
    return (
      team.name.toLocaleLowerCase("it").includes(query) ||
      team.roster.some((player) => player.toLocaleLowerCase("it").includes(query))
    );
  });

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
          ? {
              teamPhotoUrl: uploadedPhoto.url,
              teamPhotoStoragePath: uploadedPhoto.storagePath,
              teamPhotoPositionY: photoPositionY,
              teamPhotoScale: photoScale,
            }
          : {}),
      });
      setName("");
      setRosterText("");
      setPhotoFile(null);
      setPhotoPositionY(50);
      setPhotoScale(1);
      onDone(`Squadra "${name}" creata.`);
    } catch (err) {
      if (uploadedPhoto) await deleteTeamPhotoByPath(uploadedPhoto.storagePath);
      console.error(err);
      const msg =
        err instanceof TeamPhotoError || err instanceof BackendApiError
          ? err.message
          : "Errore nella creazione della squadra.";
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
      <input
        type="search"
        placeholder="Cerca squadra o giocatore"
        value={teamSearch}
        onChange={(event) => setTeamSearch(event.target.value)}
        className="mb-2 w-full rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2.5 text-sm"
        aria-label="Cerca nell'elenco delle squadre"
      />
      <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-2xl overflow-hidden mb-3 max-h-72 overflow-y-auto">
        {teams.length === 0 && <p className="px-3.5 py-2.5 text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessuna squadra ancora.</p>}
        {teams.length > 0 && filteredTeams.length === 0 && (
          <p className="px-3.5 py-4 text-[12.5px] text-[rgba(251,243,222,0.50)]">
            Nessuna squadra corrisponde alla ricerca.
          </p>
        )}
        {filteredTeams.map((t) =>
          editingId === t.id ? (
            <EditTeamRow key={t.id} team={t} onCancel={() => setEditingId(null)} onDone={onDone} />
          ) : (
            <div key={t.id} className="px-3.5 py-2.5 text-[13px] border-b border-[rgba(251,243,222,0.08)] last:border-b-0">
              <div className="flex items-center gap-3">
                {t.teamPhotoUrl ? (
                  <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg">
                    <img
                      src={t.teamPhotoUrl}
                      alt={`Foto di gruppo: ${t.name}`}
                      className="h-full w-full object-cover"
                      style={{
                        objectPosition: `50% ${t.teamPhotoPositionY ?? 50}%`,
                        transform: `scale(${t.teamPhotoScale ?? 1})`,
                      }}
                      loading="lazy"
                    />
                  </div>
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
          aspectClass="h-28 sm:h-32"
          positionY={photoPositionY}
          onPositionYChange={setPhotoPositionY}
          scale={photoScale}
          onScaleChange={setPhotoScale}
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
  const [photoPositionY, setPhotoPositionY] = useState(team.teamPhotoPositionY ?? 50);
  const [photoScale, setPhotoScale] = useState(team.teamPhotoScale ?? 1);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onCancel, saving]);

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
        teamPhotoPositionY: photoPositionY,
        teamPhotoScale: photoScale,
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
      const msg =
        err instanceof TeamPhotoError || err instanceof BackendApiError
          ? err.message
          : "Errore nel salvataggio.";
      setPhotoError(msg);
      onDone(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/75 p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:items-center sm:p-6"
      onClick={() => {
        if (!saving) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`edit-team-${team.id}`}
        className="my-auto w-full max-w-2xl overflow-y-auto rounded-lg border border-[rgba(251,243,222,0.14)] bg-[#0A0B08] p-4 shadow-2xl max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase text-[rgba(251,243,222,0.50)]">Modifica squadra</p>
            <h3 id={`edit-team-${team.id}`} className="text-lg font-extrabold text-[#FBF3DE]">{team.name}</h3>
          </div>
          <button
            type="button"
            aria-label="Chiudi modifica squadra"
            onClick={onCancel}
            disabled={saving}
            className="rounded-full bg-[rgba(251,243,222,0.08)] p-2 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>
        <label className="mb-1 block text-xs font-bold" htmlFor={`team-name-${team.id}`}>Nome squadra</label>
        <input
          id={`team-name-${team.id}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-3"
        />
        <label className="mb-1 block text-xs font-bold" htmlFor={`team-roster-${team.id}`}>Rosa</label>
        <input
          id={`team-roster-${team.id}`}
          value={rosterText}
          onChange={(e) => setRosterText(e.target.value)}
          className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-3"
        />
        <div className="mb-4">
          <ImageUploadField
            label="Foto di gruppo della squadra"
            currentUrl={removePhoto ? null : team.teamPhotoUrl}
            currentAlt={`Foto di gruppo: ${name}`}
            selectedFile={photoFile}
            loading={saving}
            error={photoError}
            aspectClass="h-32 sm:h-40"
            positionY={photoPositionY}
            onPositionYChange={setPhotoPositionY}
            scale={photoScale}
            onScaleChange={setPhotoScale}
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
            className="flex-1 bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {saving ? "Salvataggio..." : "Salva"}
          </button>
          <button onClick={onCancel} disabled={saving} className="flex-1 border border-[rgba(251,243,222,0.18)] rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50">
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
