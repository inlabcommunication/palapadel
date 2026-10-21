import test from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import { excelCellToText, readFirstSheetAsText } from "../src/lib/excelSheetReader.js";
import { parseScheduleText } from "../src/lib/scheduleImportParser.ts";
import { parseTeamImportRows } from "../src/lib/teamImportParser.ts";
import { validateAdminImportFile } from "../src/lib/excelImportPolicy.js";

type Cell = string | number | { date: number } | { time: number } | null;

// Crea un vero file .xlsx minimo: stringhe condivise, numeri, una cella data
// (formato 14) e una cella orario (formato 20).
function buildXlsx(rows: Cell[][]): ArrayBuffer {
  const strings: string[] = [];
  const col = (index: number) => String.fromCharCode(65 + index);
  const sheetRows = rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) => {
          const ref = `${col(c)}${r + 1}`;
          if (cell === null) return "";
          if (typeof cell === "string") {
            strings.push(cell);
            return `<c r="${ref}" t="s"><v>${strings.length - 1}</v></c>`;
          }
          if (typeof cell === "number") return `<c r="${ref}"><v>${cell}</v></c>`;
          if ("date" in cell) return `<c r="${ref}" s="1"><v>${cell.date}</v></c>`;
          return `<c r="${ref}" s="2"><v>${cell.time}</v></c>`;
        })
        .join("");
      return cells ? `<row r="${r + 1}">${cells}</row>` : "";
    })
    .join("");
  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const zip = zipSync({
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><workbook ${ns} xmlns:r="${rel}"><sheets><sheet name="Foglio1" sheetId="1" r:id="rId1"/></sheets></workbook>`
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/><Relationship Id="rId3" Type="${rel}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`
    ),
    "xl/styles.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><styleSheet ${ns}><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/><xf numFmtId="20" applyNumberFormat="1"/></cellXfs></styleSheet>`
    ),
    "xl/sharedStrings.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><sst ${ns} count="${strings.length}" uniqueCount="${strings.length}">${strings
        .map((text) => `<si><t>${text}</t></si>`)
        .join("")}</sst>`
    ),
    "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><worksheet ${ns}><sheetData>${sheetRows}</sheetData></worksheet>`),
  });
  return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
}

test("le celle diventano testo: date AAAA-MM-GG, orari HH:MM, numeri e vuoti", () => {
  assert.equal(excelCellToText(new Date(Date.UTC(2026, 9, 21))), "2026-10-21");
  assert.equal(excelCellToText(new Date(Date.UTC(1899, 11, 30, 20, 30))), "20:30");
  assert.equal(excelCellToText(new Date(Date.UTC(2026, 9, 21, 9, 5))), "2026-10-21 09:05");
  assert.equal(excelCellToText(3), "3");
  assert.equal(excelCellToText("  Campo 1 "), "Campo 1");
  assert.equal(excelCellToText(null), "");
});

test("calendario da .xlsx: date e orari Excel arrivano al parser nel formato atteso", async () => {
  const buffer = buildXlsx([
    [1, { date: 46316 }, { time: 0.8541666666666666 }, "Padel Lions", "Smash Team", "Campo 1"],
    [2, "28/10/2026", "19:00", "Team C", "Team D", null, "Nota"],
  ]);
  const table = await readFirstSheetAsText(buffer, { maxRows: 2000, maxColumns: 8 });
  const rows = parseScheduleText(table.map((row) => row.join(";")).join("\n"));
  assert.deepEqual(rows, [
    { matchdayNumber: 1, matchDate: "2026-10-21", matchTime: "20:30", homeTeamName: "Padel Lions", awayTeamName: "Smash Team", court: "Campo 1", notes: undefined },
    { matchdayNumber: 2, matchDate: "2026-10-28", matchTime: "19:00", homeTeamName: "Team C", awayTeamName: "Team D", court: undefined, notes: "Nota" },
  ]);
});

test("squadre da .xlsx: righe vuote intermedie mantengono il numero di riga", async () => {
  const buffer = buildXlsx([
    ["Nome squadra", "Giocatore 1", "Giocatore 2"],
    ["Padel Team", "Anna", "Luca"],
    [],
    ["Smash", "Marco", "Sara", "Paolo"],
  ]);
  const rows = await readFirstSheetAsText(buffer, { maxRows: 2000, maxColumns: 7 });
  const result = parseTeamImportRows(rows);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.teams, [
    { rowNumber: 2, name: "Padel Team", roster: ["Anna", "Luca"] },
    { rowNumber: 4, name: "Smash", roster: ["Marco", "Sara", "Paolo"] },
  ]);
});

test("limiti di righe e colonne vengono applicati", async () => {
  const buffer = buildXlsx([
    ["A", "B", "C"],
    ["D", "E", "F"],
  ]);
  assert.deepEqual(await readFirstSheetAsText(buffer, { maxRows: 1, maxColumns: 2 }), [["A", "B"]]);
});

test("un file non valido dà un errore chiaro", async () => {
  await assert.rejects(readFirstSheetAsText(new TextEncoder().encode("non sono un excel").buffer as ArrayBuffer, { maxRows: 10, maxColumns: 2 }), /xlsx valido/);
});

test("i vecchi .xls vengono rifiutati con l'indicazione di salvarli come .xlsx", () => {
  assert.match(validateAdminImportFile({ name: "squadre.xls", size: 1024 }, ["xlsx"]) ?? "", /salvalo come \.xlsx/);
});
