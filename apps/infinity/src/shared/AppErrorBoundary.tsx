import React from "react";

interface AppErrorBoundaryProps {
  appName: string;
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: ""
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Unexpected rendering error"
    };
  }

  componentDidCatch(error: Error) {
    // Keep the console signal for debugging while presenting friendly UI.
    // eslint-disable-next-line no-console
    console.error("AppErrorBoundary", error);
  }

  private reload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="wrap">
        <section className="panel">
          <h1>{this.props.appName}</h1>
          <p className="alert alert-error" data-testid="app-error-boundary">
            Something went wrong while rendering this page.
          </p>
          <p className="meta">{this.state.message}</p>
          <button type="button" onClick={this.reload}>Reload app</button>
        </section>
      </main>
    );
  }
}
