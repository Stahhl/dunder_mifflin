import { createElement, useEffect, useMemo, useState } from "react";
import { gatewayBaseUrl } from "./api";

const WUPHF_TAG = "dunder-wuphf-widget";

let widgetScriptPromise: Promise<void> | null = null;
let widgetScriptSource = "";

function inferWidgetBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:3003`;
  }

  return "http://localhost:3003";
}

function ensureWidgetScript(widgetBaseUrl: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (customElements.get(WUPHF_TAG)) {
    return Promise.resolve();
  }

  const scriptUrl = `${widgetBaseUrl.replace(/\/$/, "")}/wuphf-widget.js`;

  if (widgetScriptPromise && widgetScriptSource === scriptUrl) {
    return widgetScriptPromise;
  }

  widgetScriptSource = scriptUrl;
  widgetScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src='${scriptUrl}']`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load WUPHF widget script")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load WUPHF widget script"));
    document.head.appendChild(script);
  });

  return widgetScriptPromise;
}

interface WuphfWidgetProps {
  returnTo: string;
}

export function WuphfWidget({ returnTo }: WuphfWidgetProps) {
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState("");

  const widgetBaseUrl = useMemo(
    () => (import.meta.env.VITE_WUPHF_WIDGET_BASE_URL?.trim() || inferWidgetBaseUrl()).replace(/\/$/, ""),
    []
  );

  useEffect(() => {
    let active = true;

    ensureWidgetScript(widgetBaseUrl)
      .then(() => {
        if (active) {
          setIsReady(true);
          setLoadError("");
        }
      })
      .catch((error) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : "Unable to initialize notifications widget");
        }
      });

    return () => {
      active = false;
    };
  }, [widgetBaseUrl]);

  if (loadError) {
    return <p className="meta">Notifications unavailable: {loadError}</p>;
  }

  if (!isReady) {
    return <p className="meta">Loading notifications...</p>;
  }

  return createElement(WUPHF_TAG, {
    "gateway-base-url": gatewayBaseUrl,
    "poll-interval-ms": "4000",
    "return-to": returnTo,
    "data-testid": "wuphf-widget-host"
  });
}
