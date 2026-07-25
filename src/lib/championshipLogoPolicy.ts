import type { ChampionshipType } from "../types";

/**
 * Iniziali di fallback quando una tipologia non ha ancora un logo caricato. Sono FISSE
 * per badgeColor, non derivate da name.slice(0, 2): "Serie B" e "Serie C" darebbero
 * entrambe "SE" con lo slice automatico, identiche e sbagliate. Per una tipologia
 * personalizzata non presente qui, si ricade comunque su name.slice(0, 2).
 */
const FIXED_TYPE_INITIALS: Record<string, string> = {
  "serie-b": "SB",
  "serie-c": "SC",
  principianti: "PR",
  femminile: "FE",
};

export function getChampionshipTypeInitials(type: Pick<ChampionshipType, "name" | "badgeColor">) {
  const fixed = FIXED_TYPE_INITIALS[type.badgeColor];
  if (fixed) return fixed;
  const fallback = type.name.trim().slice(0, 2).toUpperCase();
  return fallback || "CH";
}

export function getChampionshipLogoAlt(type: Pick<ChampionshipType, "name">, logoAlt?: string | null) {
  const explicitAlt = logoAlt?.trim();
  if (explicitAlt) return explicitAlt;
  const safeName = type.name.trim() || "campionato";
  return `Logo ${safeName}`;
}

export function buildChampionshipLogoFolder(championshipTypeId: string) {
  return `branding/championships/${championshipTypeId}/logo`;
}
