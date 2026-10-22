// Un file appena caricato non è ancora collegato al suo documento Firestore finché
// l'amministratore non salva (news, squadra, logo): per non scambiarlo per un file
// orfano, la pulizia considera solo i file più vecchi di questo margine.
export const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export function findOrphanStoragePaths(files, referenced, prefixes, now = Date.now(), minAgeMs = ORPHAN_MIN_AGE_MS) {
  return files
    .filter((file) => {
      const path = file.name;
      if (!prefixes.some((prefix) => path.startsWith(prefix)) || referenced.has(path)) return false;
      const created = Date.parse(file.metadata?.timeCreated ?? "");
      // Data sconosciuta: meglio non toccare il file.
      return Number.isFinite(created) && now - created >= minAgeMs;
    })
    .map((file) => file.name);
}
