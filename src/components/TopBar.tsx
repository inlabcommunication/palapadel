import { Shield, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_LABELS } from "../types";
import { useNavigate } from "react-router-dom";

export function TopBar() {
  const { appUser, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-10 bg-[#FAF8F3] border-b border-[#EAE7DD]">
      <div className="flex items-center justify-between px-4 py-3 max-w-[480px] mx-auto">
        <img src="/logo.png" alt="PalaPadel Club" className="h-7 w-auto" />
        {appUser ? (
          <button
            onClick={logout}
            className="flex items-center text-xs font-semibold bg-white border border-[#E5E3DC] rounded-full px-3 py-1.5"
          >
            <LogOut size={15} className="mr-1.5" />
            {ROLE_LABELS[appUser.role]}
          </button>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="flex items-center text-xs font-semibold bg-white border border-[#E5E3DC] rounded-full px-3 py-1.5"
          >
            <Shield size={15} className="mr-1.5" />
            Accedi
          </button>
        )}
      </div>
    </header>
  );
}
