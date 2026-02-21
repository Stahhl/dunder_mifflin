import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AuthMeResponse,
  ClientSummary,
  CreateLeadRequest,
  CreateOrderRequest,
  LeadStatus,
  LeadSummary,
  OrderSummary,
  OrderTimelineEvent,
  OrderTimelineResponse,
  buildGatewayLoginUrl,
  buildGatewayUrl,
  convertLead,
  createLead,
  createOrder,
  fetchAuthMe,
  fetchTimeline,
  listClients,
  listLeads,
  listOrders,
  openTimelineStream,
  updateLead
} from "../shared/api";
import { WuphfWidget } from "../shared/WuphfWidget";

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

interface LeadFormState {
  companyName: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  notes: string;
}

type LeadFilterState = "ALL" | LeadStatus;

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

function syncOrderIdQuery(orderId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (orderId.trim()) {
    url.searchParams.set("orderId", orderId.trim());
  } else {
    url.searchParams.delete("orderId");
  }

  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}

const leadStatuses: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "DISQUALIFIED", "CONVERTED"];

export function App() {
  if (typeof window !== "undefined") {
    const forceError = new URLSearchParams(window.location.search).get("__e2e_force_error__");
    if (forceError === "1") {
      throw new Error("Forced Infinity render failure for reliability test.");
    }
  }

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

  const [leadForm, setLeadForm] = useState<LeadFormState>({
    companyName: "",
    contactName: "",
    contactEmail: "",
    phone: "",
    notes: ""
  });
  const [leadFilter, setLeadFilter] = useState<LeadFilterState>("ALL");
  const [leadItems, setLeadItems] = useState<LeadSummary[]>([]);
  const [leadMetaText, setLeadMetaText] = useState("Loading...");
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadError, setLeadError] = useState("");
  const [leadSuccess, setLeadSuccess] = useState("");

  const [clientItems, setClientItems] = useState<ClientSummary[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");

  const timelineStreamRef = useRef<EventSource | null>(null);

  const loginUrl = useMemo(() => buildGatewayLoginUrl("/infinity"), []);

  const clientMap = useMemo(() => {
    const entries = clientItems.map((entry) => [entry.clientId, entry] as const);
    return new Map(entries);
  }, [clientItems]);

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
      syncOrderIdQuery("");
      return;
    }

    const payload = await fetchTimeline(trimmedOrderId);
    setSelectedTimelineOrderId(payload.orderId);
    setTimelineInput(payload.orderId);
    setTimelineEvents(payload.events ?? []);
    setTimelineMetaText(timelineMeta(payload.orderId, payload.events ?? []));
    syncOrderIdQuery(payload.orderId);
  }, []);

  const loadLeads = useCallback(async (statusFilter: LeadFilterState) => {
    const queryStatus = statusFilter === "ALL" ? undefined : statusFilter;
    const payload = await listLeads(queryStatus);
    setLeadItems(payload.items ?? []);
    setLeadMetaText(
      `Showing ${payload.total ?? payload.items?.length ?? 0} lead(s)${queryStatus ? ` with status ${queryStatus}` : ""}`
    );
  }, []);

  const loadClients = useCallback(async () => {
    const payload = await listClients();
    setClientItems(payload.items ?? []);
  }, []);

  useEffect(() => {
    if (!selectedClientId) {
      return;
    }

    setForm((previous) => ({ ...previous, clientId: selectedClientId }));
  }, [selectedClientId, clientMap]);

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
        await Promise.all([loadHistory(""), loadLeads("ALL"), loadClients()]);

        const deepLinkedOrderId = new URLSearchParams(window.location.search).get("orderId")?.trim();
        if (deepLinkedOrderId) {
          await loadTimeline(deepLinkedOrderId);
        }
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
  }, [loadHistory, loadLeads, loadClients, loadTimeline]);

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

  const submitLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLeadError("");
    setLeadSuccess("");

    const payload: CreateLeadRequest = {
      companyName: leadForm.companyName.trim(),
      contactName: leadForm.contactName.trim(),
      contactEmail: leadForm.contactEmail.trim(),
      phone: leadForm.phone.trim(),
      notes: leadForm.notes.trim()
    };

    setLeadSubmitting(true);
    try {
      const created = await createLead(payload);
      setLeadSuccess(`Lead ${created.leadId} created with status ${created.status}.`);
      setLeadForm({ companyName: "", contactName: "", contactEmail: "", phone: "", notes: "" });
      await loadLeads(leadFilter);
    } catch (error) {
      setLeadError(error instanceof Error ? error.message : "Lead creation failed");
    } finally {
      setLeadSubmitting(false);
    }
  };

  const qualifyLead = async (leadId: string) => {
    setLeadError("");
    setLeadSuccess("");

    try {
      const updated = await updateLead(leadId, { status: "QUALIFIED", notes: "Qualified for conversion" });
      setLeadSuccess(`Lead ${updated.leadId} updated to ${updated.status}.`);
      await loadLeads(leadFilter);
    } catch (error) {
      setLeadError(error instanceof Error ? error.message : "Unable to update lead");
    }
  };

  const convertLeadToClient = async (leadId: string) => {
    setLeadError("");
    setLeadSuccess("");

    try {
      const converted = await convertLead(leadId);
      const conversionText = converted.alreadyConverted
        ? `Lead ${converted.leadId} was already converted (client ${converted.clientId}).`
        : `Lead ${converted.leadId} converted to client ${converted.clientId}.`;
      setLeadSuccess(conversionText);
      setForm((previous) => ({ ...previous, clientId: converted.clientId }));
      setSelectedClientId(converted.clientId);
      await Promise.all([loadLeads(leadFilter), loadClients()]);
    } catch (error) {
      setLeadError(error instanceof Error ? error.message : "Unable to convert lead");
    }
  };

  if (session.status === "loading") {
    return <main className="wrap"><p>Loading Infinity workspace...</p></main>;
  }

  if (session.status === "error") {
    return (
      <main className="wrap">
        <h1>Infinity Sales App (PR11)</h1>
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
        <h1>Infinity Sales App (PR11)</h1>
        <section className="panel">
          <h2>Sign In</h2>
          <p>Sign in to continue to order placement and CRM workflows.</p>
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
        <h1>Infinity Sales App (PR11)</h1>
        <p className="alert alert-error">Your account does not have permission to access Infinity Sales.</p>
        <p>
          <a className="inline-link" href={buildGatewayUrl("/")}>Return to gateway home</a>
        </p>
      </main>
    );
  }

  return (
    <main className="wrap">
      <section className="widget-row">
        <WuphfWidget returnTo="/infinity" />
      </section>
      <h1>Infinity Sales App (PR11)</h1>
      <p>
        Welcome, <strong>{session.user.displayName}</strong>. Roles: {session.user.roles.join(", ")}
      </p>

      <section className="panel">
        <h2>Sales CRM Leads</h2>
        <form id="lead-form" onSubmit={submitLead} noValidate>
          <div className="row">
            <div>
              <label htmlFor="lead-company-name">Company name</label>
              <input
                id="lead-company-name"
                value={leadForm.companyName}
                onChange={(event) => setLeadForm((previous) => ({ ...previous, companyName: event.target.value }))}
                required
              />
            </div>
            <div>
              <label htmlFor="lead-contact-name">Contact name</label>
              <input
                id="lead-contact-name"
                value={leadForm.contactName}
                onChange={(event) => setLeadForm((previous) => ({ ...previous, contactName: event.target.value }))}
                required
              />
            </div>
          </div>

          <div className="row mt-12">
            <div>
              <label htmlFor="lead-contact-email">Contact email</label>
              <input
                id="lead-contact-email"
                type="email"
                value={leadForm.contactEmail}
                onChange={(event) => setLeadForm((previous) => ({ ...previous, contactEmail: event.target.value }))}
                required
              />
            </div>
            <div>
              <label htmlFor="lead-phone">Phone</label>
              <input
                id="lead-phone"
                value={leadForm.phone}
                onChange={(event) => setLeadForm((previous) => ({ ...previous, phone: event.target.value }))}
                required
              />
            </div>
          </div>

          <div className="mt-12">
            <label htmlFor="lead-notes">Lead notes</label>
            <textarea
              id="lead-notes"
              value={leadForm.notes}
              onChange={(event) => setLeadForm((previous) => ({ ...previous, notes: event.target.value }))}
              placeholder="Lead source, discovery notes, expected deal size"
            />
          </div>

          <div className="mt-12">
            <button id="create-lead-btn" type="submit" disabled={leadSubmitting}>
              {leadSubmitting ? "Creating..." : "Create Lead"}
            </button>
          </div>

          <div id="crm-error" className={`alert alert-error ${leadError ? "" : "hidden"}`} role="alert">
            {leadError}
          </div>

          <div id="crm-success" className={`alert alert-success ${leadSuccess ? "" : "hidden"}`}>
            {leadSuccess}
          </div>
        </form>

        <div className="row mt-12">
          <div>
            <label htmlFor="lead-status-filter">Filter leads by status</label>
            <select
              id="lead-status-filter"
              value={leadFilter}
              onChange={(event) => setLeadFilter(event.target.value as LeadFilterState)}
            >
              <option value="ALL">ALL</option>
              {leadStatuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="align-end">
            <button
              id="refresh-leads-btn"
              type="button"
              onClick={() => {
                setLeadError("");
                setLeadSuccess("");
                loadLeads(leadFilter).catch((error) => {
                  setLeadError(error instanceof Error ? error.message : "Unable to load leads");
                });
              }}
            >
              Refresh Leads
            </button>
          </div>
        </div>

        <p id="lead-meta" className="meta">{leadMetaText}</p>

        <table>
          <thead>
            <tr>
              <th>Lead ID</th>
              <th>Company</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Client</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="leads-body">
            {leadItems.map((lead) => (
              <tr key={lead.leadId}>
                <td>{lead.leadId}</td>
                <td>{lead.companyName}</td>
                <td>{lead.contactName}</td>
                <td>{lead.status}</td>
                <td>{lead.convertedClientId ?? "-"}</td>
                <td className="lead-actions-cell">
                  <button
                    type="button"
                    className="inline-action"
                    disabled={lead.status === "QUALIFIED" || lead.status === "CONVERTED"}
                    onClick={() => {
                      qualifyLead(lead.leadId).catch((error) => {
                        setLeadError(error instanceof Error ? error.message : "Unable to update lead");
                      });
                    }}
                  >
                    Set QUALIFIED
                  </button>
                  <button
                    type="button"
                    className="inline-action"
                    disabled={lead.status !== "QUALIFIED" && lead.status !== "CONVERTED"}
                    onClick={() => {
                      convertLeadToClient(lead.leadId).catch((error) => {
                        setLeadError(error instanceof Error ? error.message : "Unable to convert lead");
                      });
                    }}
                  >
                    Convert
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Place Paper Order</h2>
        <form id="order-form" onSubmit={submitForm} noValidate>
          <div className="row">
            <div>
              <label htmlFor="crm-client-select">Converted clients</label>
              <select
                id="crm-client-select"
                value={selectedClientId}
                onChange={(event) => {
                  const nextClientId = event.target.value;
                  setSelectedClientId(nextClientId);
                  if (!nextClientId) {
                    setForm((previous) => ({ ...previous, clientId: "" }));
                  }
                }}
              >
                <option value="">Manual entry</option>
                {clientItems.map((client) => (
                  <option key={client.clientId} value={client.clientId}>
                    {client.clientId} - {client.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="clientId">Client ID</label>
              <input
                id="clientId"
                name="clientId"
                value={form.clientId}
                onChange={(event) => {
                  setSelectedClientId("");
                  setForm((previous) => ({ ...previous, clientId: event.target.value }));
                }}
                required
              />
            </div>
          </div>

          <div className="row mt-12">
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
          </div>

          <div className="row mt-12">
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
            <div>
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={form.notes}
                onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
                placeholder="Loading dock closes at 5 PM"
              />
            </div>
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
