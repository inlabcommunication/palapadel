// Stato dell'installazione PWA ("Aggiungi alla schermata Home").
//
// L'evento beforeinstallprompt può arrivare prima che React monti il pulsante: per
// questo viene intercettato a livello di modulo (importato da main.tsx) e conservato
// finché l'utente non tocca "Installa PalaPadel".

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type InstallMode = "prompt" | "ios" | null;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)").matches === true ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches === true
  );
}

/** iPhone, iPod e iPad (anche iPadOS, che si presenta come "Macintosh" con touch). */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

export type IosBrowser = "safari" | "chrome" | "edge" | "firefox" | "google" | "inapp";

/** Browser usato su iPhone/iPad: ognuno ha il comando "Aggiungi alla schermata Home" in un menu diverso. */
export function getIosBrowser(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent): IosBrowser {
  if (/CriOS/i.test(userAgent)) return "chrome";
  if (/EdgiOS/i.test(userAgent)) return "edge";
  if (/FxiOS/i.test(userAgent)) return "firefox";
  if (/\bGSA\//i.test(userAgent)) return "google";
  // Browser interni delle app (Instagram, Facebook, Messenger, TikTok, LinkedIn...).
  if (/Instagram|FBAN|FBAV|FB_IAB|Messenger|BytedanceWebview|musical_ly|LinkedInApp|Line\//i.test(userAgent)) return "inapp";
  return "safari";
}

/** Solo iPad: Safari ha il tasto Condividi in alto a destra invece che in basso. */
export function isIpad(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

export type ArrowSpot = "bottom-center" | "bottom-right" | "top-right";

/**
 * Dove si trova, ai bordi dello schermo, il tasto da toccare per primo. È una
 * posizione indicativa: le barre dei browser cambiano un po' tra versioni.
 */
export function getIosArrowSpot(browser: IosBrowser, ipad = isIpad()): ArrowSpot | null {
  if (browser === "safari") return ipad ? "top-right" : "bottom-center";
  if (browser === "chrome" || browser === "inapp") return "top-right";
  if (browser === "edge" || browser === "firefox") return "bottom-right";
  return null;
}

export function getInstallMode(): InstallMode {
  if (installed || isRunningStandalone()) return null;
  if (deferredPrompt) return "prompt";
  if (isIos()) return "ios";
  return null;
}

export function subscribeInstallState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Apre il prompt nativo (Chrome/Edge su Android e desktop). */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const promptEvent = deferredPrompt;
  if (!promptEvent) return "unavailable";
  // Il prompt si può mostrare una sola volta per evento.
  deferredPrompt = null;
  notify();
  await promptEvent.prompt();
  const { outcome } = await promptEvent.userChoice;
  if (outcome === "accepted") {
    installed = true;
    notify();
  }
  return outcome;
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    notify();
  });
  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", notify);
}
