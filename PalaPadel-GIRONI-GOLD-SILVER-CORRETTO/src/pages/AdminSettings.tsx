import { useEffect, useState } from "react";
import { Download, ShieldCheck, UserPlus } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { downloadJsonBackup } from "../lib/backupApi";
import { useCollection } from "../hooks/useCollection";
import type { AppUser, AuditLogEntry } from "../types";
import { ROLE_LABELS } from "../types";
import { runStorageCleanup, undoAuditEntry } from "../lib/championshipAdminApi";
import { createAdminUser, setAdminUserPassword, updateAdminUser } from "../lib/userAdminApi";
import { PasswordInput } from "../components/PasswordInput";
import { savePublicSettings, type PublicSettings } from "../lib/publicSettingsApi";

const TABS = ["Utenti e ruoli", "Impostazioni generali", "Accessi e sicurezza", "Firebase e notifiche", "Backup", "Audit log"] as const;
type ProductionError = { id: string; message: string; source?: string; path: string; createdAt: string };

export function AdminSettingsPage() {
  const { appUser } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Utenti e ruoli");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const { data: audit, retry: retryAudit } = useCollection<AuditLogEntry>("auditLog");
  const { data: users } = useCollection<AppUser>("users");
  const { data: productionErrors } = useCollection<ProductionError>("productionErrors");
  const { data: publicSettings } = useCollection<PublicSettings>("publicSettings");

  if (appUser?.role !== "superAdmin") {
    return <div className="p-4 text-sm text-[rgba(251,243,222,0.58)]">Pagina riservata al Super Amministratore.</div>;
  }

  const backup = async () => {
    setBusy(true);
    setMessage("");
    try {
      await downloadJsonBackup();
      setMessage("Backup JSON creato e scaricato.");
    } catch (err) {
      console.error(err);
      setMessage("Creazione del backup non riuscita.");
    } finally {
      setBusy(false);
    }
  };

  const undo = async (entry: AuditLogEntry) => {
    if (!window.confirm(`Annullare l'operazione "${entry.action}"?`)) return;
    setActionId(entry.id);
    try {
      await undoAuditEntry(entry.id);
      setMessage("Operazione annullata e nuovo audit creato.");
      retryAudit();
    } catch (err) {
      console.error(err);
      setMessage("Annullamento bloccato: lo stato potrebbe essere cambiato successivamente.");
    } finally {
      setActionId(null);
    }
  };

  const cleanupStorage = async (operation: "scan" | "process") => {
    setActionId(`storage-${operation}`);
    try {
      const result = await runStorageCleanup(operation);
      setMessage(operation === "scan" ? `${result.queued ?? 0} file orfani accodati.` : `${result.deleted ?? 0} file eliminati, ${result.failed ?? 0} errori.`);
    } catch (err) {
      console.error(err);
      setMessage("Operazione Storage non riuscita.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <section className="p-4 xl:p-0">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck size={18} className="text-[#BBFF5E]" />
        <h2 className="text-[14px] font-extrabold uppercase text-[#FBF3DE]">Utenti e impostazioni</h2>
      </div>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Sezioni utenti e impostazioni">
        {TABS.map((item) => (
          <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${tab === item ? "bg-[#BBFF5E] text-[#081208]" : "bg-[#0A0B08] text-[rgba(251,243,222,0.72)]"}`}>
            {item}
          </button>
        ))}
      </div>

      {tab === "Utenti e ruoli" && <UsersAndRolesPanel users={users} onMessage={setMessage} />}
      {tab === "Accessi e sicurezza" && <SecurityPanel users={users} onMessage={setMessage} />}

      {tab === "Backup" && (
        <div className="rounded-lg border border-[rgba(251,243,222,0.12)] bg-[#0A0B08] p-4">
          <h3 className="font-bold">Backup dati</h3>
          <p className="my-2 text-sm text-[rgba(251,243,222,0.58)]">Esporta i dati applicativi senza password, token, chiavi o sessioni.</p>
          <button onClick={backup} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#BBFF5E] px-3 py-2 text-sm font-bold text-[#081208] disabled:opacity-50">
            <Download size={16} /> {busy ? "Preparazione..." : "Scarica backup JSON"}
          </button>
          {message && <p className="mt-3 text-sm text-[rgba(251,243,222,0.72)]">{message}</p>}
        </div>
      )}

      {tab === "Audit log" && (
        <div className="overflow-hidden rounded-lg border border-[rgba(251,243,222,0.12)] bg-[#0A0B08]">
          {audit.length === 0 ? <p className="p-4 text-sm text-[rgba(251,243,222,0.58)]">Nessuna operazione registrata.</p> :
            [...audit].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 100).map((entry) => (
              <article key={entry.id} className="border-b border-[rgba(251,243,222,0.08)] p-3 last:border-0">
                <div className="flex justify-between gap-3 text-xs"><strong>{entry.action}</strong><time>{entry.timestamp}</time></div>
                <p className="mt-1 text-xs text-[rgba(251,243,222,0.58)]">{entry.actor}</p>
                <details className="mt-2 text-xs"><summary>Differenze</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap">{JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}</pre></details>
                {["result_created", "result_corrected", "match_postponed", "match_cancelled", "match_reopened", "championship_visibility_changed", "championships_reordered", "championship_types_reordered", "home_news_updated", "team_updated"].includes(entry.action) && !entry.undoneAt && (
                  <button onClick={() => undo(entry)} disabled={actionId === entry.id}
                    className="mt-2 rounded-lg border border-[#FFB38B] px-2 py-1 text-xs font-bold text-[#FFB38B] disabled:opacity-50">
                    {actionId === entry.id ? "Annullamento..." : "Annulla operazione"}
                  </button>
                )}
                {entry.undoneAt && <p className="mt-2 text-xs font-bold text-[rgba(251,243,222,0.45)]">Operazione già annullata</p>}
              </article>
            ))}
        </div>
      )}

      {tab === "Firebase e notifiche" && (
        <div className="space-y-4">
        <div className="rounded-lg border border-[rgba(251,243,222,0.12)] bg-[#0A0B08] p-4">
          <h3 className="font-bold">Pulizia Firebase Storage</h3>
          <p className="my-2 text-sm text-[rgba(251,243,222,0.58)]">Individua file News e squadre non più collegati, poi elabora la coda con retry.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => cleanupStorage("scan")} disabled={actionId !== null} className="rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2 text-xs font-bold disabled:opacity-50">Cerca file orfani</button>
            <button onClick={() => cleanupStorage("process")} disabled={actionId !== null} className="rounded-lg bg-[#BBFF5E] px-3 py-2 text-xs font-bold text-[#081208] disabled:opacity-50">Elabora coda</button>
            <a href="/notifiche" className="rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2 text-xs font-bold">Apri notifiche e diagnostica</a>
          </div>
          {message && <p className="mt-3 text-sm text-[rgba(251,243,222,0.72)]">{message}</p>}
        </div>
        <div className="rounded-lg border border-[rgba(251,243,222,0.12)] bg-[#0A0B08] p-4">
          <h3 className="font-bold">Errori recenti in produzione</h3>
          {productionErrors.length === 0 ? (
            <p className="mt-2 text-sm text-[rgba(251,243,222,0.58)]">Nessun errore applicativo registrato.</p>
          ) : [...productionErrors].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20).map((item) => (
            <article key={item.id} className="mt-3 border-t border-[rgba(251,243,222,0.08)] pt-3 text-xs">
              <strong>{item.message}</strong>
              <p className="mt-1 text-[rgba(251,243,222,0.58)]">{item.path} · {item.createdAt}</p>
            </article>
          ))}
        </div>
        </div>
      )}

      {tab === "Impostazioni generali" && (
        <PublicSettingsPanel settings={publicSettings.find((item) => item.id === "global")} onMessage={setMessage} />
      )}
    </section>
  );
}

function PublicSettingsPanel({ settings, onMessage }: { settings?: PublicSettings; onMessage: (message: string) => void }) {
  const [enabled, setEnabled] = useState(Boolean(settings?.publicNoticeEnabled));
  const [notice, setNotice] = useState(settings?.publicNotice ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setEnabled(Boolean(settings?.publicNoticeEnabled));
    setNotice(settings?.publicNotice ?? "");
  }, [settings?.publicNotice, settings?.publicNoticeEnabled]);
  const save = async () => {
    setBusy(true);
    try {
      await savePublicSettings({ publicNoticeEnabled: enabled, publicNotice: notice });
      onMessage("Impostazioni pubbliche aggiornate.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Salvataggio non riuscito.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-lg border border-[rgba(251,243,222,0.12)] bg-[#0A0B08] p-4">
      <h3 className="font-bold">Avviso nella Home pubblica</h3>
      <label className="my-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Mostra avviso</label>
      <textarea value={notice} onChange={(event) => setNotice(event.target.value)} maxLength={300} rows={3}
        placeholder="Testo dell'avviso pubblico" className="w-full rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2" />
      <button onClick={save} disabled={busy || (enabled && !notice.trim())}
        className="mt-3 rounded-lg bg-[#BBFF5E] px-4 py-2 text-sm font-bold text-[#081208] disabled:opacity-40">
        {busy ? "Salvataggio..." : "Salva impostazioni"}
      </button>
    </div>
  );
}

function UsersAndRolesPanel({ users, onMessage }: { users: AppUser[]; onMessage: (message: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "resultManager">("resultManager");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      await createAdminUser({ username: username.trim(), password, role });
      setUsername("");
      setPassword("");
      onMessage("Account creato.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Creazione account non riuscita.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[rgba(251,243,222,0.12)] bg-[#0A0B08] p-4">
        <h3 className="mb-3 flex items-center gap-2 font-bold"><UserPlus size={16} /> Nuovo account</h3>
        <input aria-label="Nome utente" placeholder="Nome utente" value={username} onChange={(event) => setUsername(event.target.value)}
          className="mb-2 w-full rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2" />
        <PasswordInput value={password} onChange={setPassword} placeholder="Password" className="mb-2" />
        <select aria-label="Ruolo" value={role} onChange={(event) => setRole(event.target.value as "admin" | "resultManager")}
          className="mb-2 w-full rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2">
          <option value="admin">Amministratore</option><option value="resultManager">Gestore</option>
        </select>
        <button onClick={create} disabled={busy || username.trim().length < 3 || password.length < 6}
          className="w-full rounded-lg bg-[#BBFF5E] py-2 text-sm font-bold text-[#081208] disabled:opacity-40">
          {busy ? "Creazione..." : "Crea account"}
        </button>
      </div>
      <div className="rounded-lg border border-[rgba(251,243,222,0.12)] bg-[#0A0B08]">
        {users.filter((user) => user.role !== "superAdmin").map((user) => (
          <UserRoleRow key={user.uid} user={user} onMessage={onMessage} />
        ))}
        {users.length === 0 && <p className="p-4 text-sm text-[rgba(251,243,222,0.58)]">Nessun account amministrativo trovato.</p>}
      </div>
    </div>
  );
}

function UserRoleRow({ user, onMessage }: { user: AppUser; onMessage: (message: string) => void }) {
  const [role, setRole] = useState<"admin" | "resultManager">(user.role === "admin" ? "admin" : "resultManager");
  const [disabled, setDisabled] = useState(Boolean(user.disabled));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await updateAdminUser({ uid: user.uid, role, disabled });
      onMessage("Utente aggiornato.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Aggiornamento non riuscito.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="border-b border-[rgba(251,243,222,0.08)] p-3 last:border-0">
      <strong className="text-sm">{user.username}</strong>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={role} onChange={(event) => setRole(event.target.value as "admin" | "resultManager")}
          className="rounded-lg border border-[rgba(251,243,222,0.18)] px-2 py-2 text-xs">
          <option value="admin">Amministratore</option><option value="resultManager">Gestore</option>
        </select>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={disabled} onChange={(event) => setDisabled(event.target.checked)} /> Disattivato</label>
        <button onClick={save} disabled={busy} className="ml-auto rounded-lg border border-[#BBFF5E] px-3 py-2 text-xs font-bold text-[#BBFF5E] disabled:opacity-40">
          {busy ? "Salvataggio..." : "Salva"}
        </button>
      </div>
    </div>
  );
}

function SecurityPanel({ users, onMessage }: { users: AppUser[]; onMessage: (message: string) => void }) {
  const [uid, setUid] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await setAdminUserPassword(uid, password);
      setPassword("");
      onMessage("Password aggiornata.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Aggiornamento password non riuscito.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-lg border border-[rgba(251,243,222,0.12)] bg-[#0A0B08] p-4">
      <h3 className="font-bold">Cambia password</h3>
      <select value={uid} onChange={(event) => setUid(event.target.value)}
        className="my-3 w-full rounded-lg border border-[rgba(251,243,222,0.18)] px-3 py-2">
        <option value="">Seleziona account</option>
        {users.map((user) => <option key={user.uid} value={user.uid}>{user.username} ({ROLE_LABELS[user.role]})</option>)}
      </select>
      <PasswordInput value={password} onChange={setPassword} placeholder="Nuova password" />
      <button onClick={submit} disabled={busy || !uid || password.length < 6}
        className="mt-3 w-full rounded-lg bg-[#BBFF5E] py-2 text-sm font-bold text-[#081208] disabled:opacity-40">
        {busy ? "Aggiornamento..." : "Aggiorna password"}
      </button>
    </div>
  );
}
