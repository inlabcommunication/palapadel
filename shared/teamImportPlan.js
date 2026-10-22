// Import squadre da Excel: confronto con le squadre già esistenti e verifica delle
// scelte dell'amministratore. Usato sia dall'anteprima nell'app sia dal backend,
// che ricontrolla tutto prima di scrivere.

export const IMPORT_ACTIONS = ["create", "use", "replace", "copy", "skip"];

/** Stessa normalizzazione dei nomi usata dal backend squadre (maiuscole, accenti, simboli). */
export function normalizeTeamKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Confronto delle rose senza badare all'ordine, alle maiuscole o agli accenti. */
export function compareRosters(fileRoster, currentRoster) {
  const current = new Map((currentRoster ?? []).map((name) => [normalizeTeamKey(name), name]));
  const incoming = new Map((fileRoster ?? []).map((name) => [normalizeTeamKey(name), name]));
  const added = [...incoming].filter(([key]) => !current.has(key)).map(([, name]) => name);
  const removed = [...current].filter(([key]) => !incoming.has(key)).map(([, name]) => name);
  return { same: added.length === 0 && removed.length === 0, added, removed };
}

/**
 * Per ogni riga del file indica se la squadra è nuova o esiste già (e se con gli
 * stessi giocatori), se è già iscritta all'edizione e l'azione proposta.
 * existingTeams: [{ id, name, roster, deletedAt?, compatibleTypeIds? }]
 */
export function planTeamImport(rows, existingTeams, { enrolledTeamIds = [], typeId = null } = {}) {
  const byKey = new Map();
  for (const team of existingTeams) {
    if (team.deletedAt) continue;
    const key = normalizeTeamKey(team.name);
    if (key && !byKey.has(key)) byKey.set(key, team);
  }
  const enrolled = new Set(enrolledTeamIds);
  return rows.map((row) => {
    const existing = byKey.get(normalizeTeamKey(row.name)) ?? null;
    if (!existing) return { ...row, existing: null, comparison: null, enrolled: false, compatible: true, suggested: "create" };
    const comparison = compareRosters(row.roster, existing.roster);
    const compatible =
      !typeId || !Array.isArray(existing.compatibleTypeIds) || existing.compatibleTypeIds.includes(typeId);
    return {
      ...row,
      existing,
      comparison,
      enrolled: enrolled.has(existing.id),
      compatible,
      // Stessi giocatori: si usa quella esistente. Giocatori diversi: decide l'amministratore.
      suggested: comparison.same && compatible ? "use" : null,
    };
  });
}

export function suggestCopyName(name, takenNames) {
  const taken = new Set([...takenNames].map(normalizeTeamKey));
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${name} (${n})`;
    if (!taken.has(normalizeTeamKey(candidate))) return candidate;
  }
  return `${name} (copia)`;
}

/**
 * Verifica le scelte e restituisce l'elenco delle operazioni, oppure gli errori.
 * decisions: [{ name, roster, action, existingTeamId?, copyName? }]
 */
export function resolveTeamImport(decisions, existingTeams, options = {}) {
  const plan = planTeamImport(decisions, existingTeams, options);
  const errors = [];
  const operations = [];
  const usedKeys = new Set(existingTeams.filter((team) => !team.deletedAt).map((team) => normalizeTeamKey(team.name)));
  const seenFileKeys = new Set();

  plan.forEach((row, index) => {
    const decision = decisions[index];
    const label = `"${row.name}"`;
    const fileKey = normalizeTeamKey(row.name);
    if (!fileKey) {
      errors.push(`Riga ${index + 1}: nome squadra mancante.`);
      return;
    }
    if (seenFileKeys.has(fileKey)) {
      errors.push(`${label} compare due volte nel file.`);
      return;
    }
    seenFileKeys.add(fileKey);
    if (!IMPORT_ACTIONS.includes(decision.action)) {
      errors.push(`${label}: scegli cosa fare con questa squadra.`);
      return;
    }
    if (decision.action === "skip") return;

    if (!row.existing) {
      if (decision.action !== "create") {
        errors.push(`${label}: la squadra non esiste ancora, può solo essere creata.`);
        return;
      }
      operations.push({ type: "create", name: row.name.trim(), roster: row.roster, enroll: true });
      return;
    }

    if (decision.existingTeamId && decision.existingTeamId !== row.existing.id) {
      errors.push(`${label}: la squadra esistente è cambiata, ricarica l'anteprima.`);
      return;
    }
    if (decision.action === "create") {
      errors.push(`${label} esiste già: scegli se usarla, sostituire i giocatori o crearne una copia.`);
      return;
    }
    if (decision.action === "copy") {
      const copyName = String(decision.copyName ?? "").trim();
      const copyKey = normalizeTeamKey(copyName);
      if (!copyKey) {
        errors.push(`${label}: scrivi il nome della copia.`);
        return;
      }
      if (usedKeys.has(copyKey) || seenFileKeys.has(copyKey)) {
        errors.push(`${label}: il nome "${copyName}" è già usato da un'altra squadra.`);
        return;
      }
      usedKeys.add(copyKey);
      operations.push({ type: "create", name: copyName, roster: row.roster, enroll: true });
      return;
    }
    if (!row.compatible) {
      errors.push(`${label} non è compatibile con questa categoria: crea una copia.`);
      return;
    }
    operations.push({
      type: decision.action === "replace" ? "replace" : "use",
      teamId: row.existing.id,
      name: row.existing.name,
      roster: row.roster,
      previousRoster: row.existing.roster ?? [],
      enroll: !row.enrolled,
    });
  });

  // I nomi delle squadre nuove non devono coincidere con le copie richieste.
  const createdKeys = new Set();
  for (const op of operations.filter((item) => item.type === "create")) {
    const key = normalizeTeamKey(op.name);
    if (createdKeys.has(key)) errors.push(`Il nome "${op.name}" è usato da due squadre nuove.`);
    createdKeys.add(key);
  }

  return { errors, operations };
}
