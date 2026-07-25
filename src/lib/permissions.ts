import type { Role } from "../types";

/**
 * Fase 7 — permessi distinti derivati dal ruolo, invece di un unico "canManage"
 * generico. Funzione pura (nessun hook React), così è riusabile sia dalla UI
 * (src/pages/Giornate.tsx) sia dai test automatici (Fase 17).
 */
export interface Permissions {
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isResultManager: boolean;
  canCreateMatches: boolean;
  canDeleteMatches: boolean;
  canEditResults: boolean;
  canManageMatchdays: boolean;
  canCreateHomeNewsDraft: boolean;
}

export function derivePermissions(role: Role | undefined | null): Permissions {
  const isSuperAdmin = role === "superadmin";
  const isAdmin = isSuperAdmin || role === "admin";
  const isResultManager = role === "gestore";
  return {
    isSuperAdmin,
    isAdmin,
    isResultManager,
    canCreateMatches: isAdmin,
    canDeleteMatches: isAdmin,
    canEditResults: isAdmin || isResultManager,
    canManageMatchdays: isAdmin,
    canCreateHomeNewsDraft: isAdmin,
  };
}
