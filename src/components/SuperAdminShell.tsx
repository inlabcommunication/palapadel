import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Award,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Home,
  LayoutDashboard,
  LogOut,
  Newspaper,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_LABELS } from "../types";
import { AppFooter } from "./AppFooter";

const sidebarItems = [
  { to: "/gestione", label: "Dashboard", icon: LayoutDashboard, match: (path: string, hash: string) => path === "/gestione" && !hash },
  { to: "/campionati", label: "Campionati e squadre", icon: Trophy, match: (path: string) => path.startsWith("/campionati") },
  { to: "/giornate", label: "Giornate e partite", icon: CalendarDays, match: (path: string) => path === "/giornate" || path.startsWith("/gestione/edizione") },
  { to: "/albo", label: "Albo d'oro", icon: Award, match: (path: string) => path === "/albo" },
  { to: "/#news", label: "PalaPadel News", icon: Newspaper, match: (path: string, hash: string) => path === "/" && (!hash || hash === "#news") },
  { to: "/analytics", label: "Analytics", icon: BarChart3, match: (path: string) => path === "/analytics" },
  { to: "/utenti-impostazioni", label: "Utenti e impostazioni", icon: ShieldCheck, match: (path: string) => path === "/utenti-impostazioni" || path === "/notifiche" },
];

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const { appUser, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("superAdminSidebarCollapsed") === "true");

  useEffect(() => {
    localStorage.setItem("superAdminSidebarCollapsed", String(collapsed));
  }, [collapsed]);

  const currentItem = useMemo(
    () => sidebarItems.find((item) => item.match(location.pathname, location.hash)) ?? sidebarItems.find((item) => item.to === "/gestione"),
    [location.hash, location.pathname]
  );

  return (
    <div className="min-h-screen bg-[#123008] text-[#FBF3DE] xl:grid xl:grid-cols-[auto_minmax(0,1fr)]">
      <aside
        className={`sticky top-0 hidden h-screen flex-col border-r border-[rgba(251,243,222,0.10)] bg-[#081208] xl:flex ${
          collapsed ? "w-[88px]" : "w-[276px]"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-[rgba(251,243,222,0.10)] px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FBF3DE]">
            <img src="/logo.png" alt="PalaPadel Club" className="h-7 w-auto object-contain" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#BBFF5E]">Super Admin</p>
              <p className="truncate text-[13px] font-semibold text-[rgba(251,243,222,0.72)]">Area gestione</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const active = item.match(location.pathname, location.hash);
            return (
              <Link
                key={`${item.to}-${item.label}`}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
                  active
                    ? "bg-[#BBFF5E] text-[#081208]"
                    : "text-[rgba(251,243,222,0.64)] hover:bg-[rgba(251,243,222,0.07)] hover:text-[#FBF3DE]"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="m-3 flex items-center justify-center gap-2 rounded-xl border border-[rgba(251,243,222,0.12)] px-3 py-2 text-[12px] font-bold text-[rgba(251,243,222,0.70)]"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && "Comprimi"}
        </button>
      </aside>

      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col xl:mx-0 xl:max-w-none">
        <div className="xl:hidden">
          <TopBar />
        </div>
        <header className="sticky top-0 z-20 hidden border-b border-[rgba(251,243,222,0.10)] bg-[#123008]/95 px-8 py-4 backdrop-blur xl:flex xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[rgba(251,243,222,0.44)]">
              <Home size={14} />
              <span>Super Admin</span>
              <ChevronRight size={14} />
              <span className="text-[#BBFF5E]">{currentItem?.label ?? "Dashboard"}</span>
            </div>
            <h1 className="mt-1 font-display text-[28px] leading-none text-[#FBF3DE]">{currentItem?.label ?? "Dashboard"}</h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(251,243,222,0.14)] bg-[#0A0B08] px-4 py-2 text-[12px] font-bold text-[rgba(251,243,222,0.82)]"
          >
            <LogOut size={15} />
            {appUser ? ROLE_LABELS[appUser.role] : "Esci"}
          </button>
        </header>
        <main className="flex-1 pb-24 xl:px-8 xl:py-6 xl:pb-10">
          <div className="xl:mx-auto xl:w-full xl:max-w-[1440px]">{children}</div>
        </main>
        <AppFooter />
        <div className="xl:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}
