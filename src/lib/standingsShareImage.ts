export type StandingsShareKind = "team" | "female";

export interface StandingShareRow {
  position: number;
  name: string;
  points: number;
  played?: number;
  stages?: number;
  status: string;
}

export interface StandingsShareInput {
  categoryName: string;
  season: string;
  kind: StandingsShareKind;
  rows: StandingShareRow[];
  championshipLogoUrl?: string;
}

export interface GeneratedStandingsShareImage {
  page: number;
  pageCount: number;
  filename: string;
  dataUrl: string;
  blob: Blob;
}

export const STANDINGS_SHARE_WIDTH = 1080;
export const STANDINGS_SHARE_HEIGHT = 1920;
export const STANDINGS_SHARE_MAX_ROWS_PER_IMAGE = 14;

export function paginateStandingRows<T>(rows: T[], maxRows = STANDINGS_SHARE_MAX_ROWS_PER_IMAGE): T[][] {
  if (maxRows < 1) throw new Error("maxRows must be greater than zero");
  if (rows.length === 0) return [[]];

  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += maxRows) {
    pages.push(rows.slice(i, i + maxRows));
  }
  return pages;
}

export function sanitizeFilenamePart(value: string): string {
  const ascii = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56) || "classifica";
}

export function buildStandingsShareFilename(input: StandingsShareInput, page = 1, pageCount = 1): string {
  const category = sanitizeFilenamePart(input.categoryName);
  const season = sanitizeFilenamePart(input.season);
  const pageSuffix = pageCount > 1 ? `-pagina-${page}` : "";
  return `palapadel-classifica-${category}-${season}${pageSuffix}.png`;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Impossibile generare il PNG della classifica."));
    }, "image/png");
  });
}

function drawTextFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontFamily: string,
  maxSize: number,
  minSize: number,
  weight = "700"
) {
  let size = maxSize;
  do {
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth || size <= minSize) break;
    size -= 2;
  } while (size >= minSize);
  ctx.fillText(text, x, y, maxWidth);
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function statusLabel(status: string): string {
  if (status === "ritirata") return "RITIRATA";
  if (status === "squalificata") return "SQUALIFICATA";
  return "";
}

