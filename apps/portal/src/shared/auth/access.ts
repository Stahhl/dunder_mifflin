import type { AppDefinition, AppId } from "./types";

const MANAGER_ROLE = "manager";

const APP_ROLE_RULES: Record<AppId, string[]> = {
  portal: [],
  infinity: ["sales-associate"],
  "warehouse-mobile": ["warehouse-operator"],
  accounting: ["accountant"]
};

export const APP_DEFINITIONS: AppDefinition[] = [
  {
    id: "portal",
    label: "Scranton Portal",
    description: "Central launcher and role-aware navigation.",
    launchUrl: "/"
  },
  {
    id: "infinity",
    label: "Infinity",
    description: "Sales workspace for leads, conversion, and order placement.",
    launchUrl: "/infinity"
  },
  {
    id: "warehouse-mobile",
    label: "Warehouse Mobile",
    description: "Shipment queue, barcode scans, and dispatch workflow.",
    launchUrl: "/warehouse-mobile"
  },
  {
    id: "accounting",
    label: "Accounting Suite",
    description: "Expense queue and approval workflow.",
    launchUrl: "/accounting"
  }
];

export function canAccessApp(appId: AppId, roles: readonly string[]): boolean {
  if (roles.includes(MANAGER_ROLE)) {
    return true;
  }

  const requiredRoles = APP_ROLE_RULES[appId];
  if (requiredRoles.length === 0) {
    return true;
  }

  return requiredRoles.some((role) => roles.includes(role));
}

export function getVisibleApps(roles: readonly string[]): AppDefinition[] {
  return APP_DEFINITIONS.filter((app) => canAccessApp(app.id, roles));
}

export function getPortalRoute(appId: AppId): string {
  return appId === "portal" ? "/" : `/apps/${appId}`;
}
