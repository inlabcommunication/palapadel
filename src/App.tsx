import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { TopBar } from "./components/TopBar";
import { BottomNav } from "./components/BottomNav";
import { HomePage } from "./pages/Home";
import { CampionatiPage } from "./pages/Campionati";
import { StoricoPage } from "./pages/Storico";
import { AlboPage } from "./pages/Albo";
import { NotifichePage } from "./pages/Notifiche";
import { LoginPage } from "./pages/Login";
import { GestionePage } from "./pages/Gestione";
import { GiornatePage } from "./pages/Giornate";
import { AnalyticsPage } from "./pages/Analytics";
import { trackAnalyticsEvent } from "./lib/analyticsClient";
import { bindForegroundNotificationTracking } from "./lib/notificationClient";

export default function App() {
  const location = useLocation();

  useEffect(() => {
    trackAnalyticsEvent("session_start");
    const onInstalled = () => trackAnalyticsEvent("pwa_installed");
    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "notification_opened") {
        trackAnalyticsEvent("notification_opened", { url: event.data.url });
      }
    };
    window.addEventListener("appinstalled", onInstalled);
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);

    let unbind: (() => void) | undefined;
    void bindForegroundNotificationTracking().then((fn) => {
      unbind = fn;
    });

    return () => {
      window.removeEventListener("appinstalled", onInstalled);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
      unbind?.();
    };
  }, []);

  useEffect(() => {
    trackAnalyticsEvent("page_view", { path: location.pathname });
  }, [location.pathname]);

  return (
    <div className="min-h-screen max-w-[480px] mx-auto flex flex-col bg-[#123008]">
      <TopBar />
      <main className="flex-1 pb-24">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/campionati" element={<CampionatiPage />} />
          <Route path="/campionati/:editionId" element={<CampionatiPage />} />
          <Route path="/storico" element={<StoricoPage />} />
          <Route path="/albo" element={<AlboPage />} />
          <Route path="/notifiche" element={<NotifichePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/gestione" element={<GestionePage />} />
          <Route path="/gestione/edizione/:editionId" element={<GiornatePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
