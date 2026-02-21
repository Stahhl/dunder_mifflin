import React from "react";
import { Pressable, SafeAreaView, Text, View } from "react-native";

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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f3efe7" }}>
        <View style={{ padding: 20, gap: 12 }}>
          <Text style={{ fontSize: 28, fontWeight: "700", color: "#1e293b" }}>{this.props.appName}</Text>
          <Text style={{ color: "#991b1b" }} testID="app-error-boundary">
            Something went wrong while rendering this page.
          </Text>
          <Text style={{ color: "#334155" }}>{this.state.message}</Text>
          <Pressable
            style={{ backgroundColor: "#0b5cab", paddingVertical: 10, borderRadius: 8, alignItems: "center" }}
            onPress={this.reload}
          >
            <Text style={{ color: "#ffffff", fontWeight: "700" }}>Reload app</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
}
