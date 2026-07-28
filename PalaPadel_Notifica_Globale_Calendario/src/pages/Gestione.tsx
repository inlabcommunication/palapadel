import { useNavigate } from "react-router-dom";
import { where } from "firebase/firestore";
import { BarChart3, RefreshCw, Settings } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useCollection } from "../hooks/useCollection";
import type { ChampionshipEdition, ChampionshipType, Match, Matchday, Role } from "../types";
import { BADGE_COLORS, ROLE_LABELS } from "../types";
import { HomePage } from "./Home";
import { sortEditionsByTypeOrder } from "../lib/championshipOrder";

export function GestionePage() {
  const { appUser } = useAuth();
  if (!appUser) return <div className="p-4 text-sm text-[rgba(251,243,222,0.58)]">Devi accedere per vedere questa pagina.</div>;
  if (appUser.role === "admin" || appUser.role === "resultManager") return <OperationalChampionshipsPage />;
  return <SuperAdminDashboard role={appUser.role} />;
}

export function OperationalChampionshipsPage() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const { data: editions, loading, error, retry } = useCollection<ChampionshipEdition>("championshipEditions", [
    where("status", "==", "attiva"),
  ]);
  const { data: types } = useCollection<ChampionshipType>("championshipTypes");
  const { data: matchdays } = useCollection<Matchday>("matchdays");
  const { data: matches } = useCollection<Match>("matches");

  if (!appUser) return <div className="p-4 text-sm">Accesso richiesto.</div>;
  if (error) {
    return <div className="p-4"><h2 className="font-bold">Campionati non disponibili</h2><p className="my-2 text-sm">{error.message}</p><button onClick={retry} className="text-sm font-bold text-[#BBFF5E]">Riprova</button></div>;
  }

  const visible = sortEditionsByTypeOrder(editions, types)
    .filter((edition) => edition.isPubliclyVisible !== false)
    .filter((edition) => types.find((type) => type.id === edition.typeId)?.hasTeams);

  return (
    <div className="p-4 pb-6">
      <h2 className="mb-1 text-[13px] font-extrabold uppercase tracking-wider text-[#FBF3DE]">Campionati attivi</h2>
      <p className="mb-4 text-[12.5px] text-[rgba(251,243,222,0.58)]">Scegli il campionato su cui lavorare.</p>
      {loading ? (
        <p className="text-sm text-[rgba(251,243,222,0.58)]">Caricamento campionati...</p>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-[rgba(251,243,222,0.14)] bg-[#0A0B08] p-4">
          <h3 className="font-bold">Nessun campionato attivo</h3>
          <p className="mt-1 text-sm text-[rgba(251,243,222,0.58)]">Il Super Admin deve attivare almeno un campionato a squadre.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((edition) => {
            const type = types.find((item) => item.id === edition.typeId);
            const badge = BADGE_COLORS[type?.badgeColor ?? "serie-b"];
            const activeDay = matchdays.find((day) => day.id === edition.activeMatchdayId);
            const incomplete = matches.filter((match) => match.editionId === edition.id && match.status === "da_giocare").length;
            return (
              <button key={edition.id} onClick={() => navigate(`/gestione/edizione/${edition.id}`)}
                className="relative w-full overflow-hidden rounded-lg border border-[rgba(251,243,222,0.12)] bg-[#0A0B08] px-4 py-4 text-left transition-colors hover:border-[rgba(187,255,94,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#BBFF5E]">
                <span className="absolute inset-y-0 left-0 w-1" style={{ background: badge.text }} aria-hidden="true" />
                {type?.logoUrl && <img src={type.logoUrl} alt={type.logoAlt ?? `Logo ${type.name}`} className="mb-3 h-14 w-14 rounded-lg object-cover" />}
                <p className="text-lg font-bold">{type?.name} {edition.season}</p>
                <p className="mt-1 text-xs text-[rgba(251,243,222,0.58)]">
                  {activeDay ? `Giornata attiva: ${activeDay.number}` : "Giornata attiva non impostata"}
                  {` · ${incomplete} risultat${incomplete === 1 ? "o" : "i"} da completare`}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SuperAdminDashboard({ role }: { role: Role }) {
  const navigate = useNavigate();
  const { setViewMode } = useAuth();
  return (
    <div className="p-4 pb-6">
      <div className="mb-4 flex items-center gap-2">
        <Settings size={16} className="text-[#BBFF5E]" />
        <h2 className="text-[13px] font-extrabold uppercase text-[#FBF3DE]">Gestione · {ROLE_LABELS[role]}</h2>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button onClick={() => navigate("/analytics")} className="rounded-lg border border-[rgba(251,243,222,0.12)] bg-[#0A0B08] p-3 text-xs font-bold"><BarChart3 size={16} className="mx-auto mb-1 text-[#BBFF5E]" />Analytics</button>
        <button onClick={() => navigate("/utenti-impostazioni")} className="rounded-lg border border-[rgba(251,243,222,0.12)] bg-[#0A0B08] p-3 text-xs font-bold"><Settings size={16} className="mx-auto mb-1 text-[#BBFF5E]" />Impostazioni</button>
      </div>
      <section className="overflow-hidden rounded-lg border border-[rgba(251,243,222,0.12)]">
        <div className="flex items-center justify-between bg-[#0A0B08] px-3 py-2">
          <strong className="text-xs uppercase text-[#BBFF5E]">Anteprima Home pubblica</strong>
          <div className="flex items-center gap-3">
            <button onClick={() => window.location.reload()} className="inline-flex items-center gap-1 text-xs font-bold" aria-label="Aggiorna anteprima Home">
              <RefreshCw size={13} /> Aggiorna
            </button>
            <button onClick={() => { setViewMode("public"); navigate("/"); }} className="text-xs font-bold">Apri come utente</button>
          </div>
        </div>
        <HomePage />
      </section>
    </div>
  );
}
