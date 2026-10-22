// Un file appena caricato non è ancora collegato al suo documento Firestore finché
// l'amministratore non salva (news, squadra, logo): per non scambiarlo per un file
// orfano, la pulizia considera solo i file più vecchi di questo margine.
export const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;

// Oltre questo numero di file "orfani" in un solo controllo automatico è più probabile
// un errore (per esempio riferimenti salvati in un campo nuovo) che una vera pulizia:
// il cron non mette nulla in coda e lascia la verifica a un amministratore.
export const MAX_AUTO_ORPHANS = 50;

// Collezioni i cui documenti possono contenere immagini di Storage. Tutti i campi di
// testo (anche annidati) vengono controllati, non solo i campi *StoragePath: alcuni
// documenti hanno solo l'URL (dati vecchi, migrazioni).
export const STORAGE_REFERENCE_COLLECTIONS = [
  "homeNews",
  "teams",
  "championshipTypes",
  "championshipEditions",
  "tournaments",
  "historicalWins",
  "publicSettings",
];

/** Ricava il percorso Storage da un percorso, da un URL Firebase/GCS o da gs://. */
export function storagePathFromValue(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  if (text.startsWith("gs://")) return text.replace(/^gs:\/\/[^/]+\//, "") || null;
  if (!/^https?:\/\//.test(text)) return text;
  try {
    const url = new URL(text);
    const marker = "/o/";
    const index = url.pathname.indexOf(marker);
    if (index >= 0) return decodeURIComponent(url.pathname.slice(index + marker.length));
    if (url.hostname === "storage.googleapis.com") {
      // https://storage.googleapis.com/<bucket>/<percorso>
      return decodeURIComponent(url.pathname.split("/").slice(2).join("/")) || null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Tutti i percorsi Storage citati nei documenti, a qualunque profondità. */
export function collectStorageReferences(documents) {
  const referenced = new Set();
  const visit = (value, depth) => {
    if (depth > 6 || value === null || value === undefined) return;
    if (typeof value === "string") {
      const path = storagePathFromValue(value);
      if (path) referenced.add(path);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (typeof value === "object") {
      for (const item of Object.values(value)) visit(item, depth + 1);
    }
  };
  for (const data of documents) visit(data, 0);
  return referenced;
}

export async function loadStorageReferences(db) {
  const snapshots = await Promise.all(STORAGE_REFERENCE_COLLECTIONS.map((name) => db.collection(name).get()));
  return collectStorageReferences(snapshots.flatMap((snap) => snap.docs.map((doc) => doc.data())));
}

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
