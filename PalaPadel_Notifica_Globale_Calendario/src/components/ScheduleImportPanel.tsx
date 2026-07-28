import { useState } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { importSchedule, type ScheduleImportRow } from "../lib/championshipAdminApi";
import { parseScheduleFile, parseScheduleText, type ParsedScheduleRow } from "../lib/scheduleImportParser";
import { matchTeamName } from "../lib/teamNameMatch";
import type { Team } from "../types";

type EditableRow = ParsedScheduleRow & { homeTeamId: string; awayTeamId: string; warning?: string };

export function ScheduleImportPanel({ editionId, teams, onClose, onDone }: {
  editionId: string;
  teams: Team[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const prepare = (parsed: ParsedScheduleRow[]) => {
    setError(parsed.length === 0 ? "Nessuna partita riconosciuta. Controlla il formato del file o del testo." : "");
    setRows(parsed.map((row) => {
      const home = matchTeamName(row.homeTeamName, teams);
      const away = matchTeamName(row.awayTeamName, teams);
      return {
        ...row,
        homeTeamId: home.kind === "exact" ? home.candidate.id : "",
        awayTeamId: away.kind === "exact" ? away.candidate.id : "",
        warning: [
          home.kind === "similar" ? `Conferma "${home.candidate.name}" per "${row.homeTeamName}"` : home.kind === "none" ? `Squadra non riconosciuta: ${row.homeTeamName}` : "",
          away.kind === "similar" ? `Conferma "${away.candidate.name}" per "${row.awayTeamName}"` : away.kind === "none" ? `Squadra non riconosciuta: ${row.awayTeamName}` : "",
        ].filter(Boolean).join(" · ") || undefined,
      };
    }));
  };

  const updateRow = (index: number, patch: Partial<EditableRow>) => {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  };

  const confirmImport = async () => {
    if (rows.length === 0 || rows.some((row) => !row.homeTeamId || !row.awayTeamId || row.homeTeamId === row.awayTeamId)) {
      setError("Correggi tutte le righe segnalate prima di importare.");
      return;
    }
    if (mode === "replace" && !window.confirm("Sostituire l'intero calendario esistente?")) return;
    setError("");
    setBusy(true);
    try {
      const payload: ScheduleImportRow[] = rows.map((row) => ({
        matchdayNumber: row.matchdayNumber,
        team1Id: row.homeTeamId,
        team2Id: row.awayTeamId,
        matchDate: row.matchDate,
        matchTime: row.matchTime,
        court: row.court,
        notes: row.notes,
      }));
      const result = await importSchedule(editionId, mode, payload);
      onDone(`${result.imported} partite importate.`);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Importazione non riuscita.";
      setError(message);
      onDone(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-4 rounded-lg border border-[rgba(251,243,222,0.14)] bg-[#0A0B08] p-3">
      <div className="mb-3 flex items-center justify-between"><strong className="text-sm">Importa calendario</strong><button onClick={onClose} aria-label="Chiudi importazione"><X size={17} /></button></div>
      <textarea value={text} onChange={(event) => setText(event.target.value)} rows={6}
        placeholder={"Giornata 1\nSquadra A - Squadra B | 2027-01-10 | 20:30 | Campo 1"}
        className="w-full rounded-lg border border-[rgba(251,243,222,0.16)] bg-[#123008] p-2 text-xs" />
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => prepare(parseScheduleText(text))} className="rounded-lg bg-[#BBFF5E] px-3 py-2 text-xs font-bold text-[#081208]">Analizza testo</button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[rgba(251,243,222,0.16)] px-3 py-2 text-xs font-bold">
          <Upload size={14} /> Excel o Word
          <input type="file" accept=".xlsx,.xls,.docx,.txt" className="hidden" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) prepare(await parseScheduleFile(file));
          }} />
        </label>
        <select value={mode} onChange={(event) => setMode(event.target.value as "add" | "replace")} className="rounded-lg border border-[rgba(251,243,222,0.16)] bg-[#0A0B08] px-2 text-xs">
          <option value="add">Aggiungi soltanto mancanti</option>
          <option value="replace">Sostituisci calendario</option>
        </select>
      </div>
      {error && <p role="alert" className="mt-2 rounded-lg bg-[rgba(255,96,96,0.12)] p-2 text-xs text-[#FFB3B3]">{error}</p>}

      {rows.length > 0 && (
        <div className="mt-3 space-y-2">
          {rows.map((row, index) => (
            <div key={`${index}-${row.matchdayNumber}`} className="rounded-lg bg-[rgba(251,243,222,0.05)] p-2">
              <div className="grid grid-cols-[56px_1fr_1fr] gap-2">
                <input aria-label="Numero giornata" type="number" min={1} value={row.matchdayNumber} onChange={(event) => updateRow(index, { matchdayNumber: Number(event.target.value) })} className="rounded-md px-2 text-xs" />
                <select aria-label={`Squadra di casa riga ${index + 1}`} value={row.homeTeamId} onChange={(event) => updateRow(index, { homeTeamId: event.target.value, warning: undefined })} className="rounded-md px-2 text-xs">
                  <option value="">{row.homeTeamName}</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
                <select aria-label={`Squadra ospite riga ${index + 1}`} value={row.awayTeamId} onChange={(event) => updateRow(index, { awayTeamId: event.target.value, warning: undefined })} className="rounded-md px-2 text-xs">
                  <option value="">{row.awayTeamName}</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <input aria-label={`Data riga ${index + 1}`} type="date" value={row.matchDate ?? ""} onChange={(event) => updateRow(index, { matchDate: event.target.value || undefined })} className="rounded-md px-2 py-1.5 text-xs" />
                <input aria-label={`Ora riga ${index + 1}`} type="time" value={row.matchTime ?? ""} onChange={(event) => updateRow(index, { matchTime: event.target.value || undefined })} className="rounded-md px-2 py-1.5 text-xs" />
                <input aria-label={`Campo riga ${index + 1}`} value={row.court ?? ""} onChange={(event) => updateRow(index, { court: event.target.value || undefined })} placeholder="Campo" className="rounded-md px-2 py-1.5 text-xs" />
                <input aria-label={`Note riga ${index + 1}`} value={row.notes ?? ""} onChange={(event) => updateRow(index, { notes: event.target.value || undefined })} placeholder="Note" className="rounded-md px-2 py-1.5 text-xs" />
              </div>
              {row.warning && <p className="mt-1 text-[11px] text-[#FFB38B]">{row.warning}</p>}
            </div>
          ))}
          <button onClick={confirmImport} disabled={busy || rows.some((row) => !row.homeTeamId || !row.awayTeamId || row.homeTeamId === row.awayTeamId)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#BBFF5E] py-2.5 text-sm font-bold text-[#081208] disabled:opacity-40">
            <FileSpreadsheet size={16} /> {busy ? "Importazione..." : `Conferma ${rows.length} partite`}
          </button>
        </div>
      )}
    </section>
  );
}
