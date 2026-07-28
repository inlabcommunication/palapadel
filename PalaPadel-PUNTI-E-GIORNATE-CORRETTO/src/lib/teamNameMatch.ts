/**
 * Fase 13 — normalizza un nome squadra/giocatrice per il confronto "somigliante":
 * minuscolo, spazi multipli collassati, trattini/apostrofi/punteggiatura semplice
 * rimossi, accenti rimossi. Usata SOLO per rilevare possibili corrispondenze da
 * mostrare all'amministratore — non unisce mai automaticamente due squadre solo
 * perché la versione normalizzata coincide.
 */
export function normalizeTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // rimuove i segni diacritici (accenti)
    .toLowerCase()
    .replace(/['’`-]/g, " ") // apostrofi e trattini diventano spazi
    .replace(/[.,;:!?()]/g, "") // punteggiatura semplice
    .replace(/\s+/g, " ")
    .trim();
}

export interface NameMatchCandidate {
  id: string;
  name: string;
}

/**
 * Confronta un nome importato con un elenco di squadre note. Ritorna:
 * - { kind: "exact", candidate } se il nome coincide esattamente (case/spazi inclusi)
 * - { kind: "similar", candidate } se coincide solo dopo normalizzazione (da confermare
 *   esplicitamente dall'amministratore: mai unire automaticamente)
 * - { kind: "none" } se non c'è alcuna corrispondenza
 */
export function matchTeamName(
  importedName: string,
  candidates: NameMatchCandidate[]
): { kind: "exact"; candidate: NameMatchCandidate } | { kind: "similar"; candidate: NameMatchCandidate } | { kind: "none" } {
  const exact = candidates.find((c) => c.name === importedName);
  if (exact) return { kind: "exact", candidate: exact };

  const normalizedImported = normalizeTeamName(importedName);
  const similar = candidates.find((c) => normalizeTeamName(c.name) === normalizedImported);
  if (similar) return { kind: "similar", candidate: similar };

  return { kind: "none" };
}

/** Fase 13 — righe duplicate nello stesso file (stesso nome dopo normalizzazione). */
export function findDuplicateImportedNames(names: string[]): string[] {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const name of names) {
    const key = normalizeTeamName(name);
    if (!key) continue;
    if (seen.has(key)) {
      if (!duplicates.includes(name)) duplicates.push(name);
    } else {
      seen.set(key, name);
    }
  }
  return duplicates;
}
