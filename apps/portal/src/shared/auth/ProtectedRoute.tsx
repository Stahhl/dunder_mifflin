import { Navigate } from "react-router-dom";
import { canAccessApp } from "./access";
import type { AppId } from "./types";
import { useAuth } from "./AuthProvider";

interface ProtectedRouteProps {
  appId: AppId;
  children: React.ReactElement;
}

export function ProtectedRoute({ appId, children }: ProtectedRouteProps) {
  const { user } = useAuth();

  if (!canAccessApp(appId, user.roles)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
