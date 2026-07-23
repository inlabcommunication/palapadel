import { useState } from "react";

const LABELS: Record<string, string> = {
  novita: "Novità PalaPadel",
  "serie-b": "Serie B",
  "serie-c": "Serie C",
  principianti: "Principianti",
  femminile: "Femminile",
};

export function NotifichePage() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    novita: true,
    "serie-b": true,
    "serie-c": false,
    principianti: false,
    femminile: false,
  });

  const toggle = (k: string) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="p-4">
      <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE] mb-1">Notifiche</h2>
      <p className="text-[12.5px] text-[rgba(251,243,222,0.35)] mb-4">
        Le vere notifiche push (service worker + VAPID keys) arrivano in Fase 5. Qui vengono salvate solo le
        preferenze.
      </p>
      <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-xl overflow-hidden">
        {Object.entries(LABELS).map(([k, label]) => (
          <div
            key={k}
            className="flex items-center justify-between px-3.5 py-2.5 text-[13px] border-b border-[rgba(251,243,222,0.08)] last:border-b-0"
          >
            <span>{label}</span>
            <button
              onClick={() => toggle(k)}
              className="w-10 h-[22px] rounded-full relative shrink-0"
              style={{ background: prefs[k] ? "#BBFF5E" : "rgba(251,243,222,0.20)" }}
            >
              <span
                className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-[#0A0B08] transition-all"
                style={{ left: prefs[k] ? 20 : 2 }}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
