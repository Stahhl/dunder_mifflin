import { sha256 } from "js-sha256";

export async function buildPkcePair(): Promise<{ state: string; verifier: string; challenge: string }> {
  const state = randomUrlSafeString(24);
  const verifier = randomUrlSafeString(64);
  const challenge = await sha256UrlSafe(verifier);

  return { state, verifier, challenge };
}

function randomUrlSafeString(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  let value = "";
  for (let index = 0; index < bytes.length; index += 1) {
    value += alphabet[bytes[index] % alphabet.length];
  }

  return value;
}

async function sha256UrlSafe(value: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    const digest = Uint8Array.from(sha256.array(value));
    return bufferToBase64Url(digest);
  }

  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bufferToBase64Url(new Uint8Array(digest));
}

function bufferToBase64Url(input: Uint8Array): string {
  let binary = "";
  input.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
