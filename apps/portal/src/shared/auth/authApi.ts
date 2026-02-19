import { apiClient } from "../http/apiClient";
import type { AuthMeResponse } from "./types";

export function getCurrentUser(): Promise<AuthMeResponse> {
  return apiClient<AuthMeResponse>("/api/v1/auth/me");
}
