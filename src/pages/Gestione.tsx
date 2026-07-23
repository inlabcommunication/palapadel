import { useState } from "react";
import { doc, setDoc, where } from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { useAuth } from "../contexts/AuthContext";
import { useCollection } from "../hooks/useCollection";
import { db, auth, getSecondaryAuth } from "../firebase";
import type { AppUser, ChampionshipEdition, ChampionshipType, Role } from "../types";
import { ROLE_LABELS } from "../types";
import { PasswordInput } from "../components/PasswordInput";
import { slugifyUsername, usernameToEmail } from "../lib/username";

export function GestionePage() {
  const { appUser } = useAuth();
  if (!appUser) return <div className="p-4 text-sm text-[#7A7A75]">Devi accedere per vedere questa pagina.</div>;

  if (appUser.role === "gestore") return <GestoreView />;
  return <AdminView role={appUser.role} />;
}

function GestoreView() {
  const { data: editions } = useCollection<ChampionshipEdition>("championshipEditions", [
    where("status", "==", "attiva"),
  ]);
  const { data: types } = useCollection<ChampionshipType>("championshipTypes");

  return (
    <div className="p-4">
      <h2 className="text-sm font-bold mb-1">Campionati attivi</h2>
      <p className="text-[12.5px] text-[#9A9A94] mb-4">
        Inserimento risultati per giornata arriva in Fase 3.
      </p>
      {editions.map((e) => {
        const t = types.find((x) => x.id === e.typeId);
        return (
          <div key={e.id} className="bg-white border border-[#EAE7DD] rounded-xl px-3.5 py-3 mb-2">
            <p className="font-bold">
              {t?.name} {e.season}
            </p>
            <p className="text-xs text-[#9A9A94] mt-1">Aggiorna giornata · Vedi classifica (Fase 3)</p>
          </div>
        );
      })}
    </div>
  );
}

function AdminView({ role }: { role: Role }) {
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="p-4">
      <h2 className="text-sm font-bold mb-1">Gestione — {ROLE_LABELS[role]}</h2>
      <p className="text-[12.5px] text-[#9A9A94] mb-4">
        La gestione di campionati, squadre e classifiche si trova nella pagina{" "}
        <span className="font-semibold">Campionati</span>. La pubblicazione delle novità si trova in{" "}
        <span className="font-semibold">Home</span>.
      </p>

      {role === "superadmin" ? (
        <>
          <UserManagement onDone={showToast} />
          <ChangePasswordManagement onDone={showToast} />
        </>
      ) : (
        <p className="text-[12.5px] text-[#9A9A94]">
          La creazione di account è riservata al Super Amministratore.
        </p>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1A1A18] text-white px-4 py-2.5 rounded-full text-[12.5px] max-w-[90%] text-center">
          {toast}
        </div>
      )}
    </div>
  );
}

/**
 * Solo il Super Amministratore crea account, con solo nome utente + password (niente email).
 * Firebase Auth richiede comunque un'email valida internamente: se ne genera una "sintetica"
 * (vedi src/lib/username.ts) mai mostrata all'utente, e si salva una mappatura pubblica
 * nome utente -> email in usernameEmails/{slug} per permettere il login con solo username.
 * Vedi src/firebase.ts per il trucco della sessione secondaria che evita di scollegare
 * il Super Amministratore durante la creazione.
 */
function UserManagement({ onDone }: { onDone: (msg: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("gestore");
  const [creating, setCreating] = useState(false);

  const createUser = async () => {
    if (!username.trim() || !password.trim()) return;
    if (password.length < 6) {
      onDone("La password deve avere almeno 6 caratteri.");
      return;
    }
    setCreating(true);
    try {
      const email = usernameToEmail(username);
      const slug = slugifyUsername(username);
      const secondaryAuth = getSecondaryAuth();
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        username: username.trim(),
        role,
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, "usernameEmails", slug), { email });
      await signOut(secondaryAuth); // non tocca la sessione del Super Amministratore
      setUsername("");
      setPassword("");
      onDone(`Account creato: ${username} (${ROLE_LABELS[role]})`);
    } catch (err) {
      console.error(err);
      onDone("Errore nella creazione dell'account. Il nome utente potrebbe essere già in uso.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mb-6">
      <p className="text-[13px] font-bold mb-2">Nuovo account amministrativo</p>
      <input
        placeholder="Nome utente"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <PasswordInput value={password} onChange={setPassword} placeholder="Password" className="mb-2" />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-[13px] bg-white mb-2"
      >
        <option value="admin">Amministratore</option>
        <option value="gestore">Gestore risultati</option>
      </select>
      <button
        onClick={createUser}
        disabled={creating}
        className="w-full bg-court text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
      >
        {creating ? "Creazione in corso..." : "Crea account"}
      </button>
    </div>
  );
}

/**
 * Il Super Amministratore può sempre cambiare la password di un account esistente.
 * Firebase Auth lato client permette di cambiare SOLO la propria password: per cambiare
 * quella di un altro utente serve l'Admin SDK, quindi questa funzione chiama una piccola
 * funzione serverless (api/admin/set-password) che gira su Vercel. Vedi README.
 */
function ChangePasswordManagement({ onDone }: { onDone: (msg: string) => void }) {
  const { data: users } = useCollection<AppUser>("users");
  const [targetUid, setTargetUid] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const uid = targetUid || users[0]?.uid;
    if (!uid || !newPassword.trim()) return;
    if (newPassword.length < 6) {
      onDone("La nuova password deve avere almeno 6 caratteri.");
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ targetUid: uid, newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Errore sconosciuto");
      }
      setNewPassword("");
      onDone("Password aggiornata.");
    } catch (err) {
      console.error(err);
      onDone("Errore nell'aggiornamento della password. Controlla la configurazione del backend (vedi README).");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <p className="text-[13px] font-bold mb-2">Cambia password di un account esistente</p>
      <select
        value={targetUid}
        onChange={(e) => setTargetUid(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-[13px] bg-white mb-2"
      >
        <option value="" disabled>
          Scegli account...
        </option>
        {users.map((u) => (
          <option key={u.uid} value={u.uid}>
            {u.username} ({ROLE_LABELS[u.role]})
          </option>
        ))}
      </select>
      <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="Nuova password" className="mb-2" />
      <button
        onClick={submit}
        disabled={submitting}
        className="w-full bg-court text-white rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
      >
        {submitting ? "Aggiornamento in corso..." : "Aggiorna password"}
      </button>
    </div>
  );
}
