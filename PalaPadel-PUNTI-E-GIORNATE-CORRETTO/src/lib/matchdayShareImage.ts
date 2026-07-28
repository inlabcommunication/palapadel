export const MATCHDAY_SHARE_WIDTH = 1080;
export const MATCHDAY_SHARE_HEIGHT = 1920;
export const MATCHDAY_SHARE_MAX_MATCHES = 6;

export interface MatchdayShareMatch {
  homeTeam: string;
  awayTeam: string;
  result?: string;
  status: string;
  matchDate?: string;
  matchTime?: string;
  court?: string;
}

export interface MatchdayShareInput {
  categoryName: string;
  season: string;
  matchdayNumber: number;
  matches: MatchdayShareMatch[];
}

export interface GeneratedMatchdayShareImage {
  page: number;
  pageCount: number;
  filename: string;
  dataUrl: string;
  blob: Blob;
}

function sanitizeFilenamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56) || "giornata";
}

export function paginateMatchdayMatches<T>(matches: T[], max = MATCHDAY_SHARE_MAX_MATCHES): T[][] {
  if (max < 1) throw new Error("max must be greater than zero");
  if (matches.length === 0) return [[]];
  const pages: T[][] = [];
  for (let index = 0; index < matches.length; index += max) pages.push(matches.slice(index, index + max));
  return pages;
}

export function buildMatchdayShareFilename(input: MatchdayShareInput, page = 1, count = 1) {
  const suffix = count > 1 ? `-pagina-${page}` : "";
  return `palapadel-giornata-${input.matchdayNumber}-${sanitizeFilenamePart(input.categoryName)}-${sanitizeFilenamePart(input.season)}${suffix}.png`;
}

export function matchMetaParts(match: MatchdayShareMatch): string[] {
  const parts: string[] = [];
  if (match.matchDate) {
    const parsed = new Date(`${match.matchDate}T12:00:00`);
    parts.push(Number.isNaN(parsed.getTime()) ? match.matchDate : parsed.toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }));
  }
  if (match.matchTime) parts.push(`ore ${match.matchTime}`);
  if (match.court) parts.push(match.court);
  return parts;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  let size = 36;
  while (size > 24) {
    ctx.font = `800 ${size}px Inter, Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.fillText(text, x, y, maxWidth);
}

function statusText(match: MatchdayShareMatch) {
  if (match.status === "conclusa" && match.result) return match.result.replace("-", " - ");
  if (match.status === "rinviata") return "RINVIATA";
  if (match.status === "annullata") return "ANNULLATA";
  return "VS";
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Impossibile generare il PNG della giornata.")),
    "image/png"
  ));
}

function drawPage(input: MatchdayShareInput, matches: MatchdayShareMatch[], page: number, count: number) {
  const canvas = document.createElement("canvas");
  canvas.width = MATCHDAY_SHARE_WIDTH;
  canvas.height = MATCHDAY_SHARE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile.");

  const gradient = ctx.createLinearGradient(0, 0, MATCHDAY_SHARE_WIDTH, MATCHDAY_SHARE_HEIGHT);
  gradient.addColorStop(0, "#06140B");
  gradient.addColorStop(0.55, "#123008");
  gradient.addColorStop(1, "#0A0B08");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, MATCHDAY_SHARE_WIDTH, MATCHDAY_SHARE_HEIGHT);

  ctx.fillStyle = "#BBFF5E";
  ctx.font = "900 38px Inter, Arial, sans-serif";
  ctx.fillText("PALA PADEL", 100, 210);
  ctx.fillStyle = "#FBF3DE";
  ctx.font = "900 76px Inter, Arial, sans-serif";
  ctx.fillText(`GIORNATA ${input.matchdayNumber}`, 100, 310);
  ctx.fillStyle = "rgba(251,243,222,0.78)";
  fitText(ctx, `${input.categoryName} - ${input.season}`, 100, 372, 880);
  if (count > 1) {
    ctx.textAlign = "right";
    ctx.font = "700 25px Inter, Arial, sans-serif";
    ctx.fillText(`${page} DI ${count}`, 980, 210);
    ctx.textAlign = "left";
  }

  if (matches.length === 0) {
    ctx.fillStyle = "rgba(251,243,222,0.58)";
    ctx.font = "700 34px Inter, Arial, sans-serif";
    ctx.fillText("Nessuna partita in questa giornata.", 100, 560);
  }

  matches.forEach((match, index) => {
    const y = 460 + index * 205;
    ctx.fillStyle = "rgba(10,11,8,0.72)";
    ctx.beginPath();
    ctx.roundRect(100, y, 880, 175, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(251,243,222,0.12)";
    ctx.stroke();

    ctx.fillStyle = "#FBF3DE";
    fitText(ctx, match.homeTeam, 135, y + 55, 620);
    fitText(ctx, match.awayTeam, 135, y + 112, 620);
    ctx.textAlign = "right";
    ctx.fillStyle = match.status === "conclusa" ? "#BBFF5E" : match.status === "rinviata" ? "#FF9B6B" : "#FBF3DE";
    ctx.font = "900 42px Inter, Arial, sans-serif";
    ctx.fillText(statusText(match), 940, y + 88);
    ctx.textAlign = "left";

    const meta = matchMetaParts(match);
    if (meta.length > 0) {
      ctx.fillStyle = "rgba(251,243,222,0.56)";
      ctx.font = "600 22px Inter, Arial, sans-serif";
      ctx.fillText(meta.join(" - "), 135, y + 151, 780);
    }
  });

  ctx.fillStyle = "rgba(251,243,222,0.42)";
  ctx.font = "700 22px Inter, Arial, sans-serif";
  ctx.fillText("palapadel.it", 100, MATCHDAY_SHARE_HEIGHT - 250);
  return canvas;
}

export async function generateMatchdayShareImages(input: MatchdayShareInput): Promise<GeneratedMatchdayShareImage[]> {
  await document.fonts?.ready.catch(() => undefined);
  const pages = paginateMatchdayMatches(input.matches);
  const generated: GeneratedMatchdayShareImage[] = [];
  for (let index = 0; index < pages.length; index += 1) {
    const page = index + 1;
    const canvas = drawPage(input, pages[index], page, pages.length);
    generated.push({
      page,
      pageCount: pages.length,
      filename: buildMatchdayShareFilename(input, page, pages.length),
      dataUrl: canvas.toDataURL("image/png"),
      blob: await canvasBlob(canvas),
    });
  }
  return generated;
}
