type NotificationItem = {
  notificationId: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  deepLink: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
};

type NotificationListResponse = {
  items: NotificationItem[];
  total: number;
  unreadCount?: number;
};

const TAG_NAME = "dunder-wuphf-widget";
const DEFAULT_POLL_INTERVAL_MS = 5_000;

function randomHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("").slice(0, length);
}

function applyTraceHeaders(headersInit?: HeadersInit): Headers {
  const headers = new Headers(headersInit);
  const traceId = randomHex(32);
  const spanId = randomHex(16);

  if (!headers.has("traceparent")) {
    headers.set("traceparent", `00-${traceId}-${spanId}-01`);
  }
  if (!headers.has("X-Trace-Id")) {
    headers.set("X-Trace-Id", traceId);
  }
  if (!headers.has("X-Request-Id")) {
    headers.set("X-Request-Id", `req_${Date.now()}_${randomHex(8)}`);
  }

  return headers;
}

function inferGatewayBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8081`;
  }

  return "http://localhost:8081";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

class DunderWuphfWidget extends HTMLElement {
  private notifications: NotificationItem[] = [];
  private unreadCount = 0;
  private open = false;
  private loading = false;
  private errorMessage = "";
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  connectedCallback() {
    this.classList.add("dunder-wuphf-widget-host");
    this.startPolling();
  }

  disconnectedCallback() {
    this.stopPolling();
  }

  static get observedAttributes(): string[] {
    return ["gateway-base-url", "poll-interval-ms"];
  }

  attributeChangedCallback() {
    this.stopPolling();
    this.startPolling();
  }

  private startPolling() {
    this.refresh().catch(() => {
      // error state handled inside refresh
    });

    this.pollTimer = setInterval(() => {
      this.refresh().catch(() => {
        // error state handled inside refresh
      });
    }, this.pollIntervalMs());
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private pollIntervalMs(): number {
    const raw = this.getAttribute("poll-interval-ms")?.trim();
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    if (Number.isInteger(parsed) && parsed >= 2_000) {
      return parsed;
    }
    return DEFAULT_POLL_INTERVAL_MS;
  }

  private gatewayBaseUrl(): string {
    const raw = this.getAttribute("gateway-base-url")?.trim();
    return (raw && raw.length > 0 ? raw : inferGatewayBaseUrl()).replace(/\/$/, "");
  }

  private async refresh(): Promise<void> {
    this.loading = true;
    this.render();

    try {
      const response = await fetch(`${this.gatewayBaseUrl()}/api/v1/notifications`, {
        method: "GET",
        credentials: "include",
        headers: applyTraceHeaders({
          accept: "application/json"
        })
      });

      if (response.status === 401) {
        this.notifications = [];
        this.unreadCount = 0;
        this.errorMessage = "Sign in to load notifications.";
        this.loading = false;
        this.render();
        return;
      }

      if (!response.ok) {
        throw new Error(`Notification request failed (${response.status})`);
      }

      const payload = (await response.json()) as NotificationListResponse;
      this.notifications = payload.items ?? [];
      this.unreadCount = typeof payload.unreadCount === "number"
        ? payload.unreadCount
        : this.notifications.filter((item) => !item.isRead).length;
      this.errorMessage = "";
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : "Unable to load notifications";
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private async markAsRead(notificationId: string): Promise<void> {
    await fetch(`${this.gatewayBaseUrl()}/api/v1/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: "POST",
      credentials: "include",
      headers: applyTraceHeaders({
        accept: "application/json"
      })
    });
  }

  private toGatewayUrl(deepLink: string): string {
    if (deepLink.startsWith("http://") || deepLink.startsWith("https://")) {
      return deepLink;
    }

    if (deepLink.startsWith("/")) {
      return `${this.gatewayBaseUrl()}${deepLink}`;
    }

    return `${this.gatewayBaseUrl()}/${deepLink}`;
  }

  private bindActions() {
    const toggle = this.querySelector<HTMLButtonElement>("[data-wuphf-action='toggle']");
    toggle?.addEventListener("click", () => {
      this.open = !this.open;
      this.render();
    });

    const refresh = this.querySelector<HTMLButtonElement>("[data-wuphf-action='refresh']");
    refresh?.addEventListener("click", () => {
      this.refresh().catch(() => {
        // error state handled inside refresh
      });
    });

    this.querySelectorAll<HTMLButtonElement>("[data-wuphf-action='open-notification']").forEach((button) => {
      button.addEventListener("click", () => {
        const notificationId = button.dataset.notificationId ?? "";
        const deepLink = button.dataset.deepLink ?? "";
        if (!notificationId || !deepLink) {
          return;
        }

        this.markAsRead(notificationId)
          .catch(() => {
            // best effort; still navigate
          })
          .finally(() => {
            this.dispatchEvent(
              new CustomEvent("wuphf:notification-click", {
                bubbles: true,
                detail: {
                  notificationId,
                  deepLink
                }
              })
            );

            window.location.assign(this.toGatewayUrl(deepLink));
          });
      });
    });
  }

  private render() {
    this.setAttribute("data-unread-count", String(this.unreadCount));

    const rows = this.notifications.map((item) => {
      const readClass = item.isRead ? "is-read" : "is-unread";
      const createdAt = item.createdAt?.replace("T", " ").replace("Z", " UTC") ?? "";

      return `
        <li class="dunder-wuphf-widget__item ${readClass}">
          <button
            type="button"
            data-wuphf-action="open-notification"
            data-notification-id="${escapeHtml(item.notificationId)}"
            data-deep-link="${escapeHtml(item.deepLink)}"
            data-testid="wuphf-item-${escapeHtml(item.notificationId)}"
          >
            <span class="dunder-wuphf-widget__item-title">${escapeHtml(item.title)}</span>
            <span class="dunder-wuphf-widget__item-body">${escapeHtml(item.body)}</span>
            <span class="dunder-wuphf-widget__item-meta">${escapeHtml(item.kind)} · ${escapeHtml(createdAt)}</span>
          </button>
        </li>
      `;
    }).join("");

    const panel = this.open
      ? `
        <section class="dunder-wuphf-widget__panel" data-testid="wuphf-panel">
          <header>
            <h3>WUPHF Notifications</h3>
            <button type="button" data-wuphf-action="refresh">Refresh</button>
          </header>
          ${this.loading ? "<p class='dunder-wuphf-widget__meta'>Loading notifications...</p>" : ""}
          ${this.errorMessage ? `<p class='dunder-wuphf-widget__error'>${escapeHtml(this.errorMessage)}</p>` : ""}
          ${!this.loading && this.notifications.length === 0 ? "<p class='dunder-wuphf-widget__meta'>No notifications yet.</p>" : ""}
          <ul class="dunder-wuphf-widget__list" data-testid="wuphf-list">${rows}</ul>
        </section>
      `
      : "";

    this.innerHTML = `
      <style>
        .dunder-wuphf-widget {
          position: relative;
          display: inline-flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
        }

        .dunder-wuphf-widget__toggle {
          border: 1px solid #2a5580;
          border-radius: 999px;
          background: #0f4b80;
          color: #fff;
          font: inherit;
          font-weight: 700;
          line-height: 1;
          padding: 0.5rem 0.8rem;
          cursor: pointer;
          width: fit-content;
        }

        .dunder-wuphf-widget__toggle:hover {
          background: #0b3d68;
        }

        .dunder-wuphf-widget__badge {
          display: inline-block;
          margin-left: 0.4rem;
          background: #fff;
          color: #0f4b80;
          border-radius: 999px;
          padding: 0.12rem 0.5rem;
          min-width: 1.6rem;
        }

        .dunder-wuphf-widget__panel {
          width: 100%;
          max-width: 520px;
          background: #ffffff;
          border: 1px solid #c0d2e2;
          border-radius: 10px;
          box-shadow: 0 10px 22px rgba(13, 37, 63, 0.15);
          padding: 0.7rem;
          z-index: 50;
        }

        .dunder-wuphf-widget__panel header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .dunder-wuphf-widget__panel h3 {
          margin: 0;
          font-size: 0.98rem;
          color: #123b5f;
        }

        .dunder-wuphf-widget__panel header button {
          border: 1px solid #9db7cd;
          border-radius: 6px;
          background: #f0f6fb;
          color: #123b5f;
          font: inherit;
          padding: 0.25rem 0.5rem;
          cursor: pointer;
        }

        .dunder-wuphf-widget__meta,
        .dunder-wuphf-widget__error {
          margin: 0.35rem 0;
          font-size: 0.9rem;
        }

        .dunder-wuphf-widget__error {
          color: #9b1c1c;
        }

        .dunder-wuphf-widget__list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.45rem;
        }

        .dunder-wuphf-widget__item button {
          width: 100%;
          text-align: left;
          border: 1px solid #d4e2ee;
          border-radius: 8px;
          background: #f9fbfe;
          color: #1e3a53;
          font: inherit;
          padding: 0.5rem 0.55rem;
          display: grid;
          gap: 0.15rem;
          cursor: pointer;
        }

        .dunder-wuphf-widget__item.is-unread button {
          border-color: #80aacd;
          background: #edf5fc;
        }

        .dunder-wuphf-widget__item-title {
          font-weight: 700;
        }

        .dunder-wuphf-widget__item-body {
          font-size: 0.9rem;
        }

        .dunder-wuphf-widget__item-meta {
          font-size: 0.78rem;
          opacity: 0.82;
        }
      </style>
      <div class="dunder-wuphf-widget" data-testid="wuphf-widget">
        <button
          type="button"
          class="dunder-wuphf-widget__toggle"
          data-wuphf-action="toggle"
          data-testid="wuphf-toggle"
          aria-expanded="${this.open ? "true" : "false"}"
        >
          WUPHF
          <span class="dunder-wuphf-widget__badge" data-testid="wuphf-unread-count">${this.unreadCount}</span>
        </button>
        ${panel}
      </div>
    `;

    this.bindActions();
  }
}

if (!customElements.get(TAG_NAME)) {
  customElements.define(TAG_NAME, DunderWuphfWidget);
}
