import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { MeResponse } from "@olc/types";
import { clearToken, getMe, getToken, onUnauthorized } from "../api";
import { forgetIntendedRoute } from "./intended-route";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export type AuthValue = {
  status: AuthStatus;
  user: MeResponse | null;
  /** Loads `/me` for whatever token is stored now. Used after a sign-in. */
  reload: () => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<MeResponse | null>(null);

  const reload = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setStatus("anonymous");
      return;
    }
    try {
      setUser(await getMe());
      setStatus("authenticated");
    } catch {
      // `api.ts` has already dropped the token on a 401; any other failure
      // leaves us equally unable to name the user.
      clearToken();
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  // A 401 from *any* API call lands here, not at the call site. Going anonymous
  // is enough to make `RequireAuth` bounce the user to `/login`.
  useEffect(
    () =>
      onUnauthorized(() => {
        setUser(null);
        setStatus("anonymous");
      }),
    [],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const signOut = useCallback(() => {
    clearToken();
    forgetIntendedRoute();
    setUser(null);
    setStatus("anonymous");
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, reload, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside an AuthProvider");
  return value;
}
