import { NavLink } from "react-router-dom";
import { Home, Trophy, History, Award, Bell, Settings } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const items = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/campionati", label: "Campionati", icon: Trophy },
  { to: "/storico", label: "Storico", icon: History },
  { to: "/albo", label: "Albo d'oro", icon: Award },
  { to: "/notifiche", label: "Notifiche", icon: Bell },
];

export function BottomNav() {
  const { appUser } = useAuth();

  return (
    <div className="fixed left-3 right-3 bottom-4 z-40 max-w-[454px] mx-auto">
      <nav
        className="flex items-center justify-between rounded-3xl px-2.5 py-2.5 border border-[rgba(255,255,255,0.08)]"
        style={{ background: "rgba(0,0,0,0.94)", backdropFilter: "blur(14px)" }}
      >
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-1.5 rounded-2xl transition-colors ${isActive ? "text-[#BBFF5E] bg-[#BBFF5E]/10" : "text-[rgba(251,243,222,0.35)]"}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={19} strokeWidth={isActive ? 2.4 : 1.8} />
                <span className={`text-[9px] ${isActive ? "font-bold" : "font-medium"}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        {appUser && (
          <NavLink
            to="/gestione"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-1.5 rounded-2xl transition-colors ${isActive ? "text-[#BBFF5E] bg-[#BBFF5E]/10" : "text-[rgba(251,243,222,0.35)]"}`
            }
          >
            {({ isActive }) => (
              <>
                <Settings size={19} strokeWidth={isActive ? 2.4 : 1.8} />
                <span className={`text-[9px] ${isActive ? "font-bold" : "font-medium"}`}>Gestione</span>
              </>
            )}
          </NavLink>
        )}
      </nav>
    </div>
  );
}
