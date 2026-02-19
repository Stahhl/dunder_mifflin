import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentUser } from "./authApi";
import { redirectToLogout } from "./redirect";
import type { AuthMeResponse } from "./types";
import { UnauthenticatedError } from "../http/apiClient";

type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: AuthMeResponse }
  | { status: "error"; message: string };

interface AuthContextValue {
  user: AuthMeResponse;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function FullPageStatus({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="app-status-screen" role="status" aria-live="polite">
      <h1>{title}</h1>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const loadUser = useCallback(async () => {
    const user = await getCurrentUser();
    setState({ status: "authenticated", user });
  }, []);

  useEffect(() => {
    let active = true;

    loadUser().catch((error: unknown) => {
      if (!active) {
        return;
      }

      if (error instanceof UnauthenticatedError) {
        return;
      }

      const message = error instanceof Error ? error.message : "Unexpected auth error";
      setState({ status: "error", message });
    });

    return () => {
      active = false;
    };
  }, [loadUser]);

  const refreshUser = useCallback(async () => {
    setState({ status: "loading" });
    await loadUser();
  }, [loadUser]);

  const logout = useCallback(() => {
    redirectToLogout();
  }, []);

  const value = useMemo(() => {
    if (state.status !== "authenticated") {
      return undefined;
    }

    return {
      user: state.user,
      refreshUser,
      logout
    };
  }, [logout, refreshUser, state]);

  if (state.status === "loading") {
    return <FullPageStatus title="Checking your session..." />;
  }

  if (state.status === "error") {
    return (
      <FullPageStatus
        title="Unable to open Scranton Portal"
        detail={`Auth bootstrap failed: ${state.message}`}
      />
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
