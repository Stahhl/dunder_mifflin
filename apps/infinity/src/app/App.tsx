import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AuthMeResponse,
  CreateOrderRequest,
  OrderSummary,
  OrderTimelineEvent,
  OrderTimelineResponse,
  buildGatewayLoginUrl,
  buildGatewayUrl,
  createOrder,
  fetchAuthMe,
  fetchTimeline,
  listOrders,
  openTimelineStream
} from "../shared/api";

type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "forbidden"; user: AuthMeResponse }
  | { status: "ready"; user: AuthMeResponse }
  | { status: "error"; message: string };

interface FormState {
  clientId: string;
  requestedShipDate: string;
  sku: string;
  quantity: string;
  notes: string;
}

function tomorrowAsIsoDate(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return tomorrow.toISOString().slice(0, 10);
}

function canAccessInfinity(roles: readonly string[]): boolean {
  return roles.includes("manager") || roles.includes("sales-associate");
}

function parseTimelinePayload(raw: string): OrderTimelineResponse | null {
  try {
    const payload = JSON.parse(raw) as OrderTimelineResponse;
    if (!payload || !Array.isArray(payload.events) || typeof payload.orderId !== "string") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function timelineMeta(orderId: string, events: readonly OrderTimelineEvent[]): string {
  if (events.length === 0) {
    return `No timeline events recorded for ${orderId}.`;
  }

  return `Showing ${events.length} timeline event(s) for ${orderId}.`;
}

export function App() {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [form, setForm] = useState<FormState>({
    clientId: "client_501",
    requestedShipDate: tomorrowAsIsoDate(),
    sku: "PPR-A4-WHT-500",
    quantity: "10",
    notes: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState("");

  const [historyFilter, setHistoryFilter] = useState("");
  const [historyItems, setHistoryItems] = useState<OrderSummary[]>([]);
  const [historyMetaText, setHistoryMetaText] = useState("Loading...");

  const [selectedTimelineOrderId, setSelectedTimelineOrderId] = useState("");
  const [timelineInput, setTimelineInput] = useState("");
  const [timelineEvents, setTimelineEvents] = useState<OrderTimelineEvent[]>([]);
  const [timelineMetaText, setTimelineMetaText] = useState("Enter an order ID to inspect timeline events.");

  const timelineStreamRef = useRef<EventSource | null>(null);

  const loginUrl = useMemo(() => buildGatewayLoginUrl("/infinity"), []);

  const loadHistory = useCallback(
    async (clientId: string) => {
      const trimmed = clientId.trim();
      const payload = await listOrders(trimmed);
      setHistoryItems(payload.items ?? []);
      setHistoryMetaText(
        `Showing ${payload.total ?? payload.items?.length ?? 0} order(s)${trimmed ? ` for ${trimmed}` : ""}`
      );
    },
    [setHistoryItems]
  );

  const loadTimeline = useCallback(async (orderId: string) => {
    const trimmedOrderId = orderId.trim();
    if (!trimmedOrderId) {
      setTimelineEvents([]);
      setTimelineMetaText("Enter an order ID to inspect timeline events.");
      return;
    }

    const payload = await fetchTimeline(trimmedOrderId);
    setSelectedTimelineOrderId(payload.orderId);
    setTimelineInput(payload.orderId);
    setTimelineEvents(payload.events ?? []);
    setTimelineMetaText(timelineMeta(payload.orderId, payload.events ?? []));
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const auth = await fetchAuthMe();
        if (!active) {
          return;
        }

        if (!auth) {
          setSession({ status: "signed-out" });
          return;
        }

        if (!canAccessInfinity(auth.roles)) {
          setSession({ status: "forbidden", user: auth });
          return;
        }

        setSession({ status: "ready", user: auth });
        await loadHistory("");
      } catch (error) {
        if (!active) {
          return;
        }

        setSession({
          status: "error",
          message: error instanceof Error ? error.message : "Unable to initialize Infinity app"
        });
      }
    };

    bootstrap().catch(() => {
      if (active) {
        setSession({ status: "error", message: "Unable to initialize Infinity app" });
      }
    });

    return () => {
      active = false;
    };
  }, [loadHistory]);

  useEffect(() => {
    timelineStreamRef.current?.close();
    timelineStreamRef.current = null;

    if (session.status !== "ready" || !selectedTimelineOrderId) {
      return;
    }

    const stream = openTimelineStream(selectedTimelineOrderId);
    timelineStreamRef.current = stream;

    const handleTimelineEvent = (data: string) => {
      const payload = parseTimelinePayload(data);
      if (!payload) {
        return;
      }

      setSelectedTimelineOrderId(payload.orderId);
      setTimelineInput(payload.orderId);
      setTimelineEvents(payload.events ?? []);
      setTimelineMetaText(timelineMeta(payload.orderId, payload.events ?? []));
    };

    stream.addEventListener("timeline", (event) => {
      const timelineEvent = event as MessageEvent<string>;
      handleTimelineEvent(timelineEvent.data);
    });

    stream.addEventListener("error", () => {
      setTimelineMetaText((previous) => `${previous} Live stream disconnected; refresh to reconnect.`.trim());
    });

    return () => {
      stream.close();
      if (timelineStreamRef.current === stream) {
        timelineStreamRef.current = null;
      }
    };
  }, [session, selectedTimelineOrderId]);

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError([]);
    setSuccessMessage("");

    const errors: string[] = [];
    const parsedQuantity = Number.parseInt(form.quantity, 10);

    if (!form.clientId.trim()) {
      errors.push("Client ID is required");
    }
    if (!form.sku.trim()) {
      errors.push("Product SKU is required");
    }
    if (!form.requestedShipDate.trim()) {
      errors.push("Requested ship date is required");
    }
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      errors.push("Quantity must be a whole number greater than 0");
    }

    if (errors.length > 0) {
      setFormError(errors);
      return;
    }

    const payload: CreateOrderRequest = {
      clientId: form.clientId.trim(),
      requestedShipDate: form.requestedShipDate,
      items: [{ sku: form.sku.trim(), quantity: parsedQuantity }],
      notes: form.notes
    };

    setSubmitting(true);
    try {
      const created = await createOrder(payload);
      setSuccessMessage(`Order ${created.orderId} created with status ${created.status}.`);
      setHistoryFilter(payload.clientId);
      await loadHistory(payload.clientId);
      await loadTimeline(created.orderId);
    } catch (error) {
      setFormError([error instanceof Error ? error.message : "Order submission failed"]);
    } finally {
      setSubmitting(false);
    }
  };

  if (session.status === "loading") {
    return <main className="wrap"><p>Loading Infinity workspace...</p></main>;
  }

  if (session.status === "error") {
    return (
      <main className="wrap">
        <h1>Infinity Sales App (PR5)</h1>
        <p className="alert alert-error">{session.message}</p>
        <p>
          <a className="inline-link" href={buildGatewayUrl("/")}>Return to gateway home</a>
        </p>
      </main>
    );
  }

  if (session.status === "signed-out") {
    return (
      <main className="wrap">
        <h1>Infinity Sales App (PR5)</h1>
        <section className="panel">
          <h2>Sign In</h2>
          <p>Sign in to continue to order placement and timeline tracking.</p>
          <p>
            <a id="infinity-sign-in-btn" className="button" href={loginUrl}>
              Sign in with Keycloak
            </a>
          </p>
        </section>
      </main>
    );
  }

  if (session.status === "forbidden") {
    return (
      <main className="wrap">
        <h1>Infinity Sales App (PR5)</h1>
        <p className="alert alert-error">Your account does not have permission to access Infinity Sales.</p>
        <p>
          <a className="inline-link" href={buildGatewayUrl("/")}>Return to gateway home</a>
        </p>
      </main>
    );
  }

  return (
    <main className="wrap">
      <h1>Infinity Sales App (PR5)</h1>
      <p>
        Welcome, <strong>{session.user.displayName}</strong>. Roles: {session.user.roles.join(", ")}
      </p>

      <section className="panel">
        <h2>Place Paper Order</h2>
        <form id="order-form" onSubmit={submitForm} noValidate>
          <div className="row">
            <div>
              <label htmlFor="clientId">Client ID</label>
              <input
                id="clientId"
                name="clientId"
                value={form.clientId}
                onChange={(event) => setForm((previous) => ({ ...previous, clientId: event.target.value }))}
                required
              />
            </div>
            <div>
              <label htmlFor="requestedShipDate">Requested ship date</label>
              <input
                id="requestedShipDate"
                name="requestedShipDate"
                type="date"
                value={form.requestedShipDate}
                onChange={(event) => setForm((previous) => ({ ...previous, requestedShipDate: event.target.value }))}
                required
              />
            </div>
          </div>

          <div className="row mt-12">
            <div>
              <label htmlFor="sku">Product SKU</label>
              <input
                id="sku"
                name="sku"
                value={form.sku}
                onChange={(event) => setForm((previous) => ({ ...previous, sku: event.target.value }))}
                required
              />
            </div>
            <div>
              <label htmlFor="quantity">Quantity</label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min={1}
                step={1}
                value={form.quantity}
                onChange={(event) => setForm((previous) => ({ ...previous, quantity: event.target.value }))}
                required
              />
            </div>
          </div>

          <div className="mt-12">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={form.notes}
              onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
              placeholder="Loading dock closes at 5 PM"
            />
          </div>

          <div className="mt-12">
            <button id="place-order-btn" type="submit" disabled={submitting}>
              {submitting ? "Placing..." : "Place Order"}
            </button>
          </div>

          <div id="form-error" className={`alert alert-error ${formError.length > 0 ? "" : "hidden"}`} role="alert">
            {formError.length > 0 ? (
              <>
                <strong>Fix these fields:</strong>
                <ul>
                  {formError.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          <div id="order-success" className={`alert alert-success ${successMessage ? "" : "hidden"}`}>
            {successMessage}
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Order History</h2>
        <div className="row">
          <div>
            <label htmlFor="history-client-id">Filter by client ID</label>
            <input
              id="history-client-id"
              name="history-client-id"
              placeholder="client_501"
              value={historyFilter}
              onChange={(event) => setHistoryFilter(event.target.value)}
            />
          </div>
          <div className="align-end">
            <button
              id="refresh-history-btn"
              type="button"
              onClick={() => {
                setFormError([]);
                setSuccessMessage("");
                loadHistory(historyFilter).catch((error) => {
                  setFormError([error instanceof Error ? error.message : "Unable to refresh order history"]);
                });
              }}
            >
              Refresh History
            </button>
          </div>
        </div>

        <p className="meta" id="history-meta">{historyMetaText}</p>

        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Client</th>
              <th>Status</th>
              <th>Requested Ship Date</th>
              <th>Created At (UTC)</th>
              <th>Timeline</th>
            </tr>
          </thead>
          <tbody id="history-body">
            {historyItems.map((item) => (
              <tr key={item.orderId}>
                <td>{item.orderId}</td>
                <td>{item.clientId}</td>
                <td>{item.status}</td>
                <td>{item.requestedShipDate}</td>
                <td>{item.createdAt}</td>
                <td>
                  <button
                    type="button"
                    className="timeline-link"
                    data-order-id={item.orderId}
                    onClick={() => {
                      loadTimeline(item.orderId).catch((error) => {
                        setFormError([error instanceof Error ? error.message : "Unable to load order timeline"]);
                      });
                    }}
                  >
                    View Timeline
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Order Timeline</h2>
        <div className="row">
          <div>
            <label htmlFor="timeline-order-id">Order ID</label>
            <input
              id="timeline-order-id"
              value={timelineInput}
              onChange={(event) => setTimelineInput(event.target.value)}
              placeholder="ord_1234"
            />
          </div>
          <div className="align-end">
            <button
              id="load-timeline-btn"
              type="button"
              onClick={() => {
                loadTimeline(timelineInput).catch((error) => {
                  setFormError([error instanceof Error ? error.message : "Unable to load order timeline"]);
                });
              }}
            >
              Load Timeline
            </button>
          </div>
        </div>
        <p className="meta" id="timeline-meta">{timelineMetaText}</p>
        <ul id="timeline-list" className="timeline-list">
          {timelineEvents.map((event, index) => (
            <li key={`${event.status}-${event.at}-${index}`}>
              <strong>{event.status}</strong>
              <span>{event.at}</span>
              <span>{event.source}</span>
            </li>
          ))}
        </ul>
      </section>

      <p>
        <a className="inline-link" href={buildGatewayUrl("/")}>Back to gateway home</a>
        <span> · </span>
        <a className="inline-link" href={buildGatewayUrl("/logout")}>Sign out</a>
      </p>
    </main>
  );
}
