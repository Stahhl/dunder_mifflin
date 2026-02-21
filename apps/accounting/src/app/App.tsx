import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AuthMeResponse,
  CreateExpenseRequest,
  Expense,
  ExpenseDecisionRequest,
  ExpenseStatus,
  buildGatewayLoginUrl,
  buildGatewayUrl,
  createExpense,
  decideExpense,
  fetchAuthMe,
  listExpenses
} from "../shared/api";
import { WuphfWidget } from "../shared/WuphfWidget";

type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "forbidden"; user: AuthMeResponse }
  | { status: "ready"; user: AuthMeResponse }
  | { status: "error"; message: string };

interface ExpenseFormState {
  submitterUserId: string;
  category: string;
  amount: string;
  currency: string;
  description: string;
  receiptUrl: string;
}

function canAccessAccounting(roles: readonly string[]): boolean {
  return roles.includes("accountant") || roles.includes("manager");
}

function defaultExpenseForm(userId: string): ExpenseFormState {
  return {
    submitterUserId: userId,
    category: "OFFICE_SUPPLIES",
    amount: "129.95",
    currency: "USD",
    description: "Core Blaster Extreme",
    receiptUrl: "https://example.invalid/receipt/123"
  };
}

function syncExpenseIdQuery(expenseId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (expenseId.trim()) {
    url.searchParams.set("expenseId", expenseId.trim());
  } else {
    url.searchParams.delete("expenseId");
  }

  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}

