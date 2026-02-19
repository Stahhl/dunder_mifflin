export type AppId = "portal" | "infinity" | "warehouse-mobile" | "accounting";

export interface AuthMeResponse {
  userId: string;
  displayName: string;
  roles: string[];
  groups: string[];
  apps: string[];
  sessionExpiresAt: string;
}

export interface AppDefinition {
  id: AppId;
  label: string;
  description: string;
  launchUrl: string;
}
