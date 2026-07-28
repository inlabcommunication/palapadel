import { useCallback, useEffect, useState } from "react";
import { BarChart3, RefreshCw, RotateCcw } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getAnalyticsSummary, resetAnalytics, type AnalyticsSummary } from "../lib/analyticsClient";

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-[rgba(251,243,222,0.50)] font-bold mb-1">{label}</p>
      <p className="font-display text-[24px] text-[#BBFF5E]">{value}</p>
    </div>
  );
}

export function AnalyticsPage() {
  const { appUser } = useAuth();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAnalyticsSummary(30);
      setSummary(data);
    } catch (err) {
      console.error(err);
      setError("Impossibile caricare gli analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = async () => {
    if (!window.confirm("Questa operazione azzera soltanto i dati Analytics. Continuare?")) return;
    setResetting(true);
    setError(null);
    try {
      await resetAnalytics();
      await load();
    } catch (err) {
      console.error(err);
      setError("Impossibile azzerare gli Analytics.");
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    if (appUser?.role === "superAdmin") void load();
  }, [appUser?.role, load]);

  if (!appUser) return <div className="p-4 text-sm text-[rgba(251,243,222,0.58)]">Devi accedere per vedere questa pagina.</div>;
  if (appUser.role !== "superAdmin") {
    return <div className="p-4 text-sm text-[rgba(251,243,222,0.58)]">Pagina riservata al Super Amministratore.</div>;
  }

  const totals = summary?.totals;

  return (
    <div className="p-4 pb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-[#BBFF5E]" />
          <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE]">Analytics</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset} disabled={resetting || loading} className="flex items-center gap-1 text-xs font-semibold text-[#FFB86B] disabled:opacity-50">
            <RotateCcw size={13} /> Azzera Analytics
          </button>
          <button onClick={load} disabled={loading} className="flex items-center gap-1 text-xs font-semibold text-[#BBFF5E] disabled:opacity-50">
            <RefreshCw size={13} /> Aggiorna
          </button>
        </div>
      </div>
      <p className="mb-4 text-[12px] text-[rgba(251,243,222,0.58)]">
        Questa operazione azzera soltanto i dati Analytics.
      </p>

      {error && <p className="text-[12.5px] text-[#FF6B6B] mb-3">{error}</p>}

      {totals ? (
        <>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Metric label="Dispositivi" value={totals.devices} />
            <Metric label="Sessioni" value={totals.sessions} />
            <Metric label="Installazioni" value={totals.installs} />
            <Metric label="Eventi" value={totals.eventsTotal} />
            <Metric label="Push consentite" value={totals.notificationPermissionGranted} />
            <Metric label="Push negate" value={totals.notificationPermissionDenied} />
          </div>

          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-wider font-bold text-[rgba(251,243,222,0.50)] mb-2">Ultimi 30 giorni</p>
            <div className="bg-[#0A0B08] border border-[rgba(251,243,222,0.10)] rounded-xl overflow-hidden">
              {summary.daily.length === 0 ? (
                <p className="px-3.5 py-3 text-[12.5px] text-[rgba(251,243,222,0.50)]">Nessun dato ancora.</p>
              ) : (
                summary.daily.map((day) => (
                  <div key={day.day} className="flex items-center justify-between px-3.5 py-2.5 text-[12.5px] border-b border-[rgba(251,243,222,0.08)] last:border-b-0">
                    <span className="font-semibold">{day.day}</span>
                    <span className="text-[rgba(251,243,222,0.58)]">{Number(day.eventsTotal ?? 0)} eventi</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-[rgba(251,243,222,0.50)] mb-2">Notifiche</p>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Invii riusciti" value={summary.notificationTotals.sent} />
              <Metric label="Invii falliti" value={summary.notificationTotals.failed} />
            </div>
          </div>
        </>
      ) : (
        <p className="text-[12.5px] text-[rgba(251,243,222,0.50)]">{loading ? "Caricamento..." : "Nessun dato ancora."}</p>
      )}
    </div>
  );
}
