import { useEffect, useRef } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { TopBar } from "./components/TopBar";
import { BottomNav } from "./components/BottomNav";
import { SuperAdminShell } from "./components/SuperAdminShell";
import { HomePage } from "./pages/Home";
import { CampionatiPage } from "./pages/Campionati";
import { NewsPage } from "./pages/News";
import { AlboPage } from "./pages/Albo";
import { NotifichePage } from "./pages/Notifiche";
import { LoginPage } from "./pages/Login";
import { GestionePage } from "./pages/Gestione";
import { GiornatePage } from "./pages/Giornate";
import { AnalyticsPage } from "./pages/Analytics";
import { useAuth } from "./contexts/AuthContext";
import { canTrackAnalytics, configureAnalyticsContext, trackAnalyticsEvent } from "./lib/analyticsClient";
import { bindForegroundNotificationTracking } from "./lib/notificationClient";
import { isSuperAdminWorkspacePath } from "./lib/superAdminRoutes";

export default function App() {
  const location = useLocation();
  const { appUser, loading: authLoading } = useAuth();
  const sessionTrackedRef = useRef(false);

  useEffect(() => {
    configureAnalyticsContext(appUser?.role ?? null, !authLoading);
  }, [appUser?.role, authLoading]);

  useEffect(() => {
    if (!canTrackAnalytics() || sessionTrackedRef.current) return;
    sessionTrackedRef.current = true;

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
  }, [appUser?.role, authLoading]);

  useEffect(() => {
    if (!canTrackAnalytics()) return;
    trackAnalyticsEvent("page_view", { path: location.pathname });
  }, [location.pathname, appUser?.role, authLoading]);

  const routes = (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/campionati" element={<CampionatiPage />} />
      <Route path="/campionati/:editionId" element={<CampionatiPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/storico" element={<Navigate to="/news" replace />} />
      <Route path="/albo" element={<AlboPage />} />
      <Route path="/notifiche" element={<NotifichePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/gestione" element={<GestionePage />} />
      <Route path="/gestione/edizione/:editionId" element={<GiornatePage />} />
      <Route path="/analytics" element={<AnalyticsPage />} />
    </Routes>
  );

  if (appUser?.role === "superadmin" && isSuperAdminWorkspacePath(location.pathname)) {
    return <SuperAdminShell>{routes}</SuperAdminShell>;
  }

  return (
    <div className="min-h-screen max-w-[480px] mx-auto flex flex-col bg-[#123008]">
      <TopBar />
      <main className="flex-1 pb-24">{routes}</main>
      <BottomNav />
    </div>
  );
}
