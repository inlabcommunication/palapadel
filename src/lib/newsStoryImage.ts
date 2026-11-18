import type { HomeNews } from "../types";

// Immagine verticale 1080x1920 (formato Storia di Instagram) di una PalaPadel News.

export const NEWS_STORY_WIDTH = 1080;
export const NEWS_STORY_HEIGHT = 1920;

export interface GeneratedNewsStory {
  blob: Blob;
  dataUrl: string;
  filename: string;
}

function loadImageElement(url: string, crossOrigin = false): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** Le immagini su Firebase Storage vanno lette in CORS, altrimenti il canvas non si può esportare. */
async function loadCanvasImage(url?: string): Promise<HTMLImageElement | null> {
  if (!url) return null;
  if (url.startsWith("/") || url.startsWith(window.location.origin)) return loadImageElement(url);
  try {
    const response = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (!response.ok) return loadImageElement(url, true);
    const objectUrl = URL.createObjectURL(await response.blob());
    const image = await loadImageElement(objectUrl);
    URL.revokeObjectURL(objectUrl);
    return image;
  } catch {
    return loadImageElement(url, true);
  }
}

/**
 * Copertina della news. Prima tramite il server dell'app (stesso indirizzo, quindi il
 * canvas la può usare), poi direttamente come riserva (es. immagini già sullo stesso sito).
 */
async function loadNewsCover(news: HomeNews): Promise<HTMLImageElement | null> {
  if (!news.imageUrl) return null;
  if (news.id && !news.imageUrl.startsWith("/")) {
    const viaServer = await loadImageElement(`/api/home-news/cover?id=${encodeURIComponent(news.id)}`);
    if (viaServer) return viaServer;
  }
  return loadCanvasImage(news.imageUrl);
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number, positionY = 50) {
  const ratio = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / ratio;
  const sh = h / ratio;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = Math.max(0, Math.min(image.naturalHeight - sh, (image.naturalHeight - sh) * (positionY / 100)));
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

/** Divide il testo in righe che stanno nella larghezza; l'ultima riga termina con "…" se serve. */
export function wrapText(measure: (text: string) => number, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  let index = 0;
  for (; index < words.length; index += 1) {
    const candidate = current ? `${current} ${words[index]}` : words[index];
    if (measure(candidate) <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = words[index];
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) {
    lines.push(current);
    current = "";
    index = words.length;
  }
  const truncated = index < words.length || current !== "";
  if (truncated && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }).toUpperCase();
}

export async function generateNewsStoryImage(news: HomeNews, shareUrl: string): Promise<GeneratedNewsStory> {
  await Promise.all([
    document.fonts?.load("80px Anton").catch(() => undefined),
    document.fonts?.load("600 40px Inter").catch(() => undefined),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = NEWS_STORY_WIDTH;
  canvas.height = NEWS_STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile.");

  const W = NEWS_STORY_WIDTH;
  const H = NEWS_STORY_HEIGHT;
  const gradient = ctx.createLinearGradient(0, 0, W, H);
  gradient.addColorStop(0, "#123008");
  gradient.addColorStop(0.6, "#0A0C07");
  gradient.addColorStop(1, "#1F4A15");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // Foto della news (o riquadro verde) nella parte alta.
  const photoY = 230;
  const photoH = 640;
  const [photo, logo] = await Promise.all([loadNewsCover(news), loadCanvasImage("/palapadel-club-transparent.png")]);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(60, photoY, W - 120, photoH, 36);
  ctx.clip();
  if (photo) {
    drawCover(ctx, photo, 60, photoY, W - 120, photoH, news.imagePositionY ?? 50);
  } else {
    ctx.fillStyle = "#1F4A15";
    ctx.fillRect(60, photoY, W - 120, photoH);
    ctx.strokeStyle = "rgba(251,243,222,0.25)";
    ctx.lineWidth = 6;
    ctx.strokeRect(160, photoY + 110, W - 320, photoH - 220);
    ctx.beginPath();
    ctx.moveTo(W / 2, photoY + 110);
    ctx.lineTo(W / 2, photoY + photoH - 110);
    ctx.stroke();
    ctx.fillStyle = "#BBFF5E";
    ctx.beginPath();
    ctx.arc(W - 250, photoY + 200, 46, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Logo in alto.
  if (logo) {
    const logoH = 110;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    ctx.drawImage(logo, (W - logoW) / 2, 70, logoW, logoH);
  } else {
    ctx.fillStyle = "#FBF3DE";
    ctx.font = "60px Anton, Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PALAPADEL", W / 2, 150);
    ctx.textAlign = "left";
  }

  // Categoria e data.
  let y = photoY + photoH + 110;
  ctx.font = "800 34px Inter, Arial, sans-serif";
  ctx.fillStyle = "#BBFF5E";
  const category = (news.category || "PalaPadel News").toUpperCase();
  ctx.fillText(category, 80, y);
  const categoryWidth = ctx.measureText(category).width;
  ctx.fillStyle = "rgba(251,243,222,0.6)";
  ctx.fillText(`  ·  ${formatDate(news.publishedAt ?? news.date)}`, 80 + categoryWidth, y);

  // Titolo: dimensione che si adatta alla lunghezza.
  y += 40;
  ctx.fillStyle = "#FBF3DE";
  let size = 104;
  let titleLines: string[] = [];
  for (; size >= 64; size -= 8) {
    ctx.font = `${size}px Anton, Impact, sans-serif`;
    titleLines = wrapText((t) => ctx.measureText(t).width, news.title.toUpperCase(), W - 160, 4);
    if (!titleLines[titleLines.length - 1]?.endsWith("…")) break;
  }
  for (const line of titleLines) {
    y += size * 1.08;
    ctx.fillText(line, 80, y);
  }

  // Inizio del testo.
  y += 70;
  ctx.font = "500 38px Inter, Arial, sans-serif";
  ctx.fillStyle = "rgba(251,243,222,0.78)";
  const maxBodyLines = Math.max(0, Math.min(5, Math.floor((H - 300 - y) / 54)));
  const bodyLines = maxBodyLines > 0 ? wrapText((t) => ctx.measureText(t).width, news.body, W - 160, maxBodyLines) : [];
  for (const line of bodyLines) {
    ctx.fillText(line, 80, y);
    y += 54;
  }

  // Invito a leggere.
  const pillY = H - 230;
  ctx.fillStyle = "#BBFF5E";
  ctx.beginPath();
  ctx.roundRect(80, pillY, W - 160, 110, 55);
  ctx.fill();
  ctx.fillStyle = "#081208";
  ctx.font = "900 40px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LEGGI SU PALAPADEL", W / 2, pillY + 70);
  ctx.font = "600 30px Inter, Arial, sans-serif";
  ctx.fillStyle = "rgba(251,243,222,0.7)";
  ctx.fillText(new URL(shareUrl).host, W / 2, H - 60);
  ctx.textAlign = "left";

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("Immagine non generata."))), "image/png")
  );
  const slug = news.title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  return { blob, dataUrl: canvas.toDataURL("image/png"), filename: `palapadel-storia-${slug || "news"}.png` };
}
