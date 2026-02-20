import type { JwtClaims } from "../types/warehouse";

export function decodeJwt(token: string | null): JwtClaims | null {
  if (!token) {
    return null;
  }

  const payloadSegment = token.split(".")[1];
  if (!payloadSegment) {
    return null;
  }

  try {
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded) as JwtClaims;
  } catch {
    return null;
  }
}
