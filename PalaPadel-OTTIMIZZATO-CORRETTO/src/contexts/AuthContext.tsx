import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { normalizeRole, type AppUser } from "../types";

export type AppViewMode = "operational" | "public";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  authenticatedAppUser: AppUser | null;
  viewMode: AppViewMode;
  setViewMode: (mode: AppViewMode) => void;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authenticatedAppUser, setAuthenticatedAppUser] = useState<AppUser | null>(null);
  const [viewMode, setViewModeState] = useState<AppViewMode>(() =>
    sessionStorage.getItem("palapadelViewMode") === "public" ? "public" : "operational"
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fu) => {
      setFirebaseUser(fu);
      if (fu) {
        const snap = await getDoc(doc(db, "users", fu.uid));
        const data = snap.exists() ? snap.data() : null;
        const role = normalizeRole(data?.role);
        setAuthenticatedAppUser(data && role && data.disabled !== true ? ({ ...data, role } as AppUser) : null);
        setViewModeState(sessionStorage.getItem("palapadelViewMode") === "public" ? "public" : "operational");
      } else {
        setAuthenticatedAppUser(null);
        setViewModeState("operational");
        sessionStorage.removeItem("palapadelViewMode");
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    sessionStorage.setItem("palapadelViewMode", "operational");
    setViewModeState("operational");
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  const setViewMode = (mode: AppViewMode) => {
    setViewModeState(mode);
    sessionStorage.setItem("palapadelViewMode", mode);
  };

  const appUser = viewMode === "public" ? null : authenticatedAppUser;

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, authenticatedAppUser, viewMode, setViewMode, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth va usato dentro <AuthProvider>");
  return ctx;
}
