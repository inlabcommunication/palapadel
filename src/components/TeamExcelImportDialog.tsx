import { useEffect, useMemo, useState } from "react";
import { where } from "firebase/firestore";
import { Upload, X } from "lucide-react";
import { useCollection } from "../hooks/useCollection";
import { importTeamsWithDecisions } from "../lib/teamAdminApi";
import { parseTeamImportFile, type ImportedTeamRow } from "../lib/teamImportParser";
import {
  normalizeTeamKey,
  planTeamImport,
  resolveTeamImport,
  suggestCopyName,
  type TeamImportAction,
} from "../../shared/teamImportPlan.js";
import type { EditionTeam, Team } from "../types";

interface Decision {
  action: TeamImportAction | null;
  copyName: string;
}

/**
 * Import squadre da Excel. Senza `edition` aggiorna solo l'anagrafica squadre; con
 * `edition` iscrive anche le squadre a quell'edizione. Per ogni nome già esistente
 * mostra se i giocatori coincidono e chiede cosa fare.
 */
export function TeamExcelImportDialog({
  edition,
  onClose,
  onDone,
}: {
  edition?: { id: string; typeId: string; label: string };
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { data: teams, loading: teamsLoading } = useCollection<Team>("teams");
  const editionId = edition?.id ?? "";
  const { data: entries } = useCollection<EditionTeam>(
    "editionTeams",
    editionId ? [where("editionId", "==", editionId)] : [],
    [editionId]
  );
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportedTeamRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);

  const enrolledTeamIds = useMemo(() => (edition ? entries.map((entry) => entry.teamId) : []), [edition, entries]);
  const plan = useMemo(
    () => planTeamImport(rows, teams, { enrolledTeamIds, typeId: edition?.typeId ?? null }),
    [rows, teams, enrolledTeamIds, edition?.typeId]
  );

  // Scelte iniziali: nuova → crea; stessi giocatori → usa; giocatori diversi → da decidere.
  useEffect(() => {
    if (teamsLoading) return;
    setDecisions((current) => {
      const next: Record<number, Decision> = {};
      const taken = new Set(teams.map((team) => team.name).concat(rows.map((row) => row.name)));
      for (const row of plan) {
        next[row.rowNumber] = current[row.rowNumber] ?? {
          action: row.suggested,
          copyName: suggestCopyName(row.name, taken),
        };
      }
      return next;
    });
  }, [plan, rows, teams, teamsLoading]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !reading && !importing) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [importing, onClose, reading]);

  const readFile = async (file: File | null) => {
    if (!file) return;
    setReading(true);
    setFileName(file.name);
    setDecisions({});
    try {
      const result = await parseTeamImportFile(file);
      setRows(result.teams);
      setErrors(result.errors);
    } catch (error) {
      console.error(error);
      setRows([]);
      setErrors(["Impossibile leggere il file Excel. Verifica che non sia danneggiato."]);
    } finally {
      setReading(false);
    }
  };

  const payload = plan.map((row) => ({
    name: row.name,
    roster: row.roster,
    action: decisions[row.rowNumber]?.action ?? ("" as TeamImportAction),
    ...(row.existing ? { existingTeamId: row.existing.id } : {}),
    ...(decisions[row.rowNumber]?.action === "copy" ? { copyName: decisions[row.rowNumber].copyName } : {}),
  }));
  const pending = plan.filter((row) => !decisions[row.rowNumber]?.action).length;
  const check = rows.length > 0 && pending === 0
    ? resolveTeamImport(payload, teams, { enrolledTeamIds, typeId: edition?.typeId ?? null })
    : { errors: [], operations: [] };
  const toImport = payload.filter((row) => row.action !== "skip").length;
  const canImport = !reading && !importing && !teamsLoading && rows.length > 0 && errors.length === 0 && pending === 0 && check.errors.length === 0 && toImport > 0;

  const confirmImport = async () => {
    if (!canImport) return;
    setImporting(true);
    try {
      const result = await importTeamsWithDecisions({ ...(edition ? { editionId: edition.id } : {}), rows: payload });
      const parts = [
        result.created && `${result.created} create`,
        result.replaced && `${result.replaced} aggiornate`,
        result.used && `${result.used} già esistenti usate`,
        edition && result.enrolled && `${result.enrolled} iscritte a ${edition.label}`,
        result.skipped && `${result.skipped} saltate`,
      ].filter(Boolean);
      onDone(`Squadre importate: ${parts.join(", ") || "nessuna modifica"}.`);
    } catch (error) {
      console.error(error);
      setErrors([error instanceof Error ? error.message : "Importazione squadre non riuscita."]);
    } finally {
      setImporting(false);
    }
  };

  const setDecision = (rowNumber: number, patch: Partial<Decision>) =>
    setDecisions((current) => ({ ...current, [rowNumber]: { ...current[rowNumber], ...patch } }));

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/75 p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:items-center sm:p-6"
      onClick={() => {
        if (!reading && !importing) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-import-title"
        className="my-auto w-full max-w-3xl overflow-y-auto rounded-lg border border-[rgba(251,243,222,0.14)] bg-[#0A0B08] p-4 max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="team-import-title" className="text-lg font-extrabold">
              {edition ? `Importa squadre in ${edition.label}` : "Importa squadre da Excel"}
            </h3>
            <p className="mt-1 text-xs text-[rgba(251,243,222,0.58)]">
              Colonna A: Nome squadra. Colonne B-G: Giocatori 1-6. Ogni squadra deve avere almeno 2 giocatori.
              {edition && " Le squadre vengono anche iscritte a questo campionato."}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={reading || importing} aria-label="Chiudi importazione" className="rounded-full bg-[rgba(251,243,222,0.08)] p-2 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[rgba(251,243,222,0.22)] bg-[#123008] px-4 py-4 text-center">
          <Upload size={22} className="text-[#BBFF5E]" />
          <span className="text-sm font-bold">{reading ? "Lettura in corso..." : "Seleziona file Excel"}</span>
          <span className="text-xs text-[rgba(251,243,222,0.55)]">{fileName || "file .xlsx"}</span>
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            disabled={reading || importing}
            onChange={(event) => {
              void readFile(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
        </label>

        {(errors.length > 0 || check.errors.length > 0) && (
          <div className="mt-4 rounded-lg border border-[rgba(255,107,107,0.35)] bg-[rgba(255,107,107,0.08)] p-3">
            {[...errors, ...check.errors].map((error) => <p key={error} className="text-xs font-semibold text-[#FF8B8B]">{error}</p>)}
          </div>
        )}

        {plan.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-bold">Anteprima</p>
              <span className="text-xs text-[rgba(251,243,222,0.58)]">
                {plan.length} squadre{pending > 0 ? ` · ${pending} da decidere` : ""}
              </span>
            </div>
            <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-[rgba(251,243,222,0.12)]">
              {plan.map((row) => {
                const decision = decisions[row.rowNumber];
                const different = row.existing && row.comparison && !row.comparison.same;
                const badge = !row.existing
                  ? { text: edition ? "Nuova · verrà creata e iscritta" : "Nuova · verrà creata", color: "#BBFF5E" }
                  : different
                    ? { text: "Nome già esistente · giocatori diversi", color: "#FFC857" }
                    : { text: "Nome già esistente · stessi giocatori", color: "#9ED8FF" };
                return (
                  <div key={row.rowNumber} className={`border-b border-[rgba(251,243,222,0.08)] px-3 py-3 last:border-b-0 ${!decision?.action ? "bg-[rgba(255,200,87,0.06)]" : ""}`}>
                    <div className="flex items-start gap-3">
                      <span className="w-8 shrink-0 text-[11px] text-[rgba(251,243,222,0.45)]">R{row.rowNumber}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{row.name}</p>
                        <p className="mt-0.5 text-[11px] font-bold" style={{ color: badge.color }}>{badge.text}</p>
                        <p className="mt-1 text-xs text-[rgba(251,243,222,0.62)]">
                          {row.existing ? "Nel file: " : ""}{row.roster.join(", ")}
                        </p>
                        {row.existing && (
                          <>
                            <p className="mt-0.5 text-xs text-[rgba(251,243,222,0.62)]">
                              Attuali: {(row.existing.roster ?? []).join(", ") || "nessun giocatore"}
                            </p>
                            {different && (
                              <p className="mt-0.5 text-xs">
                                {row.comparison!.added.length > 0 && <span className="text-[#BBFF5E]">+ {row.comparison!.added.join(", ")} </span>}
                                {row.comparison!.removed.length > 0 && <span className="text-[#FF8B8B]">− {row.comparison!.removed.join(", ")}</span>}
                              </p>
                            )}
                            {edition && row.enrolled && (
                              <p className="mt-0.5 text-xs text-[rgba(251,243,222,0.5)]">Già iscritta a questo campionato.</p>
                            )}
                            {!row.compatible && (
                              <p className="mt-0.5 text-xs text-[#FF8B8B]">Non compatibile con questa categoria: si può solo creare una copia.</p>
                            )}
                            <div className="mt-2 grid gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label={`Cosa fare con ${row.name}`}>
                              {([
                                ["use", different ? "Usa quella esistente, senza modifiche" : "Usa quella esistente", !row.compatible],
                                ["replace", "Sostituisci i giocatori con quelli del file", !row.compatible || !different],
                                ["copy", "Crea una copia con un altro nome", false],
                                ["skip", "Salta questa squadra", false],
                              ] as const).filter(([, , hidden]) => !hidden).map(([action, label]) => (
                                <label key={action} className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${decision?.action === action ? "border-[#BBFF5E] bg-[rgba(187,255,94,0.08)]" : "border-[rgba(251,243,222,0.12)]"}`}>
                                  <input
                                    type="radio"
                                    name={`team-import-${row.rowNumber}`}
                                    checked={decision?.action === action}
                                    onChange={() => setDecision(row.rowNumber, { action })}
                                    className="accent-[#BBFF5E]"
                                  />
                                  {label}
                                </label>
                              ))}
                            </div>
                            {decision?.action === "copy" && (
                              <input
                                value={decision.copyName}
                                onChange={(event) => setDecision(row.rowNumber, { copyName: event.target.value })}
                                placeholder="Nome della nuova squadra"
                                aria-label={`Nome della copia di ${row.name}`}
                                className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm ${
                                  normalizeTeamKey(decision.copyName) ? "border-[rgba(251,243,222,0.18)]" : "border-[#FF8B8B]"
                                }`}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={confirmImport}
            disabled={!canImport}
            className="flex-1 rounded-lg bg-lime py-2.5 text-sm font-bold text-[#081208] disabled:opacity-40"
          >
            {importing
              ? "Importazione..."
              : pending > 0
                ? `Scegli cosa fare per ${pending === 1 ? "1 squadra" : `${pending} squadre`}`
                : `Importa ${toImport === 1 ? "1 squadra" : `${toImport || ""} squadre`}`}
          </button>
          <button type="button" onClick={onClose} disabled={reading || importing} className="flex-1 rounded-lg border border-[rgba(251,243,222,0.18)] py-2.5 text-sm font-semibold disabled:opacity-50">
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
