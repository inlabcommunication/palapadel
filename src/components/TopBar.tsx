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
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-court flex items-center justify-center text-ball text-[11px] font-extrabold">
            PP
          </div>
          <span className="font-bold text-court">PalaPadel</span>
        </div>
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
