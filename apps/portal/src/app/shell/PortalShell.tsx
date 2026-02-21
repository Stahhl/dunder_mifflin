import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { getPortalRoute } from "../../shared/auth/access";
import type { AppDefinition, AuthMeResponse } from "../../shared/auth/types";
import { useAuth } from "../../shared/auth/AuthProvider";
import { WuphfWidget } from "../../shared/wuphf/WuphfWidget";
import "./PortalShell.css";

interface PortalShellProps {
  user: AuthMeResponse;
  visibleApps: AppDefinition[];
  children: React.ReactNode;
}

export function PortalShell({ user, visibleApps, children }: PortalShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const activeAppRoute =
    visibleApps.find((app) => getPortalRoute(app.id) === location.pathname) ?? visibleApps[0];

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div>
          <p className="portal-header__eyebrow">Dunder Mifflin</p>
          <h1 className="portal-header__title">Scranton Portal</h1>
        </div>

        <div className="portal-header__actions">
          <label className="portal-switcher" htmlFor="app-switcher">
            <span>App Switcher</span>
            <select
              id="app-switcher"
              value={activeAppRoute ? getPortalRoute(activeAppRoute.id) : "/"}
              onChange={(event) => navigate(event.target.value)}
            >
              {visibleApps.map((app) => (
                <option key={app.id} value={getPortalRoute(app.id)}>
                  {app.label}
                </option>
              ))}
            </select>
          </label>

          <div className="portal-user-pill">
            <span>{user.displayName}</span>
            <button type="button" onClick={logout}>
              Log out
            </button>
          </div>

          <div className="portal-wuphf">
            <WuphfWidget returnTo={location.pathname} />
          </div>
        </div>
      </header>

      <div className="portal-layout">
        <aside className="portal-nav" aria-label="App navigation">
          <h2>Available apps</h2>
          <ul>
            {visibleApps.map((app) => (
              <li key={app.id}>
                <NavLink
                  to={getPortalRoute(app.id)}
                  className={({ isActive }) => (isActive ? "is-active" : "")}
                  end={app.id === "portal"}
                >
                  {app.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </aside>

        <main className="portal-main">{children}</main>
      </div>
    </div>
  );
}
