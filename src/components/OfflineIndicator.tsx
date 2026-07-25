import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const [offline, setOffline] = useState(() => !navigator.onLine);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div role="status" className="fixed left-1/2 top-2 z-[100] -translate-x-1/2 rounded-lg bg-[#FBF3DE] px-3 py-2 text-xs font-bold text-[#081208] shadow-lg">
      Modalità offline: dati salvati in sola lettura
    </div>
  );
}
