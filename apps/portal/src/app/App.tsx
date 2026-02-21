import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "../shared/auth/AuthProvider";
import { getPortalRoute, getVisibleApps } from "../shared/auth/access";
import { ProtectedRoute } from "../shared/auth/ProtectedRoute";
import { PortalShell } from "./shell/PortalShell";
import { HomePage } from "../features/home/HomePage";
import { AppLaunchPage } from "../features/apps/AppLaunchPage";
import { ProfileSettingsPage } from "../features/profile/ProfileSettingsPage";
import { getCurrentProfile, type ProfileMeResponse } from "../features/profile/profileApi";

const DEFAULT_APP_REDIRECT_KEY_PREFIX = "portal.default-app-redirected";

function PortalRoutes() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const visibleApps = getVisibleApps(user.roles);
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [profileLoadError, setProfileLoadError] = useState("");

  useEffect(() => {
    let active = true;
    setProfile(null);
    setProfileLoadError("");

    getCurrentProfile()
      .then((loadedProfile) => {
        if (active) {
          setProfile(loadedProfile);
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unable to load profile settings";
        setProfileLoadError(message);
      });

    return () => {
      active = false;
    };
  }, [user.sessionExpiresAt, user.userId]);

  useEffect(() => {
    if (location.pathname !== "/" || !profile) {
      return;
    }

    const preferredAppId = profile.preferences.defaultApp;
    const preferredRoute = getPortalRoute(preferredAppId);
    if (preferredRoute === "/") {
      return;
    }

    const isPreferredAppVisible = visibleApps.some((app) => app.id === preferredAppId);
    if (!isPreferredAppVisible) {
      return;
    }

    const sessionRedirectKey = `${DEFAULT_APP_REDIRECT_KEY_PREFIX}:${user.userId}:${user.sessionExpiresAt}`;
    if (window.sessionStorage.getItem(sessionRedirectKey) === "1") {
      return;
    }

    window.sessionStorage.setItem(sessionRedirectKey, "1");
    navigate(preferredRoute, { replace: true });
  }, [location.pathname, navigate, profile, user.sessionExpiresAt, user.userId, visibleApps]);

  return (
    <PortalShell user={user} visibleApps={visibleApps}>
      <Routes>
        <Route path="/" element={<HomePage user={user} visibleApps={visibleApps} />} />

        <Route
          path="/apps/infinity"
          element={
            <ProtectedRoute appId="infinity">
              <AppLaunchPage appId="infinity" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/apps/warehouse-mobile"
          element={
            <ProtectedRoute appId="warehouse-mobile">
              <AppLaunchPage appId="warehouse-mobile" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/apps/accounting"
          element={
            <ProtectedRoute appId="accounting">
              <AppLaunchPage appId="accounting" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings/profile"
          element={
            <ProfileSettingsPage
              user={user}
              visibleApps={visibleApps}
              profile={profile}
              profileLoadError={profileLoadError}
              onProfileUpdated={setProfile}
            />
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PortalShell>
  );
}

export function App() {
  if (typeof window !== "undefined") {
    const forceError = new URLSearchParams(window.location.search).get("__e2e_force_error__");
    if (forceError === "1") {
      throw new Error("Forced Portal render failure for reliability test.");
    }
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <PortalRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