export function App() {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "ALL">("PENDING");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedExpenseId, setSelectedExpenseId] = useState("");
  const [loadingExpenses, setLoadingExpenses] = useState(false);

  const [form, setForm] = useState<ExpenseFormState>(defaultExpenseForm("amartin"));
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [decisionComment, setDecisionComment] = useState("Approved for reimbursement");

  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");

  const loginUrl = useMemo(() => buildGatewayLoginUrl("/accounting"), []);
  const selectedExpense = expenses.find((item) => item.expenseId === selectedExpenseId) ?? null;

  const refreshExpenses = useCallback(
    async (filter: ExpenseStatus | "ALL") => {
      setLoadingExpenses(true);
      try {
        const payload = await listExpenses(filter);
        setExpenses(payload.items ?? []);

        if (payload.items?.some((item) => item.expenseId === selectedExpenseId)) {
          // keep current selection when possible
        } else if ((payload.items ?? []).length > 0) {
          setSelectedExpenseId(payload.items[0].expenseId);
        } else {
          setSelectedExpenseId("");
        }
      } finally {
        setLoadingExpenses(false);
      }
    },
    [selectedExpenseId]
  );

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

        if (!canAccessAccounting(auth.roles)) {
          setSession({ status: "forbidden", user: auth });
          return;
        }

        setSession({ status: "ready", user: auth });
        setForm(defaultExpenseForm(auth.userId));

        const deepLinkedExpenseId = new URLSearchParams(window.location.search).get("expenseId")?.trim();
        if (deepLinkedExpenseId) {
          setStatusFilter("ALL");
          await refreshExpenses("ALL");
          setSelectedExpenseId(deepLinkedExpenseId);
          syncExpenseIdQuery(deepLinkedExpenseId);
        } else {
          await refreshExpenses("PENDING");
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setSession({
          status: "error",
          message: error instanceof Error ? error.message : "Unable to initialize accounting app"
        });
      }
    };

    bootstrap().catch(() => {
      if (active) {
        setSession({ status: "error", message: "Unable to initialize accounting app" });
      }
    });

    return () => {
      active = false;
    };
  }, [refreshExpenses]);

  const handleCreateExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setNoticeMessage("");

    const amount = Number.parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Amount must be greater than 0.");
      return;
    }

    const payload: CreateExpenseRequest = {
      submitterUserId: form.submitterUserId.trim(),
      category: form.category.trim(),
      amount,
      currency: form.currency.trim().toUpperCase(),
      description: form.description.trim(),
      receiptUrl: form.receiptUrl.trim()
    };

    try {
      const created = await createExpense(payload);
      setNoticeMessage(`Expense ${created.expenseId} created with status ${created.status}.`);
      setStatusFilter("PENDING");
      await refreshExpenses("PENDING");
      setSelectedExpenseId(created.expenseId);
      syncExpenseIdQuery(created.expenseId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create expense");
    }
  };

  const handleDecision = async () => {
    if (!selectedExpense) {
      setErrorMessage("Select an expense before applying a decision.");
      return;
    }

    if (selectedExpense.status !== "PENDING") {
      setErrorMessage(`Expense ${selectedExpense.expenseId} is already ${selectedExpense.status}.`);
      return;
    }

    if (decision === "REJECTED" && !decisionComment.trim()) {
      setErrorMessage("Comment is required when rejecting an expense.");
      return;
    }

    setErrorMessage("");
    setNoticeMessage("");

    const payload: ExpenseDecisionRequest = {
      decision,
      comment: decisionComment
    };

    try {
      const updated = await decideExpense(selectedExpense.expenseId, payload);
      setNoticeMessage(`Expense ${updated.expenseId} updated to ${updated.status}.`);
      await refreshExpenses(statusFilter);
      setSelectedExpenseId(updated.expenseId);
      syncExpenseIdQuery(updated.expenseId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to apply expense decision");
    }
  };

  if (session.status === "loading") {
    return <main className="wrap"><p>Loading Accounting Suite...</p></main>;
  }

  if (session.status === "error") {
    return (
      <main className="wrap">
        <h1>Accounting Suite (PR6)</h1>
        <p className="alert alert-error">{session.message}</p>
      </main>
    );
  }

  if (session.status === "signed-out") {
    return (
      <main className="wrap">
        <h1>Accounting Suite (PR6)</h1>
        <section className="panel">
          <h2>Sign In</h2>
          <p>Sign in with your accounting credentials to review expense decisions.</p>
          <p>
            <a id="accounting-sign-in-btn" className="button" href={loginUrl}>
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
        <h1>Accounting Suite (PR6)</h1>
        <p className="alert alert-error">Your account does not have permission to access accounting workflows.</p>
      </main>
    );
  }

  return (
    <main className="wrap">
      <section className="widget-row">
        <WuphfWidget returnTo="/accounting" />
      </section>
      <h1>Accounting Suite (PR6)</h1>
      <p>
        Welcome, <strong>{session.user.displayName}</strong>. Roles: {session.user.roles.join(", ")}
      </p>

      <section className="panel">
        <h2>Create Expense</h2>
        <form id="accounting-create-form" onSubmit={handleCreateExpense}>
          <div className="row">
            <div>
              <label htmlFor="submitterUserId">Submitter User ID</label>
              <input
                id="submitterUserId"
                value={form.submitterUserId}
                onChange={(event) => setForm((previous) => ({ ...previous, submitterUserId: event.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="category">Category</label>
              <input
                id="category"
                value={form.category}
                onChange={(event) => setForm((previous) => ({ ...previous, category: event.target.value }))}
              />
            </div>
          </div>

          <div className="row mt-12">
            <div>
              <label htmlFor="amount">Amount</label>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={(event) => setForm((previous) => ({ ...previous, amount: event.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="currency">Currency</label>
              <input
                id="currency"
                value={form.currency}
                onChange={(event) => setForm((previous) => ({ ...previous, currency: event.target.value }))}
              />
            </div>
          </div>

          <div className="mt-12">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={form.description}
              onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
            />
          </div>

          <div className="mt-12">
            <label htmlFor="receiptUrl">Receipt URL</label>
            <input
              id="receiptUrl"
              value={form.receiptUrl}
              onChange={(event) => setForm((previous) => ({ ...previous, receiptUrl: event.target.value }))}
            />
          </div>

          <div className="mt-12">
            <button id="accounting-create-btn" data-testid="accounting-create-btn" type="submit">
              Create Expense
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Expense Queue</h2>
        <div className="row">
          <div>
            <label htmlFor="accounting-filter-status">Filter by status</label>
            <select
              id="accounting-filter-status"
              data-testid="accounting-filter-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ExpenseStatus | "ALL")}
            >
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="ALL">ALL</option>
            </select>
          </div>
          <div className="align-end">
            <button
              id="accounting-refresh-btn"
              data-testid="accounting-refresh-btn"
              type="button"
              onClick={() => {
                setErrorMessage("");
                setNoticeMessage("");
                refreshExpenses(statusFilter).catch((error) => {
                  setErrorMessage(error instanceof Error ? error.message : "Unable to refresh expense queue");
                });
              }}
            >
              {loadingExpenses ? "Refreshing..." : "Refresh Queue"}
            </button>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Expense ID</th>
              <th>Submitter</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="accounting-table-body" data-testid="accounting-table-body">
            {expenses.map((expense) => (
              <tr key={expense.expenseId} data-expense-id={expense.expenseId}>
                <td>{expense.expenseId}</td>
                <td>{expense.submitterUserId}</td>
                <td>{expense.category}</td>
                <td>{expense.currency} {Number(expense.amount).toFixed(2)}</td>
                <td>{expense.status}</td>
                <td>
                  <button
                    type="button"
                    data-testid={`accounting-select-${expense.expenseId}`}
                    onClick={() => {
                      setSelectedExpenseId(expense.expenseId);
                      syncExpenseIdQuery(expense.expenseId);
                    }}
                  >
                    Select
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Decision Panel</h2>
        <p id="accounting-selected-id" data-testid="accounting-selected-id">
          {selectedExpense ? `Selected: ${selectedExpense.expenseId}` : "Select an expense from the queue."}
        </p>
        <div className="row">
          <div>
            <label htmlFor="accounting-decision">Decision</label>
            <select
              id="accounting-decision"
              data-testid="accounting-decision"
              value={decision}
              onChange={(event) => setDecision(event.target.value as "APPROVED" | "REJECTED")}
            >
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
          <div>
            <label htmlFor="accounting-comment">Comment</label>
            <input
              id="accounting-comment"
              data-testid="accounting-comment"
              value={decisionComment}
              onChange={(event) => setDecisionComment(event.target.value)}
            />
          </div>
        </div>

        <div className="mt-12">
          <button
            id="accounting-submit-decision"
            data-testid="accounting-submit-decision"
            type="button"
            onClick={() => {
              handleDecision().catch((error) => {
                setErrorMessage(error instanceof Error ? error.message : "Unable to apply expense decision");
              });
            }}
          >
            Submit Decision
          </button>
        </div>
      </section>

      <p id="accounting-notice" data-testid="accounting-notice" className={`alert alert-success ${noticeMessage ? "" : "hidden"}`}>
        {noticeMessage}
      </p>
      <p id="accounting-error" data-testid="accounting-error" className={`alert alert-error ${errorMessage ? "" : "hidden"}`}>
        {errorMessage}
      </p>

      <p>
        <a className="inline-link" href={buildGatewayUrl("/")}>Back to gateway home</a>
        <span> · </span>
        <a className="inline-link" href={buildGatewayUrl("/logout")}>Sign out</a>
      </p>
    </main>
  );
}
