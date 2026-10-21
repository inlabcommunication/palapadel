import { MAX_ADMIN_IMPORT_ROWS, validateAdminImportFile } from "./excelImportPolicy.js";
import { readFirstSheetAsText } from "./excelSheetReader.js";

export interface ImportedTeamRow {
  rowNumber: number;
  name: string;
  roster: string[];
}

export interface TeamImportParseResult {
  teams: ImportedTeamRow[];
  errors: string[];
}

function cellText(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function normalizedName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isHeaderRow(row: unknown[]): boolean {
  const first = normalizedName(cellText(row[0]));
  return first === "nome squadra" || first === "squadra" || first === "team";
}

export function parseTeamImportRows(rows: unknown[][]): TeamImportParseResult {
  const teams: ImportedTeamRow[] = [];
  const errors: string[] = [];
  const seen = new Map<string, number>();

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    if (row.every((cell) => !cellText(cell))) return;
    if (index === 0 && isHeaderRow(row)) return;

    const name = cellText(row[0]);
    const roster = row.slice(1, 7).map(cellText).filter(Boolean);
    if (!name) {
      errors.push(`Riga ${rowNumber}: nome squadra mancante.`);
      return;
    }
    if (roster.length < 2 || roster.length > 6) {
      errors.push(`Riga ${rowNumber}: la rosa di "${name}" deve contenere da 2 a 6 giocatori.`);
      return;
    }

    const key = normalizedName(name);
    const duplicateRow = seen.get(key);
    if (duplicateRow) {
      errors.push(`Riga ${rowNumber}: "${name}" duplica la squadra della riga ${duplicateRow}.`);
      return;
    }
    seen.set(key, rowNumber);
    teams.push({ rowNumber, name, roster });
  });

  if (teams.length === 0 && errors.length === 0) errors.push("Il file non contiene squadre da importare.");
  return { teams, errors };
}

export async function parseTeamImportFile(file: File): Promise<TeamImportParseResult> {
  const validationError = validateAdminImportFile(file, ["xlsx"]);
  if (validationError) return { teams: [], errors: [validationError] };
  let rows: string[][];
  try {
    rows = await readFirstSheetAsText(await file.arrayBuffer(), { maxRows: MAX_ADMIN_IMPORT_ROWS, maxColumns: 7 });
  } catch (err) {
    return { teams: [], errors: [err instanceof Error ? err.message : "File Excel non leggibile."] };
  }
  return parseTeamImportRows(rows);
}
