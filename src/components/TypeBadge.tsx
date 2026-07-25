import { BADGE_COLORS } from "../types";
import type { ChampionshipType } from "../types";
import { getChampionshipLogoAlt, getChampionshipTypeInitials } from "../lib/championshipLogoPolicy";

/**
 * Dimensioni responsive per contesto, come da specifica:
 * - "card": card campionati attivi → 40px smartphone, 42px tablet (md), 44px desktop (xl)
 * - "header": intestazione sopra Classifica/Calendario → 36px smartphone, 42px desktop (xl)
 * Quando non si passa "variant" (es. chip piccoli nelle schede tipologia, righe di
 * gestione), si usa la dimensione fissa "size": in quei contesti compatti la scala
 * responsive non aggiunge valore ed è più semplice restare fissi.
 */
const VARIANT_SIZE_CLASSES: Record<"card" | "header", string> = {
  card: "w-10 h-10 md:w-[42px] md:h-[42px] xl:w-11 xl:h-11",
  header: "w-9 h-9 xl:w-[42px] xl:h-[42px]",
};

/**
 * Badge quadrato con angoli arrotondati per una tipologia di campionato: mostra il
 * logo caricato dal Super Admin (su una "moneta" bianca, per restare leggibile anche
 * con loghi a sfondo bianco su un'interfaccia scura), oppure un placeholder con le
 * iniziali fisse della categoria quando non è stato ancora caricato nessun logo.
 * Dimensioni sempre coerenti tra tutte le categorie (nessun logo più grande di un altro).
 */
export function TypeBadge({
  type,
  size = 40,
  variant,
  className = "",
}: {
  type?: Pick<ChampionshipType, "name" | "badgeColor" | "logoUrl" | "logoAlt">;
  size?: number;
  variant?: "card" | "header";
  className?: string;
}) {
  const safeType = type ?? { name: "Campionato", badgeColor: "serie-b" };
  const badge = BADGE_COLORS[safeType.badgeColor ?? "serie-b"] ?? BADGE_COLORS["serie-b"];
  // Con una variante responsive le classi Tailwind fissano la dimensione per breakpoint:
  // niente style inline in quel caso, altrimenti vincerebbe sempre lui sulle classi.
  const sizeClass = variant ? VARIANT_SIZE_CLASSES[variant] : "";
  const sizeStyle = variant ? undefined : { width: size, height: size };

  if (safeType.logoUrl) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-white p-[5px] ${sizeClass} ${className}`}
        style={sizeStyle}
      >
        <img
          src={safeType.logoUrl}
          alt={getChampionshipLogoAlt(safeType, safeType.logoAlt)}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[12px] text-[11px] font-extrabold ${sizeClass} ${className}`}
      style={{ ...sizeStyle, background: badge.bg, color: badge.text }}
      aria-hidden={type ? undefined : true}
    >
      {getChampionshipTypeInitials(safeType)}
    </span>
  );
}
