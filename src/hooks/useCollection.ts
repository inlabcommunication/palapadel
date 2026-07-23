import { useEffect, useState } from "react";
import { collection, onSnapshot, query, type QueryConstraint } from "firebase/firestore";
import { db } from "../firebase";

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

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, path), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
        setLoading(false);
      },
      (err) => {
        console.error(`Errore lettura ${path}:`, err);
        setLoading(false);
      }
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...depsKey]);

  return { data, loading };
}

