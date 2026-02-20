const ACCESS_TOKEN_KEY = "warehouse_mobile_access_token";
const PKCE_STATE_KEY = "warehouse_pkce_state";
const PKCE_VERIFIER_KEY = "warehouse_pkce_verifier";

export function readStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function storeAccessToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearStoredAccessToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function storePkceState(state: string, verifier: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(PKCE_STATE_KEY, state);
  window.sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
}

export function readPkceState(): { state: string | null; verifier: string | null } {
  if (typeof window === "undefined") {
    return { state: null, verifier: null };
  }

  return {
    state: window.sessionStorage.getItem(PKCE_STATE_KEY),
    verifier: window.sessionStorage.getItem(PKCE_VERIFIER_KEY)
  };
}
