import { MAX_ADMIN_IMPORT_ROWS, validateAdminImportFile } from "./excelImportPolicy.js";

export interface ParsedScheduleRow {
  matchdayNumber: number;
  matchDate?: string;
  matchTime?: string;
  homeTeamName: string;
  awayTeamName: string;
  court?: string;
  notes?: string;
}

export function parseScheduleText(text: string): ParsedScheduleRow[] {
  const rows: ParsedScheduleRow[] = [];
  let currentMatchday = 0;
  for (const originalLine of text.split(/\r?\n/)) {
    const line = originalLine.trim();
    if (!line) continue;
    const heading = line.match(/^giornata\s+(\d+)$/i);
    if (heading) {
      currentMatchday = Number(heading[1]);
      continue;
    }

    const columns = line.includes("\t") ? line.split("\t") : line.includes(";") ? line.split(";") : line.split(/\s+\|\s+/);
    if (columns.length >= 5 && /^\d+$/.test(columns[0].trim())) {
      rows.push({
        matchdayNumber: Number(columns[0]),
        matchDate: normalizeDate(columns[1]),
        matchTime: normalizeTime(columns[2]),
        homeTeamName: columns[3].trim(),
        awayTeamName: columns[4].trim(),
        court: columns[5]?.trim() || undefined,
        notes: columns[6]?.trim() || undefined,
      });
      continue;
    }

    const pipeParts = line.split(/\s+\|\s+/);
    const pair = pipeParts[0].match(/^(.+?)\s+-\s+(.+)$/);
    if (pair && currentMatchday > 0) {
      rows.push({
        matchdayNumber: currentMatchday,
        homeTeamName: pair[1].trim(),
        awayTeamName: pair[2].trim(),
        ...(normalizeDate(pipeParts[1]) ? { matchDate: normalizeDate(pipeParts[1]) } : {}),
        ...(normalizeTime(pipeParts[2]) ? { matchTime: normalizeTime(pipeParts[2]) } : {}),
        ...(pipeParts[3]?.trim() ? { court: pipeParts[3].trim() } : {}),
        ...(pipeParts[4]?.trim() ? { notes: pipeParts[4].trim() } : {}),
      });
    }
  }
  return rows.filter((row) => row.matchdayNumber > 0 && row.homeTeamName && row.awayTeamName);
}

export async function parseScheduleFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const validationError = validateAdminImportFile(file, ["xlsx", "xls", "docx", "txt"]);
  if (validationError) throw new Error(validationError);
  const buffer = await file.arrayBuffer();
  if (extension === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return parseScheduleText(result.value);
  }
  if (extension === "xlsx" || extension === "xls") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "array", cellDates: false, dense: true, bookVBA: false, WTF: false });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const table = XLSX.utils.sheet_to_json<(string | number)[]>(firstSheet, { header: 1, raw: false, range: `A1:H${MAX_ADMIN_IMPORT_ROWS}` });
    return parseScheduleText(table.map((row) => row.map((cell) => String(cell ?? "")).join(";")).join("\n"));
  }
  return parseScheduleText(new TextDecoder().decode(buffer));
}

function normalizeDate(value?: string) {
  const clean = value?.trim();
  if (!clean) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const match = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : clean;
}

function normalizeTime(value?: string) {
  const clean = value?.trim();
  if (!clean) return undefined;
  const match = clean.match(/^(\d{1,2}):(\d{2})$/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : clean;
}
