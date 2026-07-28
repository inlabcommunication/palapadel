import { useState } from "react";
import { Bell, BellRing, ExternalLink } from "lucide-react";
import { defaultUserNotificationPrefs, requestPushRegistration } from "../lib/notificationClient";

function permissionLabel() {
  if (!("Notification" in window)) return "Non supportate";
  if (Notification.permission === "granted") return "Attive";
  if (Notification.permission === "denied") return "Bloccate dal dispositivo";
  return "Da attivare";
}

export function NotifichePage() {
  const [permission, setPermission] = useState(permissionLabel());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const enablePush = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await requestPushRegistration(defaultUserNotificationPrefs());
      setPermission(permissionLabel());
      if (result.ok) setMessage("Notifiche attivate su questo dispositivo.");
      else if (result.reason === "denied") setMessage("Riattiva le notifiche dalle impostazioni del browser o del dispositivo.");
      else if (result.reason === "missing_config") setMessage("Configurazione notifiche incompleta.");
      else setMessage("Le notifiche non sono supportate su questo dispositivo.");
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Attivazione non riuscita.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 pb-6">
      <div className="mb-4 flex items-center gap-2">
        <Bell size={16} className="text-[#BBFF5E]" />
        <h1 className="font-display text-[30px] leading-none text-[#FBF3DE]">NOTIFICHE</h1>
      </div>

      <section className="rounded-lg border border-[rgba(251,243,222,0.12)] bg-[#0A0B08] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">Notifiche PalaPadel</p>
            <p className="mt-1 text-xs text-[rgba(251,243,222,0.58)]">Stato su questo dispositivo: {permission}</p>
          </div>
          <BellRing size={22} className="shrink-0 text-[#BBFF5E]" />
        </div>

        <button
          type="button"
          onClick={enablePush}
          disabled={loading}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#BBFF5E] px-4 py-3 text-sm font-extrabold text-[#081208] disabled:opacity-50"
        >
          {loading
            ? "Registrazione..."
            : permission === "Attive"
              ? "Registra di nuovo questo dispositivo"
              : "Attiva notifiche"}
        </button>

        {permission === "Bloccate dal dispositivo" && (
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[rgba(251,243,222,0.62)]">
            <ExternalLink size={14} className="mt-0.5 shrink-0" />
            Il blocco può essere rimosso soltanto dalle impostazioni del browser o del dispositivo.
          </p>
        )}
        {message && <p role="status" className="mt-3 text-center text-xs text-[#BBFF5E]">{message}</p>}
      </section>
    </div>
  );
}
