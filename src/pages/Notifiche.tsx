import { useCallback, useEffect, useState } from "react";
import { Bell, Check, Clock, Send, X } from "lucide-react";
import { where } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { useCollection } from "../hooks/useCollection";
import type { ChampionshipEdition, ChampionshipType } from "../types";
import {
  createNotificationDraft,
  defaultUserNotificationPrefs,
  getNotificationHistory,
  getNotificationDiagnostics,
  getNotificationSettings,
  NOTIFICATION_LABELS,
  NOTIFICATION_MODE_LABELS,
  NOTIFICATION_TYPES,
  previewNotification,
  requestPushRegistration,
  saveNotificationPreferences,
  saveNotificationSettings,
  scheduleNotification,
  sendNotification,
  type NotificationEventInput,
  type NotificationHistoryEntry,
  type NotificationDiagnostics,
  type NotificationMode,
  type NotificationSettings,
  type NotificationType,
} from "../lib/notificationClient";

const PREF_KEY = "palapadel.notificationPrefs";

const DEFAULT_SETTINGS: NotificationSettings = {
  globalEnabled: false,
  typeModes: {
    match_result: "draft",
    standings_update: "draft",
    correction: "ask",
    winner: "draft",
    news: "ask",
  },
  editionModes: {},
  quietHours: { enabled: false, start: "22:00", end: "08:00" },
};

function readPrefs(): Record<NotificationType, boolean> {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    return raw ? { ...defaultUserNotificationPrefs(), ...JSON.parse(raw) } : defaultUserNotificationPrefs();
  } catch {
    return defaultUserNotificationPrefs();
  }
}

function permissionLabel() {
  if (!("Notification" in window)) return "Non supportate";
  if (Notification.permission === "granted") return "Consentite";
  if (Notification.permission === "denied") return "Bloccate";
  return "Da autorizzare";
}

