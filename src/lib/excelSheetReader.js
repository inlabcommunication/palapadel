// File JavaScript (con tipi in excelSheetReader.d.ts) come excelImportPolicy.js, così
// i test Node possono importarlo direttamente.
//
// Lettura dei file Excel (.xlsx) per gli import amministrativi, con read-excel-file.
// Restituisce sempre testo, come faceva prima SheetJS con raw: false, così i parser
// (squadre, calendario) restano invariati. La libreria viene scaricata solo quando
// serve, e la variante "universal" funziona sia nel browser sia nei test Node.

function pad(value) {
  return String(value).padStart(2, "0");
}

/**
 * Converte una cella in testo. Le date diventano "AAAA-MM-GG" e gli orari "HH:MM"
 * (formati già accettati dal parser del calendario). Excel non ha fuso orario: la
 * libreria rappresenta le date in UTC, quindi si leggono i campi UTC.
 */
export function excelCellToText(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const time = `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
    // Le celle con solo l'orario hanno come data il 30/12/1899 o lo 01/01/1900.
    if (value.getUTCFullYear() <= 1900) return time;
    const date = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
    return time === "00:00" ? date : `${date} ${time}`;
  }
  return String(value).trim();
}

export async function readFirstSheetAsText(buffer, { maxRows, maxColumns }) {
  const { readSheet } = await import("read-excel-file/universal");
  let rows;
  try {
    rows = await readSheet(buffer);
  } catch (err) {
    console.error(err);
    throw new Error("Il file non è un Excel .xlsx valido o è danneggiato.");
  }
  return rows.slice(0, maxRows).map((row) => row.slice(0, maxColumns).map(excelCellToText));
}
