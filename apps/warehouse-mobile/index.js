import { registerRootComponent } from "expo";
import App from "./App";
import { AppErrorBoundary } from "./src/components/AppErrorBoundary";

function Root() {
  return (
    <AppErrorBoundary appName="Warehouse Mobile">
      <App />
    </AppErrorBoundary>
  );
}

registerRootComponent(Root);
