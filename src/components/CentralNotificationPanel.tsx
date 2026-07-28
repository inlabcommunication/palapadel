import { useState } from "react";
import { BellRing, CalendarDays, ListOrdered, Newspaper, Send, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { canSendNotifications } from "../lib/permissions";
import {
  getContextNotificationStatus,
  sendContextNotifications,
  type ContextNotificationKind,
} from "../lib/notificationClient";

const OPTIONS: Array<{
  kind: ContextNotificationKind;
  label: string;
  message: string;
  icon: typeof ListOrdered;
}> = [
  { kind: "standings", label: "Classifica", message: "Aggiornamento classifica", icon: ListOrdered },
  { kind: "calendar", label: "Calendario", message: "Aggiornamento calendario", icon: CalendarDays },
  { kind: "news", label: "News", message: "Controlla le news del PalaPadel", icon: Newspaper },
];

const EMPTY_SELECTION: Record<ContextNotificationKind, boolean> = {
  standings: false,
  calendar: false,
  news: false,
};

export function CentralNotificationPanel() {
  const { appUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const [changesCount, setChangesCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  if (!canSendNotifications(appUser?.role)) return null;

  const openPanel = async () => {
    setOpen(true);
    setLoading(true);
    setMessage(null);
    try {
      const result = await getContextNotificationStatus();
      setSelection(result.detected);
      setChangesCount(result.changesCount);
    } catch (error) {
      console.error(error);
      setSelection(EMPTY_SELECTION);
      setMessage(error instanceof Error ? error.message : "Rilevamento non disponibile.");
    } finally {
      setLoading(false);
    }
  };

  const selectedKinds = OPTIONS.filter((option) => selection[option.kind]).map((option) => option.kind);

  const send = async () => {
    if (selectedKinds.length === 0) return;
    setSending(true);
    setMessage(null);
    try {
      const result = await sendContextNotifications(selectedKinds);
      const delivered = result.results.reduce((total, item) => total + item.successCount, 0);
      const skipped = result.results.every((item) => item.status === "skipped");
      setMessage(skipped ? "Nessun dispositivo abilitato." : `Notifiche inviate a ${delivered} dispositivi.`);
      setSelection(EMPTY_SELECTION);
      setChangesCount(0);
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Invio non riuscito.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label="Manda notifica"
        className="rounded-full bg-[#0A0B08] p-2 text-[#BBFF5E]"
      >
        <BellRing size={15} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="central-notification-title"
            className="w-full max-w-lg rounded-lg border border-[rgba(251,243,222,0.14)] bg-[#0A0B08] p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="central-notification-title" className="text-lg font-extrabold">Manda notifica</h2>
                <p className="mt-1 text-xs text-[rgba(251,243,222,0.58)]">
                  {loading ? "Controllo delle modifiche..." : `${changesCount} operazioni rilevate dall'ultimo invio.`}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Chiudi" className="rounded-full p-2 hover:bg-[rgba(251,243,222,0.08)]">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = selection[option.kind];
                return (
                  <label key={option.kind} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${selected ? "border-[#BBFF5E] bg-[rgba(187,255,94,0.08)]" : "border-[rgba(251,243,222,0.12)]"}`}>
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={loading || sending}
                      onChange={() => setSelection((current) => ({ ...current, [option.kind]: !current[option.kind] }))}
                      className="h-4 w-4 accent-[#BBFF5E]"
                    />
                    <Icon size={18} className={selected ? "text-[#BBFF5E]" : "text-[rgba(251,243,222,0.48)]"} />
                    <span>
                      <strong className="block text-sm">{option.label}</strong>
                      <span className="text-xs text-[rgba(251,243,222,0.58)]">{option.message}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            {message && <p role="status" className="mt-3 text-center text-xs text-[#BBFF5E]">{message}</p>}
            <button
              type="button"
              onClick={send}
              disabled={loading || sending || selectedKinds.length === 0}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#BBFF5E] px-4 py-3 text-sm font-extrabold text-[#081208] disabled:opacity-45"
            >
              <Send size={17} /> {sending ? "Invio..." : "Invia notifiche selezionate"}
            </button>
          </section>
        </div>
      )}
    </>
  );
}
