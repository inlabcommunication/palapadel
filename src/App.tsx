import { Routes, Route } from "react-router-dom";
import { TopBar } from "./components/TopBar";
import { BottomNav } from "./components/BottomNav";
import { HomePage } from "./pages/Home";
import { CampionatiPage } from "./pages/Campionati";
import { StoricoPage } from "./pages/Storico";
import { AlboPage } from "./pages/Albo";
import { NotifichePage } from "./pages/Notifiche";
import { LoginPage } from "./pages/Login";
import { GestionePage } from "./pages/Gestione";

export default function App() {
  return (
    <div className="min-h-screen max-w-[480px] mx-auto flex flex-col bg-[#123008]">
      <TopBar />
      <main className="flex-1 pb-24">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/campionati" element={<CampionatiPage />} />
          <Route path="/campionati/:editionId" element={<CampionatiPage />} />
          <Route path="/storico" element={<StoricoPage />} />
          <Route path="/albo" element={<AlboPage />} />
          <Route path="/notifiche" element={<NotifichePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/gestione" element={<GestionePage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
