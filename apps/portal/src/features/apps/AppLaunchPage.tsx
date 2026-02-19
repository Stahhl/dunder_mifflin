import { APP_DEFINITIONS } from "../../shared/auth/access";
import type { AppId } from "../../shared/auth/types";

interface AppLaunchPageProps {
  appId: AppId;
}

export function AppLaunchPage({ appId }: AppLaunchPageProps) {
  const app = APP_DEFINITIONS.find((item) => item.id === appId);

  if (!app) {
    return (
      <section>
        <h2>Unknown app</h2>
        <p>The selected app does not exist in this portal registry.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>{app.label}</h2>
      <p>{app.description}</p>
      <p>
        This PR1 launch screen keeps navigation centralized while app-specific features are delivered in
        later roadmap PRs.
      </p>
      <p>
        <a href={app.launchUrl}>Continue to {app.label}</a>
      </p>
    </section>
  );
}
