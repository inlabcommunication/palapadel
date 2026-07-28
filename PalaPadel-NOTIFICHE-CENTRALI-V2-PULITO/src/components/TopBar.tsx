import { Shield, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_LABELS } from "../types";
import { useNavigate } from "react-router-dom";

export function TopBar() {
  const { authenticatedAppUser, viewMode, setViewMode, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-10 bg-[#123008] border-b border-[rgba(251,243,222,0.10)] relative">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#BBFF5E]/40 to-transparent pointer-events-none" aria-hidden="true" />
      <div
        className={`relative flex items-center gap-2 px-4 py-2 max-w-[480px] mx-auto ${
          authenticatedAppUser ? "min-h-[104px] justify-center pt-14" : "min-h-14 justify-end"
        }`}
      >
        <img
          src="/palapadel-club-transparent.png"
          alt="PalaPadel Club"
          className={`pointer-events-none absolute left-1/2 h-10 w-[150px] -translate-x-1/2 object-contain ${
            authenticatedAppUser ? "top-2" : "top-1/2 -translate-y-1/2"
          }`}
        />
        {authenticatedAppUser ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="grid grid-cols-2 rounded-lg border border-[rgba(251,243,222,0.14)] bg-[#0A0B08] p-1">
              <button
                type="button"
                onClick={() => setViewMode("operational")}
                className={`rounded-md px-2 py-1.5 text-[10px] font-bold ${
                  viewMode === "operational" ? "bg-[#BBFF5E] text-[#081208]" : "text-[rgba(251,243,222,0.58)]"
                }`}
              >
                {authenticatedAppUser.role === "resultManager"
                  ? "Gestore"
                  : authenticatedAppUser.role === "admin"
                    ? "Amministratore"
                    : "Super Admin"}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("public")}
                className={`rounded-md px-2 py-1.5 text-[10px] font-bold ${
                  viewMode === "public" ? "bg-[#BBFF5E] text-[#081208]" : "text-[rgba(251,243,222,0.58)]"
                }`}
              >
                Utente
              </button>
            </div>
            <button onClick={logout} aria-label={`Esci da ${ROLE_LABELS[authenticatedAppUser.role]}`} className="rounded-full bg-[#0A0B08] p-2">
              <LogOut size={15} />
            </button>
          </div>
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
