// Interpreta righe di testo incollate da Excel o Word (copia-incolla di una tabella).
// Ogni riga valida deve terminare con due numeri (es. punti e tappe, oppure
// partite giocate e punti): tutto quello che precede è il nome, con un eventuale
// numero di posizione iniziale che viene scartato automaticamente.
// Righe non riconosciute (intestazioni, righe vuote o segnaposto tipo "—") vengono ignorate.

export interface ParsedRow {
  name: string;
  num1: number;
  num2: number;
}

export function parsePastedTable(text: string): { rows: ParsedRow[]; skippedLines: string[] } {
  const rows: ParsedRow[] = [];
  const skippedLines: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const tokens = line.split(/\s+/).filter(Boolean);
    if (tokens.length < 3) {
      skippedLines.push(rawLine);
      continue;
    }

    const last2 = tokens.slice(-2);
    const isNumeric = (t: string) => /^-?\d+$/.test(t);
    if (!isNumeric(last2[0]) || !isNumeric(last2[1])) {
      skippedLines.push(rawLine);
      continue;
    }

    const num1 = parseInt(last2[0], 10);
    const num2 = parseInt(last2[1], 10);
    let rest = tokens.slice(0, -2);
    if (rest.length > 1 && isNumeric(rest[0])) {
      rest = rest.slice(1); // scarta il numero di posizione iniziale
    }
    const name = rest.join(" ").trim();

    if (!name || name === "—" || name === "-") {
      skippedLines.push(rawLine);
      continue;
    }

    rows.push({ name, num1, num2 });
  }

  return { rows, skippedLines };
}
