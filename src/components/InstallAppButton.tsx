import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Download, Share, SquarePlus, X } from "lucide-react";
import {
  getInstallMode,
  getIosArrowSpot,
  getIosBrowser,
  promptInstall,
  subscribeInstallState,
  type ArrowSpot,
  type IosBrowser,
} from "../lib/pwaInstall";

/**
 * Pulsante "Installa PalaPadel": su Android/desktop apre il prompt nativo
 * (beforeinstallprompt), su iPhone/iPad mostra la guida "Condividi > Aggiungi alla
 * schermata Home". Non compare se l'app è già installata o non è installabile.
 */
export function InstallAppButton({ variant = "card" }: { variant?: "card" | "topbar" }) {
  const mode = useSyncExternalStore(subscribeInstallState, getInstallMode, () => null);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);
  const iosBrowser = getIosBrowser();
  const arrowSpot = getIosArrowSpot(iosBrowser);

  if (!mode) return null;

  const handleClick = () => {
    if (mode === "ios") {
      setIosGuideOpen(true);
      return;
    }
    void promptInstall().catch((err) => console.error("Installazione PWA non riuscita", err));
  };

  return (
    <>
      {variant === "topbar" ? (
        <button
          type="button"
          onClick={handleClick}
          aria-label="Installa l'app PalaPadel"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#BBFF5E] px-3 py-1.5 text-xs font-bold text-[#081208] shadow-[0_0_0_3px_rgba(187,255,94,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BBFF5E]"
        >
          <Download size={14} />
          Installa<span className="hidden min-[380px]:inline">app</span>
        </button>
      ) : (
      <div className="mx-auto mb-5 flex max-w-md items-center gap-3 rounded-xl border border-[rgba(187,255,94,0.22)] bg-[#0A0B08] p-3">
        <img
          src="/icon-192.png"
          alt=""
          aria-hidden="true"
          className="h-11 w-11 shrink-0 rounded-xl border border-[rgba(251,243,222,0.14)]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#FBF3DE]">PalaPadel sul tuo telefono</p>
          <p className="text-[11px] text-[rgba(251,243,222,0.58)]">Aprilo dalla schermata Home, come un'app.</p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#BBFF5E] px-3 py-2 text-xs font-bold text-[#081208] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BBFF5E]"
        >
          <Download size={14} />
          Installa PalaPadel
        </button>
      </div>
      )}

      {/* Portale su <body>: la guida deve stare sopra barra in alto e menu in basso. */}
      {iosGuideOpen && createPortal(
        <div
          className={`fixed inset-0 z-50 flex justify-center bg-black/75 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-center ${
            arrowSpot?.startsWith("bottom") ? "items-start pt-[max(1rem,env(safe-area-inset-top))] pb-28" : arrowSpot ? "items-end pt-28" : "items-end"
          }`}
          onClick={() => setIosGuideOpen(false)}
        >
          {arrowSpot && <GuideArrow spot={arrowSpot} label={IOS_GUIDES[iosBrowser].arrowLabel} />}
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="w-full max-w-md rounded-lg border border-[rgba(251,243,222,0.14)] bg-[#0A0B08] p-4 text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="ios-install-title" className="text-lg font-extrabold">Installa PalaPadel</h2>
                <p className="mt-1 text-xs text-[rgba(251,243,222,0.58)]">{IOS_GUIDES[iosBrowser].intro}</p>
              </div>
              <button
                type="button"
                onClick={() => setIosGuideOpen(false)}
                aria-label="Chiudi"
                className="rounded-full p-2 hover:bg-[rgba(251,243,222,0.08)]"
              >
                <X size={18} />
              </button>
            </div>

            <ol className="mt-4 flex flex-col gap-2">
              {IOS_GUIDES[iosBrowser].steps.map((step, index) => (
                <li key={index} className="flex items-center gap-3 rounded-lg border border-[rgba(251,243,222,0.12)] p-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#BBFF5E] text-xs font-extrabold text-[#081208]">{index + 1}</span>
                  <span className="text-sm">{step}</span>
                </li>
              ))}
            </ol>

            <p className="mt-3 text-[11px] text-[rgba(251,243,222,0.50)]">{IOS_GUIDES[iosBrowser].note}</p>

            <button
              type="button"
              onClick={() => setIosGuideOpen(false)}
              className="mt-4 w-full rounded-full bg-[#BBFF5E] py-2.5 text-sm font-bold text-[#081208]"
            >
              Ho capito
            </button>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}

const ShareIcon = () => <Share size={16} className="inline-block align-text-bottom text-[#BBFF5E]" aria-label="icona Condividi" />;
const AddIcon = () => <SquarePlus size={16} className="inline-block align-text-bottom text-[#BBFF5E]" aria-label="icona Aggiungi" />;
const addToHome = (
  <>
    Tocca <strong>Visualizza altro</strong> (o scorri l'elenco) e scegli <strong>Aggiungi alla schermata Home</strong> <AddIcon />,
    poi conferma con <strong>Aggiungi</strong>.
  </>
);

// Ogni browser su iPhone ha il comando in un menu diverso (Chrome, Edge e Firefox da iOS 16.4).
const IOS_GUIDES: Record<IosBrowser, { arrowLabel: string; intro: string; steps: ReactNode[]; note: string }> = {
  safari: {
    arrowLabel: "Condividi è qui sotto",
    intro: "Su iPhone e iPad bastano pochi tocchi in Safari.",
    steps: [
      <>Tocca <strong>Condividi</strong> <ShareIcon /> nella barra di Safari (se non lo vedi, tocca prima <strong>•••</strong>).</>,
      addToHome,
    ],
    note: "PalaPadel comparirà tra le app con la sua icona.",
  },
  chrome: {
    arrowLabel: "Condividi è qui in alto",
    intro: "Stai usando Chrome: si installa da qui, senza passare da Safari.",
    steps: [
      <>Tocca <strong>Condividi</strong> <ShareIcon /> in alto a destra, nella barra dell'indirizzo (oppure nel menu <strong>•••</strong> in basso).</>,
      addToHome,
    ],
    note: "Se non trovi l'opzione, aggiorna iPhone e Chrome all'ultima versione, oppure apri questa pagina con Safari.",
  },
  edge: {
    arrowLabel: "Menu ••• qui sotto",
    intro: "Stai usando Edge: si installa da qui, senza passare da Safari.",
    steps: [
      <>Tocca il menu <strong>•••</strong> in basso e poi <strong>Condividi</strong> <ShareIcon />.</>,
      addToHome,
    ],
    note: "Se non trovi l'opzione, aggiorna iPhone ed Edge all'ultima versione, oppure apri questa pagina con Safari.",
  },
  firefox: {
    arrowLabel: "Menu ☰ qui sotto",
    intro: "Stai usando Firefox: si installa da qui, senza passare da Safari.",
    steps: [
      <>Tocca il menu <strong>☰</strong> in basso e poi <strong>Condividi</strong> <ShareIcon />.</>,
      addToHome,
    ],
    note: "Se non trovi l'opzione, aggiorna iPhone e Firefox all'ultima versione, oppure apri questa pagina con Safari.",
  },
  google: {
    arrowLabel: "",
    intro: "L'app Google non permette di installare i siti: apri prima PalaPadel in Safari o Chrome.",
    steps: [
      <>Tocca <strong>Condividi</strong> <ShareIcon /> o il menu <strong>•••</strong> e scegli <strong>Apri in Safari</strong> (o in Chrome).</>,
      <>Poi tocca di nuovo <strong>Installa app</strong> in alto: ti mostreremo i passaggi per quel browser.</>,
    ],
    note: "In alternativa copia l'indirizzo della pagina e incollalo in Safari o Chrome.",
  },
  inapp: {
    arrowLabel: "Menu ••• qui in alto",
    intro: "Hai aperto il link dentro un'app (Instagram, Facebook...): da qui non si può installare.",
    steps: [
      <>Tocca il menu <strong>•••</strong> in alto a destra e scegli <strong>Apri nel browser</strong> (o <strong>Apri in Safari</strong>).</>,
      <>Poi tocca di nuovo <strong>Installa app</strong> in alto: ti mostreremo i passaggi per quel browser.</>,
    ],
    note: "In alternativa copia l'indirizzo della pagina e incollalo in Safari o Chrome.",
  },
};

/** Freccia animata verso il tasto del browser da toccare (fuori dalla pagina, sul bordo). */
function GuideArrow({ spot, label }: { spot: ArrowSpot; label: string }) {
  const atBottom = spot.startsWith("bottom");
  const position =
    spot === "bottom-center"
      ? "bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 items-center"
      : spot === "bottom-right"
        ? "bottom-[calc(0.75rem+env(safe-area-inset-bottom))] right-3 items-end"
        : "top-[calc(0.5rem+env(safe-area-inset-top))] right-3 items-end";
  const Icon = atBottom ? ArrowDown : ArrowUp;
  return (
    <div aria-hidden="true" className={`pointer-events-none fixed z-[60] flex flex-col gap-1 ${position}`}>
      {!atBottom && <Icon size={44} strokeWidth={3} className="animate-bounce text-[#BBFF5E] drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />}
      <span className="rounded-full bg-[#BBFF5E] px-3 py-1 text-xs font-extrabold text-[#081208] shadow-lg">{label}</span>
      {atBottom && <Icon size={44} strokeWidth={3} className="animate-bounce text-[#BBFF5E] drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />}
    </div>
  );
}
