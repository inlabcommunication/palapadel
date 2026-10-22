import { useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { getInstallMode, promptInstall, subscribeInstallState } from "../lib/pwaInstall";

/**
 * Pulsante "Installa PalaPadel": su Android/desktop apre il prompt nativo
 * (beforeinstallprompt), su iPhone/iPad mostra la guida "Condividi > Aggiungi alla
 * schermata Home". Non compare se l'app è già installata o non è installabile.
 */
export function InstallAppButton() {
  const mode = useSyncExternalStore(subscribeInstallState, getInstallMode, () => null);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);

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

      {iosGuideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-center"
          onClick={() => setIosGuideOpen(false)}
        >
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
                <p className="mt-1 text-xs text-[rgba(251,243,222,0.58)]">Su iPhone e iPad bastano due passaggi in Safari.</p>
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
              <li className="flex items-center gap-3 rounded-lg border border-[rgba(251,243,222,0.12)] p-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#BBFF5E] text-xs font-extrabold text-[#081208]">1</span>
                <span className="text-sm">
                  Tocca <strong>Condividi</strong>{" "}
                  <Share size={16} className="inline-block align-text-bottom text-[#BBFF5E]" aria-label="icona Condividi" />{" "}
                  nella barra di Safari.
                </span>
              </li>
              <li className="flex items-center gap-3 rounded-lg border border-[rgba(251,243,222,0.12)] p-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#BBFF5E] text-xs font-extrabold text-[#081208]">2</span>
                <span className="text-sm">
                  Scorri e scegli <strong>Aggiungi alla schermata Home</strong>{" "}
                  <SquarePlus size={16} className="inline-block align-text-bottom text-[#BBFF5E]" aria-label="icona Aggiungi" />,
                  poi conferma con <strong>Aggiungi</strong>.
                </span>
              </li>
            </ol>

            <p className="mt-3 text-[11px] text-[rgba(251,243,222,0.50)]">
              Se non vedi l'opzione, apri questa pagina con Safari. PalaPadel comparirà tra le app con la sua icona.
            </p>

            <button
              type="button"
              onClick={() => setIosGuideOpen(false)}
              className="mt-4 w-full rounded-full bg-[#BBFF5E] py-2.5 text-sm font-bold text-[#081208]"
            >
              Ho capito
            </button>
          </section>
        </div>
      )}
    </>
  );
}