function loadCanvasImage(url?: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

async function drawImagePage(input: StandingsShareInput, rows: StandingShareRow[], page: number, pageCount: number): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = STANDINGS_SHARE_WIDTH;
  canvas.height = STANDINGS_SHARE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile.");

  const width = STANDINGS_SHARE_WIDTH;
  const height = STANDINGS_SHARE_HEIGHT;
  const font = "Inter, Arial, sans-serif";

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#06140B");
  bg.addColorStop(0.48, "#123008");
  bg.addColorStop(1, "#15120B");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(251,243,222,0.09)";
  ctx.lineWidth = 5;
  for (let i = 0; i < 10; i += 1) {
    const y = 300 + i * 150;
    ctx.beginPath();
    ctx.moveTo(100, y);
    ctx.lineTo(width - 100, y - 130);
    ctx.stroke();
  }

  const [championshipLogo, palaPadelLogo] = await Promise.all([
    loadCanvasImage(input.championshipLogoUrl),
    loadCanvasImage("/palapadel-club-transparent.png"),
  ]);

  if (championshipLogo) {
    drawRoundRect(ctx, 100, 82, 150, 150, 24);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "rgba(251,243,222,0.08)";
    ctx.fillRect(100, 82, 150, 150);
    drawImageContain(ctx, championshipLogo, 112, 94, 126, 126);
    ctx.restore();
  } else {
    drawRoundRect(ctx, 100, 82, 150, 150, 24);
    ctx.fillStyle = "rgba(187,255,94,0.12)";
    ctx.fill();
    ctx.fillStyle = "#BBFF5E";
    ctx.font = `900 30px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText(input.categoryName.slice(0, 3).toUpperCase(), 175, 172);
    ctx.textAlign = "left";
  }

  if (palaPadelLogo) {
    drawImageContain(ctx, palaPadelLogo, width - 570, 88, 470, 135);
  }

  ctx.fillStyle = "#FBF3DE";
  drawTextFit(ctx, "CLASSIFICA", 100, 330, 880, font, 84, 58, "900");

  ctx.fillStyle = "rgba(251,243,222,0.82)";
  drawTextFit(ctx, `${input.categoryName} - ${input.season}`, 100, 390, 880, font, 36, 25, "700");

  if (pageCount > 1) {
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(251,243,222,0.62)";
    ctx.font = `700 25px ${font}`;
    ctx.fillText(`CLASSIFICA - ${page} DI ${pageCount}`, width - 100, 210);
    ctx.textAlign = "left";
  }

  const tableX = 100;
  const tableY = 450;
  const tableW = width - 200;
  const rowH = 76;
  const headerH = 70;

  drawRoundRect(ctx, tableX, tableY, tableW, headerH + rowH * Math.max(rows.length, 1) + 28, 18);
  ctx.fillStyle = "rgba(10,11,8,0.62)";
  ctx.fill();
  ctx.strokeStyle = "rgba(251,243,222,0.13)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(251,243,222,0.48)";
  ctx.font = `800 25px ${font}`;
  ctx.fillText("#", tableX + 34, tableY + 38);
  ctx.fillText(input.kind === "team" ? "SQUADRA" : "GIOCATRICE", tableX + 105, tableY + 44);
  ctx.textAlign = "center";
  ctx.fillText(input.kind === "team" ? "PG" : "TAPPE", tableX + tableW - 180, tableY + 44);
  ctx.fillText("PT", tableX + tableW - 62, tableY + 44);
  ctx.textAlign = "left";

  if (rows.length === 0) {
    ctx.fillStyle = "rgba(251,243,222,0.62)";
    ctx.font = `700 36px ${font}`;
    ctx.fillText("Nessuna riga in classifica.", tableX + 34, tableY + 150);
  }

  rows.forEach((row, index) => {
    const y = tableY + headerH + index * rowH;
    const inactive = row.status !== "normale";
    if (index % 2 === 0) {
      ctx.fillStyle = "rgba(251,243,222,0.045)";
      ctx.fillRect(tableX + 18, y, tableW - 36, rowH);
    }

    ctx.fillStyle = inactive ? "rgba(251,243,222,0.48)" : "#FBF3DE";
    ctx.font = `800 27px ${font}`;
    ctx.fillText(String(row.position), tableX + 34, y + 49);

    drawTextFit(ctx, row.name, tableX + 105, y + 49, tableW - 365, font, 29, 21, "800");

    const outLabel = statusLabel(row.status);
    if (outLabel) {
      ctx.fillStyle = "#FF9B6B";
      ctx.font = `900 15px ${font}`;
      ctx.textAlign = "right";
      ctx.fillText(outLabel, tableX + tableW - 250, y + 65);
      ctx.textAlign = "left";
    }

    ctx.fillStyle = inactive ? "rgba(251,243,222,0.42)" : "rgba(251,243,222,0.84)";
    ctx.font = `800 27px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText(String(input.kind === "team" ? row.played ?? 0 : row.stages ?? 0), tableX + tableW - 180, y + 49);

    ctx.fillStyle = inactive ? "#FF9B6B" : "#BBFF5E";
    ctx.font = `900 31px ${font}`;
    ctx.fillText(String(row.points), tableX + tableW - 62, y + 50);
    ctx.textAlign = "left";
  });

  return canvas;
}

export async function generateStandingsShareImages(input: StandingsShareInput): Promise<GeneratedStandingsShareImage[]> {
  await document.fonts?.ready.catch(() => undefined);
  const pages = paginateStandingRows(input.rows);
  const pageCount = pages.length;
  const images: GeneratedStandingsShareImage[] = [];

  for (let index = 0; index < pages.length; index += 1) {
    const page = index + 1;
    const canvas = await drawImagePage(input, pages[index], page, pageCount);
    const blob = await canvasToBlob(canvas);
    images.push({
      page,
      pageCount,
      filename: buildStandingsShareFilename(input, page, pageCount),
      dataUrl: canvas.toDataURL("image/png"),
      blob,
    });
  }

  return images;
}
