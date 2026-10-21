import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import "./index.css";
// Intercetta subito beforeinstallprompt, prima che il pulsante "Installa" sia montato.
import "./lib/pwaInstall";

// Dopo un nuovo deploy i vecchi file JavaScript non esistono più: se una pagina
// caricata in un secondo momento non si trova, si ricarica una volta il sito.
window.addEventListener("vite:preloadError", (event) => {
  try {
    const last = Number(sessionStorage.getItem("palapadelChunkReload") ?? 0);
    if (Date.now() - last < 10_000) return;
    sessionStorage.setItem("palapadelChunkReload", String(Date.now()));
  } catch {
    // sessionStorage non disponibile: si ricarica comunque una volta.
  }
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
