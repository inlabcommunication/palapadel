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
import { GestionePage, OperationalChampionshipsPage } from "./pages/Gestione";
import { GiornatePage } from "./pages/Giornate";
import { AnalyticsPage } from "./pages/Analytics";
import { AdminSettingsPage } from "./pages/AdminSettings";
import { useAuth } from "./contexts/AuthContext";
import { canTrackAnalytics, configureAnalyticsContext, trackAnalyticsEvent } from "./lib/analyticsClient";
import { bindForegroundNotificationTracking } from "./lib/notificationClient";
import { isSuperAdminWorkspacePath } from "./lib/superAdminRoutes";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { InLabCredit } from "./components/InLabCredit";

export default function App() {
  const location = useLocation();
  const { appUser, authenticatedAppUser, viewMode, loading: authLoading } = useAuth();
  const sessionTrackedRef = useRef(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/firebase-messaging-sw.js").catch((err) => {
        console.error("Registrazione service worker non riuscita", err);
      });
    }
  }, []);

  useEffect(() => {
    configureAnalyticsContext(authenticatedAppUser?.role ?? null, !authLoading);
  }, [authenticatedAppUser?.role, authLoading, viewMode]);

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
  }, [authenticatedAppUser?.role, authLoading, viewMode]);

  useEffect(() => {
    if (!canTrackAnalytics()) return;
    trackAnalyticsEvent("page_view", { path: location.pathname });
  }, [location.pathname, authenticatedAppUser?.role, authLoading, viewMode]);

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
      <Route path="/giornate" element={<OperationalChampionshipsPage />} />
      <Route path="/gestione/edizione/:editionId" element={<GiornatePage />} />
      <Route path="/analytics" element={<AnalyticsPage />} />
      <Route path="/utenti-impostazioni" element={<AdminSettingsPage />} />
    </Routes>
  );

  if (appUser?.role === "superAdmin" && isSuperAdminWorkspacePath(location.pathname)) {
    return <AppErrorBoundary><OfflineIndicator /><SuperAdminShell>{routes}</SuperAdminShell></AppErrorBoundary>;
  }

  return (
    <AppErrorBoundary><div className="min-h-screen max-w-[480px] mx-auto flex flex-col bg-[#123008]">
      <OfflineIndicator />
      <TopBar />
      <main className="flex-1 pb-24">
        {routes}
        <InLabCredit />
      </main>
      <BottomNav />
    </div></AppErrorBoundary>
  );
}
