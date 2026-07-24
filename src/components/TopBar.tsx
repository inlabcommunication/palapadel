import { Shield, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_LABELS } from "../types";
import { useNavigate } from "react-router-dom";

export function TopBar() {
  const { appUser, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-10 bg-[#123008] border-b border-[rgba(251,243,222,0.10)] relative">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#BBFF5E]/40 to-transparent pointer-events-none" aria-hidden="true" />
      <div className="flex items-center justify-between px-4 py-3 max-w-[480px] mx-auto">
        <div className="bg-[#FBF3DE] rounded-xl px-2.5 py-1.5">
          <img src="/logo.png" alt="PalaPadel Club" className="h-6 w-auto" />
        </div>
        {appUser ? (
          <button
            onClick={logout}
            className="flex items-center text-xs font-semibold bg-[#0A0B08] border border-[rgba(251,243,222,0.18)] rounded-full px-3 py-1.5"
          >
            <LogOut size={15} className="mr-1.5" />
            {ROLE_LABELS[appUser.role]}
          </button>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="flex items-center text-xs font-semibold bg-[#0A0B08] border border-[rgba(251,243,222,0.18)] rounded-full px-3 py-1.5"
          >
            <Shield size={15} className="mr-1.5" />
            Accedi
          </button>
        )}
      </div>
    </header>
  );
}
