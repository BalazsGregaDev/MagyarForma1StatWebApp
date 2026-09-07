// ---------------------------------------------------------------------
//  src/lib/AuthContext.tsx
//
//  A Sanctum + localStorage("role") megoldást váltja ki.
//
//  Amiért fontos: a régi kódban az admin jogosultság a böngésző
//  localStorage-ában egy string volt ("role" === "admin"), amit a konzolból
//  egy sorral hamisítani lehetett. Itt az isAdmin érték az adatbázisból jön,
//  és — ami a lényeg — a tényleges védelmet nem ez adja, hanem az RLS:
//  még ha valaki át is állítja az állapotot a böngészőben, az adatbázis
//  elutasítja az írást, mert az admin_write policy a profiles.role értékét
//  nézi a szerveren.
// ---------------------------------------------------------------------
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, readableError } from "./supabase";

interface AuthState {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  /** true, amíg az induló session-ellenőrzés fut */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  /** Lekérdezi, hogy az aktuális felhasználó admin-e. */
  const refreshRole = useCallback(async (current: Session | null) => {
    if (!current) {
      setIsAdmin(false);
      return;
    }
    const { data, error } = await supabase.rpc("is_admin");
    setIsAdmin(!error && data === true);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await refreshRole(data.session);
      setLoading(false);
    });

    // Token-frissítés, kijelentkezés, másik fülön való bejelentkezés
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!active) return;
      setSession(next);
      await refreshRole(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(readableError(error));
    setSession(data.session);
    await refreshRole(data.session);
  }, [refreshRole]);

  const signOut = useCallback(async () => {
    // A régi navbar csak a localStorage-ot ürítette, a szerveroldali
    // session életben maradt. Ez ténylegesen érvényteleníti a tokent.
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(readableError(error));
    setSession(null);
    setIsAdmin(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      isAdmin,
      loading,
      signIn,
      signOut,
    }),
    [session, isAdmin, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("A useAuth() csak az <AuthProvider> fán belül használható.");
  }
  return ctx;
}