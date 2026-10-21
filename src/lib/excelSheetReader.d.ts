export function excelCellToText(value: unknown): string;
export function readFirstSheetAsText(
  buffer: ArrayBuffer,
  options: { maxRows: number; maxColumns: number }
): Promise<string[][]>;