export function NotifichePage() {
  const { appUser } = useAuth();
  const [prefs, setPrefs] = useState<Record<NotificationType, boolean>>(readPrefs);
  const [enabled, setEnabled] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [permission, setPermission] = useState(permissionLabel());
  const isSuperAdmin = appUser?.role === "superAdmin";

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const persistPrefs = (nextPrefs: Record<NotificationType, boolean>, nextEnabled = enabled) => {
    setPrefs(nextPrefs);
    localStorage.setItem(PREF_KEY, JSON.stringify(nextPrefs));
    void saveNotificationPreferences(nextPrefs, nextEnabled);
  };

  const toggleTopic = (key: NotificationType) => {
    persistPrefs({ ...prefs, [key]: !prefs[key] });
  };

  const toggleGlobal = () => {
    const next = !enabled;
    setEnabled(next);
    void saveNotificationPreferences(prefs, next);
  };

  const enablePush = async () => {
    const result = await requestPushRegistration(prefs);
    setPermission(permissionLabel());
    if (result.ok) showToast("Notifiche push attivate.");
    else if (result.reason === "missing_config") showToast("Permesso salvato: configura VAPID per inviare push reali.");
    else showToast("Notifiche non attivate.");
  };

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={16} className="text-[#BBFF5E]" />
        <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE]">Notifiche</h2>
      </div>

      <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-xl overflow-hidden mb-4">
        <div className="flex items-center justify-between px-3.5 py-2.5 text-[13px] border-b border-[rgba(251,243,222,0.08)]">
          <span className="font-semibold">Dispositivo</span>
          <span className="text-[12px] text-[rgba(251,243,222,0.58)]">{permission}</span>
        </div>
        <div className="flex items-center justify-between px-3.5 py-2.5 text-[13px] border-b border-[rgba(251,243,222,0.08)]">
          <span>Interruttore globale</span>
          <button
            onClick={toggleGlobal}
            className="w-10 h-[22px] rounded-full relative shrink-0"
            style={{ background: enabled ? "#BBFF5E" : "rgba(251,243,222,0.20)" }}
          >
            <span
              className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-[#0A0B08] transition-all"
              style={{ left: enabled ? 20 : 2 }}
            />
          </button>
        </div>
        {NOTIFICATION_TYPES.map((key) => (
          <div key={key} className="flex items-center justify-between px-3.5 py-2.5 text-[13px] border-b border-[rgba(251,243,222,0.08)] last:border-b-0">
            <span>{NOTIFICATION_LABELS[key]}</span>
            <button
              onClick={() => toggleTopic(key)}
              className="w-10 h-[22px] rounded-full relative shrink-0"
              style={{ background: prefs[key] ? "#BBFF5E" : "rgba(251,243,222,0.20)" }}
            >
              <span
                className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-[#0A0B08] transition-all"
                style={{ left: prefs[key] ? 20 : 2 }}
              />
            </button>
          </div>
        ))}
      </div>

      <button onClick={enablePush} className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold mb-5">
        Attiva notifiche push
      </button>

      {isSuperAdmin && <SuperAdminNotificationsPanel showToast={showToast} />}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#0A0B08] text-[#FBF3DE] border border-[rgba(187,255,94,0.3)] px-4 py-2.5 rounded-full text-[12.5px] max-w-[90%] text-center z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function SuperAdminNotificationsPanel({ showToast }: { showToast: (msg: string) => void }) {
  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const { data: editions } = useCollection<ChampionshipEdition>(
    "championshipEditions",
    [where("status", "in", ["attiva", "conclusa"])],
    []
  );
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<NotificationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [event, setEvent] = useState<NotificationEventInput>({
    type: "news",
    title: "",
    body: "",
    url: "/notifiche",
    editionId: null,
  });
  const [scheduledAt, setScheduledAt] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<NotificationDiagnostics | null>(null);
  const [checkingDiagnostics, setCheckingDiagnostics] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsResult, historyResult] = await Promise.all([getNotificationSettings(), getNotificationHistory()]);
      setSettings(settingsResult.settings);
      setHistory(historyResult.history);
    } catch (err) {
      console.error(err);
      showToast("Errore caricamento notifiche.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const runDiagnostics = async () => {
    setCheckingDiagnostics(true);
    try {
      const response = await getNotificationDiagnostics();
      setDiagnostics(response.diagnostics);
    } catch (err) {
      console.error(err);
      setDiagnostics({
        status: "Errore Firebase",
        firebaseAdmin: "Errore Firebase",
        serverCredentials: "Configurazione incompleta",
        vapidKey: "Configurazione incompleta",
        serviceWorker: "Configurazione incompleta",
        endpoint: "Errore Firebase",
        settings: "Configurazione incompleta",
        registeredDevices: 0,
        enabledDevices: 0,
        validTokens: 0,
        recentFailures: 0,
        recentSuccesses: 0,
        message: "Impossibile completare la diagnostica.",
      });
    } finally {
      setCheckingDiagnostics(false);
    }
  };

  const updateMode = (type: NotificationType, mode: NotificationMode) => {
    setSettings((current) => ({ ...current, typeModes: { ...current.typeModes, [type]: mode } }));
  };

  const updateEditionMode = (editionId: string, type: NotificationType, mode: NotificationMode) => {
    setSettings((current) => ({
      ...current,
      editionModes: {
        ...current.editionModes,
        [editionId]: { ...(current.editionModes[editionId] ?? {}), [type]: mode },
      },
    }));
  };

  const saveSettings = async () => {
    try {
      const saved = await saveNotificationSettings(settings);
      setSettings(saved.settings);
      showToast("Impostazioni notifiche salvate.");
    } catch (err) {
      console.error(err);
      showToast("Errore nel salvataggio impostazioni.");
    }
  };

  const runPreview = async () => {
    try {
      const result = await previewNotification(event);
      setPreview(`${result.payload.title} - ${result.payload.body} (${NOTIFICATION_MODE_LABELS[result.mode]})`);
    } catch (err) {
      console.error(err);
      showToast("Anteprima non disponibile.");
    }
  };

  const createDraft = async () => {
    try {
      await createNotificationDraft(event);
      showToast("Bozza notifica creata.");
      await load();
    } catch (err) {
      console.error(err);
      showToast("Errore nella creazione bozza.");
    }
  };

  const schedule = async () => {
    if (!scheduledAt) return;
    try {
      await scheduleNotification(event, new Date(scheduledAt).toISOString());
      showToast("Notifica programmata.");
      await load();
    } catch (err) {
      console.error(err);
      showToast("Errore nella programmazione.");
    }
  };

  const sendNow = async () => {
    try {
      const result = await sendNotification(event);
      showToast(result.status === "failed" ? "Invio fallito." : "Invio registrato.");
      await load();
    } catch (err) {
      console.error(err);
      showToast("Errore durante l'invio.");
    }
  };

  const editionLabel = (edition: ChampionshipEdition) => {
    const type = types.find((t) => t.id === edition.typeId);
    return `${type?.name ?? "Campionato"} ${edition.season}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-[rgba(251,243,222,0.10)] bg-[#0A0B08] p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-[rgba(251,243,222,0.58)]">Diagnostica</p>
            {diagnostics && <p className="mt-1 text-sm font-bold text-[#BBFF5E]">{diagnostics.status}</p>}
          </div>
          <button onClick={runDiagnostics} disabled={checkingDiagnostics}
            className="rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2 text-xs font-bold disabled:opacity-50">
            {checkingDiagnostics ? "Verifica..." : "Verifica configurazione notifiche"}
          </button>
        </div>
        {diagnostics && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <DiagnosticLine label="Firebase Admin" value={diagnostics.firebaseAdmin} />
            <DiagnosticLine label="Credenziali server" value={diagnostics.serverCredentials} />
            <DiagnosticLine label="VAPID key" value={diagnostics.vapidKey} />
            <DiagnosticLine label="Service worker" value={diagnostics.serviceWorker} />
            <DiagnosticLine label="Dispositivi abilitati" value={String(diagnostics.enabledDevices)} />
            <DiagnosticLine label="Token validi" value={String(diagnostics.validTokens)} />
            {diagnostics.message && <p className="col-span-2 rounded-lg bg-[rgba(255,155,107,0.10)] p-2 text-[#FFB38B]">{diagnostics.message}</p>}
          </div>
        )}
      </section>
      <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-xl p-3.5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] uppercase tracking-wider font-bold text-[rgba(251,243,222,0.58)]">Centro notifiche</p>
          <button onClick={load} disabled={loading} className="text-xs font-semibold text-[#BBFF5E] disabled:opacity-50">
            Aggiorna
          </button>
        </div>

        <div className="flex items-center justify-between mb-3 text-[13px]">
          <span>Invio globale</span>
          <button
            onClick={() => setSettings((current) => ({ ...current, globalEnabled: !current.globalEnabled }))}
            className="w-10 h-[22px] rounded-full relative shrink-0"
            style={{ background: settings.globalEnabled ? "#BBFF5E" : "rgba(251,243,222,0.20)" }}
          >
            <span
              className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-[#0A0B08] transition-all"
              style={{ left: settings.globalEnabled ? 20 : 2 }}
            />
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-3">
          {NOTIFICATION_TYPES.map((type) => (
            <div key={type} className="grid grid-cols-[1fr_140px] gap-2 items-center text-[12.5px]">
              <span>{NOTIFICATION_LABELS[type]}</span>
              <select
                value={settings.typeModes[type]}
                onChange={(e) => updateMode(type, e.target.value as NotificationMode)}
                className="border border-[rgba(251,243,222,0.18)] rounded-lg px-2 py-2 text-[12px] bg-[#0A0B08]"
              >
                {Object.entries(NOTIFICATION_MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {editions.length > 0 && (
          <div className="border-t border-[rgba(251,243,222,0.08)] pt-3 mb-3">
            <p className="text-[11px] uppercase tracking-wider font-bold text-[rgba(251,243,222,0.50)] mb-2">Edizioni</p>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {editions.map((edition) => (
                <div key={edition.id} className="bg-[#123008] rounded-lg p-2.5">
                  <p className="text-[12.5px] font-bold mb-2">{editionLabel(edition)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {NOTIFICATION_TYPES.map((type) => (
                      <label key={type} className="text-[11px] text-[rgba(251,243,222,0.72)]">
                        {NOTIFICATION_LABELS[type]}
                        <select
                          value={settings.editionModes[edition.id]?.[type] ?? settings.typeModes[type]}
                          onChange={(e) => updateEditionMode(edition.id, type, e.target.value as NotificationMode)}
                          className="mt-1 w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-2 py-1.5 text-[11px] bg-[#0A0B08]"
                        >
                          {Object.entries(NOTIFICATION_MODE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={saveSettings} className="w-full bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold">
          Salva impostazioni
        </button>
      </div>

      <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-xl p-3.5">
        <p className="text-[12px] uppercase tracking-wider font-bold text-[rgba(251,243,222,0.58)] mb-3">Bozza e invio</p>
        <select
          value={event.type}
          onChange={(e) => setEvent((current) => ({ ...current, type: e.target.value as NotificationType }))}
          className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2"
        >
          {NOTIFICATION_TYPES.map((type) => (
            <option key={type} value={type}>{NOTIFICATION_LABELS[type]}</option>
          ))}
        </select>
        <select
          value={event.editionId ?? ""}
          onChange={(e) => setEvent((current) => ({ ...current, editionId: e.target.value || null }))}
          className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2 text-[13px] bg-[#0A0B08] mb-2"
        >
          <option value="">Nessuna edizione</option>
          {editions.map((edition) => (
            <option key={edition.id} value={edition.id}>{editionLabel(edition)}</option>
          ))}
        </select>
        <input
          value={event.title}
          onChange={(e) => setEvent((current) => ({ ...current, title: e.target.value }))}
          placeholder="Titolo"
          className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
        />
        <textarea
          value={event.body}
          onChange={(e) => setEvent((current) => ({ ...current, body: e.target.value }))}
          placeholder="Testo"
          className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2 min-h-[86px]"
        />
        <input
          value={event.url ?? ""}
          onChange={(e) => setEvent((current) => ({ ...current, url: e.target.value }))}
          placeholder="/notifiche"
          className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-2"
        />
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="w-full border border-[rgba(251,243,222,0.18)] rounded-lg px-3 py-2.5 text-sm mb-3"
        />

        {preview && (
          <div className="bg-[#123008] rounded-lg px-3 py-2 text-[12.5px] text-[rgba(251,243,222,0.85)] mb-3">
            {preview}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={runPreview} className="flex items-center justify-center gap-1.5 border border-[rgba(251,243,222,0.18)] rounded-lg py-2.5 text-sm font-semibold">
            <Check size={15} /> Anteprima
          </button>
          <button onClick={createDraft} className="flex items-center justify-center gap-1.5 border border-[rgba(251,243,222,0.18)] rounded-lg py-2.5 text-sm font-semibold">
            <X size={15} /> Bozza
          </button>
          <button onClick={schedule} disabled={!scheduledAt} className="flex items-center justify-center gap-1.5 border border-[rgba(251,243,222,0.18)] rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50">
            <Clock size={15} /> Programma
          </button>
          <button onClick={sendNow} className="flex items-center justify-center gap-1.5 bg-lime text-[#081208] rounded-lg py-2.5 text-sm font-bold">
            <Send size={15} /> Invia
          </button>
        </div>
      </div>

      <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-xl overflow-hidden">
        <p className="px-3.5 py-2.5 text-[12px] uppercase tracking-wider font-bold text-[rgba(251,243,222,0.58)] border-b border-[rgba(251,243,222,0.08)]">
          Storico
        </p>
        {history.length === 0 ? (
          <p className="px-3.5 py-3 text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessuna notifica ancora.</p>
        ) : (
          history.map((item) => (
            <div key={item.id} className="px-3.5 py-2.5 text-[12.5px] border-b border-[rgba(251,243,222,0.08)] last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold truncate">{item.payload?.title ?? NOTIFICATION_LABELS[item.eventType]}</span>
                <span className="text-[11px] text-[rgba(251,243,222,0.50)]">{item.status}</span>
              </div>
              <p className="text-[11px] text-[rgba(251,243,222,0.50)] mt-1">
                {item.sentAt ?? item.scheduledAt ?? item.createdAt ?? ""} · OK {item.successCount ?? 0} · KO {item.failureCount ?? 0}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DiagnosticLine({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-[rgba(251,243,222,0.05)] p-2"><span className="block text-[rgba(251,243,222,0.50)]">{label}</span><strong>{value}</strong></div>;
}
