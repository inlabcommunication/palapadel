import { useCallback, useEffect, useState } from "react";
import { collection, onSnapshot, query, type QueryConstraint } from "firebase/firestore";
import { auth, db } from "../firebase";

const PUBLIC_OFFLINE_COLLECTIONS = new Set([
  "championshipTypes",
  "championshipEditions",
  "teams",
  "editionTeams",
  "femaleParticipants",
  "matchdays",
  "matches",
  "bracketRounds",
  "bracketMatches",
  "historicalWins",
  "homeNews",
  "publicSettings",
]);

function publicCacheKey(path: string, depsKey: React.DependencyList) {
  return `palapadel-public-cache-v1:${path}:${JSON.stringify(depsKey)}`;
}

/**
 * Legge una collezione Firestore in tempo reale.
 *
 * `depsKey` è FONDAMENTALE quando i `constraints` dipendono da valori che cambiano
 * (es. where("editionId", "==", editionId), dove editionId cambia quando l'utente
 * seleziona un'altra edizione): passare qui i valori dinamici (es. [editionId])
 * in modo che l'hook si ri-sottoscriva davvero quando cambiano, invece di restare
 * agganciato alla query precedente. Se i constraints sono sempre gli stessi
 * (es. where("status", "==", "attiva") fisso), depsKey può restare vuoto.
 */
export function useCollection<T>(
  path: string,
  constraints: QueryConstraint[] = [],
  depsKey: React.DependencyList = []
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const retry = useCallback(() => setRetryKey((value) => value + 1), []);

  useEffect(() => {
    const canUsePublicCache = !auth.currentUser && PUBLIC_OFFLINE_COLLECTIONS.has(path);
    const cacheKey = publicCacheKey(path, depsKey);
    let loadedFromCache = false;
    if (canUsePublicCache) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setData(JSON.parse(cached) as T[]);
          setHasLoaded(true);
          loadedFromCache = true;
        }
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }
    setLoading(!loadedFromCache);
    setError(null);
    const q = query(collection(db, path), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
        setData(next);
        if (canUsePublicCache) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(next));
          } catch {
            // La cache pubblica è opportunistica: un dispositivo pieno non blocca la lettura.
          }
        }
        setLoading(false);
        setHasLoaded(true);
      },
      (err) => {
        console.error(`Errore lettura ${path}:`, err);
        setError(loadedFromCache ? null : err instanceof Error ? err : new Error("Errore di lettura"));
        setLoading(false);
        setHasLoaded(true);
      }
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, retryKey, ...depsKey]);

  return { data, loading, error, hasLoaded, retry };
}
