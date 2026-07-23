import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/gestione");
    } catch {
      setError("Credenziali non valide. Riprova.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-sm font-bold mb-1">Accesso area gestione</h2>
      <p className="text-[12.5px] text-[#9A9A94] mb-4">
        Gli account (Super amministratore, Amministratore, Gestore risultati) vengono creati dal Super
        amministratore nella sezione Gestione utenti.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-[#E5E3DC] rounded-lg px-3 py-2.5 text-sm"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-[#E5E3DC] rounded-lg px-3 py-2.5 text-sm"
          required
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-court text-white rounded-lg py-2.5 text-sm font-bold mt-2 disabled:opacity-50"
        >
          {submitting ? "Accesso in corso..." : "Entra"}
        </button>
      </form>
    </div>
  );
}
