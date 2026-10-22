// Firestore minimo in memoria per testare la logica dei pronostici lato server.
type Data = Record<string, any>;

function setPath(target: Data, path: string, value: unknown) {
  const keys = path.split(".");
  let node = target;
  for (const key of keys.slice(0, -1)) node = node[key] ??= {};
  if (value === DELETE) delete node[keys[keys.length - 1]];
  else node[keys[keys.length - 1]] = value;
}

export const DELETE = Symbol("delete");

export function createFakeDb(initial: Record<string, Data> = {}) {
  const store = new Map<string, Data>(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const snap = (path: string) => {
    const data = store.get(path);
    return { id: path.split("/").pop()!, exists: data !== undefined, data: () => (data ? structuredClone(data) : undefined), ref: doc(path) };
  };
  const doc = (path: string): any => ({ path, id: path.split("/").pop(), get: async () => snap(path), set: async (d: Data, o?: any) => write.set(path, d, o), update: async (d: Data) => write.update(path, d), delete: async () => write.delete(path) });
  const write = {
    set(path: string, data: Data, options?: { merge?: boolean }) {
      store.set(path, options?.merge ? { ...(store.get(path) ?? {}), ...structuredClone(data) } : structuredClone(data));
    },
    update(path: string, data: Data) {
      if (!store.has(path)) throw new Error(`update on missing ${path}`);
      const current = store.get(path)!;
      for (const [key, value] of Object.entries(data)) setPath(current, key, value);
    },
    delete(path: string) {
      store.delete(path);
    },
  };
  const query = (name: string, filters: [string, unknown][] = []): any => ({
    where: (field: string, _op: string, value: unknown) => query(name, [...filters, [field, value]]),
    get: async () => {
      const docs = [...store.keys()]
        .filter((key) => key.startsWith(`${name}/`) && key.split("/").length === 2)
        .filter((key) => filters.every(([f, v]) => store.get(key)![f] === v))
        .map(snap);
      return { docs, empty: docs.length === 0, size: docs.length };
    },
    doc: (id = Math.random().toString(36).slice(2)) => doc(`${name}/${id}`),
  });
  const batch = () => {
    const ops: (() => void)[] = [];
    return {
      set: (ref: any, d: Data, o?: any) => ops.push(() => write.set(ref.path, d, o)),
      update: (ref: any, d: Data) => ops.push(() => write.update(ref.path, d)),
      delete: (ref: any) => ops.push(() => write.delete(ref.path)),
      commit: async () => ops.forEach((op) => op()),
    };
  };
  return {
    store,
    doc,
    collection: (name: string) => query(name),
    getAll: async (...refs: any[]) => refs.map((ref) => snap(ref.path)),
    batch,
    runTransaction: async (fn: (t: any) => Promise<unknown>) => {
      const b = batch();
      const t = {
        get: (target: any) => target.get(),
        getAll: async (...refs: any[]) => refs.map((ref) => snap(ref.path)),
        set: b.set,
        update: b.update,
        delete: b.delete,
      };
      const result = await fn(t);
      await b.commit();
      return result;
    },
  };
}
