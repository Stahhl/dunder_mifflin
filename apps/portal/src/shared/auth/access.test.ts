import { describe, expect, it } from "vitest";
import { canAccessApp, getVisibleApps } from "./access";

describe("role-aware app visibility", () => {
  it("shows manager all apps", () => {
    const apps = getVisibleApps(["manager"]);
    expect(apps.map((app) => app.id)).toEqual([
      "portal",
      "infinity",
      "warehouse-mobile",
      "accounting"
    ]);
  });

  it("shows sales users only portal and infinity", () => {
    const apps = getVisibleApps(["sales-associate"]);
    expect(apps.map((app) => app.id)).toEqual(["portal", "infinity"]);
  });

  it("allows portal-user to open only portal", () => {
    expect(canAccessApp("portal", ["portal-user"])).toBe(true);
    expect(canAccessApp("accounting", ["portal-user"])).toBe(false);
    expect(canAccessApp("warehouse-mobile", ["portal-user"])).toBe(false);
    expect(canAccessApp("infinity", ["portal-user"])).toBe(false);
  });
});
