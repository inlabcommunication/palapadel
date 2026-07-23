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
      <h2 className="text-sm font-bold mb-1">Notifiche</h2>
      <p className="text-[12.5px] text-[#9A9A94] mb-4">
        Le vere notifiche push (service worker + VAPID keys) arrivano in Fase 5. Qui vengono salvate solo le
        preferenze.
      </p>
      <div className="bg-white border border-[#EAE7DD] rounded-xl overflow-hidden">
        {Object.entries(LABELS).map(([k, label]) => (
          <div
            key={k}
            className="flex items-center justify-between px-3.5 py-2.5 text-[13px] border-b border-[#F1EFE8] last:border-b-0"
          >
            <span>{label}</span>
            <button
              onClick={() => toggle(k)}
              className="w-10 h-[22px] rounded-full relative shrink-0"
              style={{ background: prefs[k] ? "#0F3B36" : "#D3D1C7" }}
            >
              <span
                className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white transition-all"
                style={{ left: prefs[k] ? 20 : 2 }}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
