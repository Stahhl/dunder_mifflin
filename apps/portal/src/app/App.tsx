import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "../shared/auth/AuthProvider";
import { getVisibleApps } from "../shared/auth/access";
import { ProtectedRoute } from "../shared/auth/ProtectedRoute";
import { PortalShell } from "./shell/PortalShell";
import { HomePage } from "../features/home/HomePage";
import { AppLaunchPage } from "../features/apps/AppLaunchPage";

function PortalRoutes() {
  const { user } = useAuth();
  const visibleApps = getVisibleApps(user.roles);

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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PortalShell>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PortalRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
