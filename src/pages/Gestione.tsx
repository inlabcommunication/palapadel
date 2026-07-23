import { useState } from "react";
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { useAuth } from "../contexts/AuthContext";
import { useCollection } from "../hooks/useCollection";
import { db, getSecondaryAuth } from "../firebase";
import type { ChampionshipEdition, ChampionshipType, EditionStatus, Role } from "../types";
import { ROLE_LABELS } from "../types";

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
  const { appUser } = useAuth();
  const { data: editions } = useCollection<ChampionshipEdition>("championshipEditions");
  const { data: types } = useCollection<ChampionshipType>("championshipTypes");

  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const publishNews = async () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    await addDoc(collection(db, "homeNews"), {
      title: newTitle,
      body: newBody,
      date: new Date().toISOString().slice(0, 10),
      status: "pubblicato",
    });
    await logAction(appUser?.username ?? "admin", "pubblica_news", newTitle);
    setNewTitle("");
    setNewBody("");
    showToast("Novità pubblicata. Vuoi inviare una notifica? (arriva in Fase 5)");
  };

  const setEditionStatus = async (editionId: string, status: EditionStatus) => {
    await updateDoc(doc(db, "championshipEditions", editionId), { status });
    await logAction(appUser?.username ?? "admin", "cambia_stato_edizione", `${editionId} -> ${status}`);
    showToast("Stato edizione aggiornato");
  };

  return (
    <div className="p-4">
      <h2 className="text-sm font-bold mb-4">Gestione — {ROLE_LABELS[role]}</h2>

      <p className="text-[13px] font-bold mb-2">Pubblica una novità</p>
      <input
        placeholder="Titolo"
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <textarea
        placeholder="Testo della comunicazione"
        value={newBody}
        onChange={(e) => setNewBody(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2.5 text-sm mb-2 min-h-[70px]"
      />
      <button onClick={publishNews} className="w-full bg-court text-white rounded-lg py-2.5 text-sm font-bold">
        Pubblica
      </button>

      <p className="text-[13px] font-bold mt-6 mb-2">Stato edizioni</p>
      <div className="bg-white border border-[#EAE7DD] rounded-xl overflow-hidden">
        {editions.map((e) => {
          const t = types.find((x) => x.id === e.typeId);
          return (
            <div key={e.id} className="px-3.5 py-2.5 border-b border-[#F1EFE8] last:border-b-0">
              <p className="text-sm font-semibold mb-1.5">
                {t?.name} {e.season}
              </p>
              <select
                value={e.status}
                onChange={(ev) => setEditionStatus(e.id, ev.target.value as EditionStatus)}
                className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2 text-[13px] bg-white"
              >
                <option value="bozza">Bozza</option>
                <option value="attiva">Attiva</option>
                <option value="conclusa">Conclusa</option>
                <option value="nascosta">Nascosta</option>
              </select>
            </div>
          );
        })}
      </div>

      {role === "superadmin" && <UserManagement onDone={showToast} />}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1A1A18] text-white px-4 py-2.5 rounded-full text-[12.5px] max-w-[90%] text-center">
          {toast}
        </div>
      )}
    </div>
  );
}

/** Solo il Super Amministratore crea account. Vedi src/firebase.ts per il trucco della sessione secondaria. */
function UserManagement({ onDone }: { onDone: (msg: string) => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("gestore");
  const [creating, setCreating] = useState(false);

  const createUser = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) return;
    setCreating(true);
    try {
      const secondaryAuth = getSecondaryAuth();
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        username: username.trim(),
        role,
        createdAt: new Date().toISOString(),
      });
      await signOut(secondaryAuth); // non tocca la sessione del Super Amministratore
      setUsername("");
      setEmail("");
      setPassword("");
      onDone(`Account creato: ${email} (${ROLE_LABELS[role]})`);
    } catch (err) {
      console.error(err);
      onDone("Errore nella creazione dell'account. Controlla email e password (min 6 caratteri).");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <p className="text-[13px] font-bold mt-6 mb-2">Nuovo account amministrativo</p>
      <input
        placeholder="Nome utente"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <input
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
      <input
        placeholder="Password provvisoria"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full border border-[#E5E3DC] rounded-lg px-3 py-2.5 text-sm mb-2"
      />
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
    </>
  );
}

async function logAction(actor: string, action: string, detail: string) {
  await addDoc(collection(db, "auditLog"), {
    actor,
    action,
    detail,
    timestamp: serverTimestamp(),
  });
}
