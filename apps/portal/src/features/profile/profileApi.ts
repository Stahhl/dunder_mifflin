import { apiClient } from "../../shared/http/apiClient";
import type { AppId } from "../../shared/auth/types";

export interface ProfileMeResponse {
  userId: string;
  profile: {
    fullName: string;
    email: string;
    title: string;
    phone: string;
  };
  preferences: {
    defaultApp: AppId;
    notificationsEnabled: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileMeRequest {
  profile: {
    fullName: string;
    email: string;
    title: string;
    phone: string;
  };
  preferences: {
    defaultApp: AppId;
    notificationsEnabled: boolean;
  };
}

export function getCurrentProfile(): Promise<ProfileMeResponse> {
  return apiClient<ProfileMeResponse>("/api/v1/profile/me");
}

export function updateCurrentProfile(payload: UpdateProfileMeRequest): Promise<ProfileMeResponse> {
  return apiClient<ProfileMeResponse>("/api/v1/profile/me", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}
