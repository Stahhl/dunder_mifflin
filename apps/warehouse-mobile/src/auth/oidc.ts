import { buildPkcePair } from "./pkce";
import { readPkceState, storePkceState } from "./session";
import type { RuntimeConfig } from "../types/warehouse";

export async function startLogin(config: RuntimeConfig): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const { state, verifier, challenge } = await buildPkcePair();
  storePkceState(state, verifier);

  const redirectUri = `${window.location.origin}/auth/callback`;
  const authUrl = new URL(`${config.keycloakBaseUrl}/realms/${config.realm}/protocol/openid-connect/auth`);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid profile email");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  window.location.assign(authUrl.toString());
}

export function isAuthCallbackRoute(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.pathname === "/auth/callback";
}

export async function completeAuthorizationCodeFlow(config: RuntimeConfig): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Authorization callback is only supported in browser mode");
  }

  const query = new URLSearchParams(window.location.search);
  const state = query.get("state");
  const code = query.get("code");
  const error = query.get("error");

  if (error) {
    throw new Error(`Keycloak returned error: ${error}`);
  }

  if (!state || !code) {
    throw new Error("Missing callback parameters");
  }

  const storedPkce = readPkceState();
  if (!storedPkce.state || !storedPkce.verifier || storedPkce.state !== state) {
    throw new Error("PKCE state validation failed");
  }

  const redirectUri = `${window.location.origin}/auth/callback`;
  const tokenUrl = `${config.keycloakBaseUrl}/realms/${config.realm}/protocol/openid-connect/token`;

  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("client_id", config.clientId);
  form.set("code", code);
  form.set("redirect_uri", redirectUri);
  form.set("code_verifier", storedPkce.verifier);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error_description ?? payload?.error ?? "Token exchange failed");
  }

  const accessToken = payload?.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error("Token exchange returned no access token");
  }

  window.history.replaceState({}, "", "/");
  return accessToken;
}
