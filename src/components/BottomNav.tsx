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
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-[#EAE7DD] flex px-1 py-2">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-1 ${isActive ? "text-court font-bold" : "text-[#8A8A85]"}`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              <span className="text-[10px] mt-0.5">{label}</span>
            </>
          )}
        </NavLink>
      ))}
      {appUser && (
        <NavLink
          to="/gestione"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-1 ${isActive ? "text-court font-bold" : "text-[#8A8A85]"}`
          }
        >
          {({ isActive }) => (
            <>
              <Settings size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              <span className="text-[10px] mt-0.5">Gestione</span>
            </>
          )}
        </NavLink>
      )}
    </nav>
  );
}
