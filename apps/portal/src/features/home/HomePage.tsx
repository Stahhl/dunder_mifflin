import { Link } from "react-router-dom";
import { getPortalRoute } from "../../shared/auth/access";
import type { AppDefinition, AuthMeResponse } from "../../shared/auth/types";

interface HomePageProps {
  user: AuthMeResponse;
  visibleApps: AppDefinition[];
}

export function HomePage({ user, visibleApps }: HomePageProps) {
  return (
    <section>
      <h2>Welcome, {user.displayName}</h2>
      <p>
        Your account has {user.roles.length} role{user.roles.length === 1 ? "" : "s"}. Use the app
        switcher or cards below to move between department applications.
      </p>

      <div className="portal-card-grid">
        {visibleApps.map((app) => (
          <article key={app.id} className="portal-card">
            <h2>{app.label}</h2>
            <p>{app.description}</p>
            <div className="portal-card__actions">
              <Link to={getPortalRoute(app.id)} className="primary">
                Open launcher
              </Link>
              <a href={app.launchUrl}>Open app URL</a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
