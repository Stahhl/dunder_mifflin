import { describe, expect, it } from "vitest";
import { createLoginUrl, createLogoutUrl } from "./redirect";

describe("auth redirects", () => {
  it("builds login url with encoded return path", () => {
    const loginUrl = createLoginUrl("/apps/infinity?from=portal");
    expect(loginUrl).toContain("/oauth2/authorization/keycloak");
    expect(loginUrl).toContain("returnTo=%2Fapps%2Finfinity%3Ffrom%3Dportal");
  });

  it("builds logout url", () => {
    expect(createLogoutUrl()).toContain("/logout");
  });
});
