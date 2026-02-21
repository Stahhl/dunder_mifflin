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
      <div className="app-status-screen" role="alert" aria-live="assertive">
        <h1>{this.props.appName}</h1>
        <p data-testid="app-error-boundary">Something went wrong while rendering this page.</p>
        <p>{this.state.message}</p>
        <button type="button" onClick={this.reload}>Reload app</button>
      </div>
    );
  }
}
