import { useCollection } from "../hooks/useCollection";
import type { PublicSettings } from "../lib/publicSettingsApi";
import { INLAB_INSTAGRAM_URL } from "../lib/inlabLogoUpload";

/**
 * Credito discreto in fondo a ogni pagina: logo InLab (se caricato) + testo
 * cliccabile verso Instagram. Un semplice <a> con target="_blank"/rel="noopener
 * noreferrer": non passa dal router, quindi non genera un evento di navigazione
 * interna e non viene mai conteggiato come page_view nelle Analytics (vedi
 * src/lib/analyticsClient.ts, che traccia solo i cambi di location del router).
 * Non è mai fissa/sovrapposta: vive nel normale flusso di scorrimento della pagina,
 * dopo il contenuto e prima dello spazio riservato alla BottomNav.
 */
export function InLabCredit() {
  const { data: settings } = useCollection<PublicSettings>("publicSettings");
  const global = settings.find((item) => item.id === "global");

  return (
    <div className="flex justify-center px-4 pb-2 pt-4">
      <a
        href={INLAB_INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[rgba(251,243,222,0.55)] transition hover:text-[rgba(251,243,222,0.85)]"
      >
        {global?.inlabLogoUrl ? (
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-white p-[3px]">
            <img src={global.inlabLogoUrl} alt={global.inlabLogoAlt || "Logo InLab"} className="h-full w-full object-contain" />
          </span>
        ) : (
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-[rgba(251,243,222,0.10)] text-[10px] font-extrabold">
            IL
          </span>
        )}
        <span className="text-[11px] font-semibold leading-none">Web app creata da InLab</span>
      </a>
    </div>
  );
}
