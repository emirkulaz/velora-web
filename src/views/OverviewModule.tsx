import { useEffect, useState } from "react";
import { BusinessPositionPanel } from "../components/BusinessPositionPanel";
import { apiGet } from "../data/api";
import { algiersYmd } from "../data/dates";
import {
  canAccessMenu,
  canWriteFinance,
  canWriteOrders,
  type AppUserRole,
} from "../data/roles";
import {
  calculateReservePlan,
  reconcileLine,
  validateReservePlan,
  type ReservePlan,
  type PlanData,
} from "../data/reservePlan";
import type { MenuId } from "../data/types";
import { useI18n } from "../i18n/I18nProvider";
import { markOpenOrderCreate } from "./orderActions";
import {
  markOpenFinanceCollection,
  markOpenFinanceExpense,
} from "./financeActions";
import "./Workspace.css";
interface Order {
  id: number;
  orderNumber: string;
  customerName: string | null;
  status: string;
  quantity: number;
  deliveredQuantity: number;
  expectedDeliveryDate: string | null;
}
interface Account {
  id: number;
  name: string;
  currency: string;
  balance: number;
  currentBalance?: number | string | null;
}
const accountMismatch = (account:Account) => account.currentBalance != null && Number.isFinite(Number(account.currentBalance)) && Math.abs(Number(account.currentBalance)-account.balance)>0.01;
interface Snapshot {
  plan: ReservePlan | null;
  data: PlanData;
  generatedAt?: string;
}
interface Flow {
  currency: string;
  expectedCollectionsNotice?: string;
  expectedCollectionsReliable?: boolean;
  calendar: Array<{
    ledgerId: number;
    supplierName: string;
    amount: number;
    dueDate: string;
  }>;
  expectedCollections: Array<{
    customerId: number;
    customerName: string;
    amount: number;
    dueDate: string;
  }>;
}
interface Part<T> {
  data: T | null;
  failed: boolean;
}
function usePart<T>(
  endpoint: string,
  allowed: boolean,
  revision: number,
): Part<T> {
  const [result, setResult] = useState<
    Part<T> & { endpoint: string; revision: number }
  >({ data: null, failed: false, endpoint: "", revision: -1 });
  useEffect(() => {
    if (!allowed) return;
    let live = true;
    apiGet<T>(endpoint)
      .then((data) => {
        const normalized =
          endpoint === "/cash/summary" && Array.isArray(data)
            ? { accounts: data }
            : data;
        const value = normalized as Record<string, unknown> | null;
        const valid =
          endpoint === "/orders"
            ? Array.isArray(data)
            : endpoint === "/cash/summary"
              ? Array.isArray(value?.accounts)
              : endpoint === "/cash-flow"
                ? Array.isArray(value?.calendar) &&
                  Array.isArray(value?.expectedCollections)
                : Boolean(
                    (value?.data as PlanData | undefined)?.accounts &&
                    (value?.data as PlanData | undefined)?.movements,
                  );
        if (!valid) throw new Error("Incomplete response");
        if (live)
          setResult({
            data: normalized as T,
            failed: false,
            endpoint,
            revision,
          });
      })
      .catch(() => {
        if (live) setResult({ data: null, failed: true, endpoint, revision });
      });
    return () => {
      live = false;
    };
  }, [endpoint, allowed, revision]);
  return allowed && result.endpoint === endpoint && result.revision === revision
    ? result
    : { data: null, failed: false };
}
export function OverviewModule({
  role,
  onNavigate,
}: {
  role?: AppUserRole | null;
  onNavigate?: (id: MenuId) => void;
}) {
  const { t, formatCurrency, formatDate, formatNumber } = useI18n();
  const [revision, setRevision] = useState(0);
  const ordersAllowed = Boolean(role) && canAccessMenu(role, "orders");
  const financeAllowed = Boolean(role) && canAccessMenu(role, "finance");
  const planAllowed = canWriteFinance(role);
  const orders = usePart<Order[]>("/orders", ordersAllowed, revision);
  const accounts = usePart<{ accounts: Account[] }>(
    "/cash/summary",
    financeAllowed,
    revision,
  );
  const flow = usePart<Flow>("/cash-flow", financeAllowed, revision);
  const snapshot = usePart<Snapshot>("/reserve-plan", planAllowed, revision);
  useEffect(() => {
    const timer = window.setInterval(() => setRevision((n) => n + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const plan = snapshot.data?.plan ?? null;
  const data = snapshot.data?.data;
  const today = data?.today ?? algiersYmd();
  const soon = new Date(new Date(`${today}T12:00:00Z`).getTime() + 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const active = (Array.isArray(orders.data) ? orders.data : []).filter(
    (o) =>
      !["CANCELLED", "DELIVERED", "DRAFT"].includes(o.status) &&
      o.quantity > o.deliveredQuantity,
  );
  const deliveries = [...active].sort((a, b) =>
    (a.expectedDeliveryDate ?? "9999").localeCompare(
      b.expectedDeliveryDate ?? "9999",
    ),
  );
  const scenarios =
    plan && data && !validateReservePlan(plan).length
      ? (plan.insuranceMode === "unknown"
          ? (["separate", "included"] as const)
          : [plan.insuranceMode]
        ).map((mode) => calculateReservePlan(plan, data, mode))
      : [];
  const finance = (tab: string) => {
    try {
      sessionStorage.setItem("velora.finance.tab", tab);
    } catch {
      /* optional preference */
    }
    onNavigate?.("finance");
  };
  const openOrder = (id: number) => {
    try {
      sessionStorage.setItem("velora.orders.selectedId", String(id));
    } catch {
      /* optional preference */
    }
    onNavigate?.("orders");
  };
  type Alert = {
    id: string;
    priority: number;
    title: string;
    detail: string;
    action: () => void;
    actionLabel: string;
  };
  const alerts: Alert[] = [];
  for (const o of deliveries.filter(
    (o) => o.expectedDeliveryDate && o.expectedDeliveryDate <= soon,
  ))
    alerts.push({
      id: `order-${o.id}`,
      priority: o.expectedDeliveryDate! < today ? 1 : 4,
      title: `${o.orderNumber} · ${o.customerName ?? ""}`,
      detail: `${formatDate(o.expectedDeliveryDate!)} · ${t(o.expectedDeliveryDate! < today ? "work.late" : "work.soon")} · ${t("work.deliveryAction")}`,
      action: () => openOrder(o.id),
      actionLabel: t("work.details"),
    });
  if (plan && data)
    for (const l of plan.lines.filter(
      (l) =>
        l.kind === "insurance" &&
        !l.deferred &&
        reconcileLine(l, data).remaining > 0,
    )) {
      if (!l.date || l.date <= soon)
        alerts.push({
          id: l.id,
          priority: !l.date ? 2 : l.date < today ? 0 : 3,
          title: `${t("work.insurance")} · ${formatCurrency(reconcileLine(l, data).remaining, data.currency)}`,
          detail: `${!l.date ? t("reserve.dueRequired") : formatDate(l.date) + " · " + t(l.date < today ? "work.late" : "work.soon")} · ${t("work.planAction")}`,
          action: () => finance("reserve"),
          actionLabel: t("work.openPlan"),
        });
    }
  for (const r of scenarios.filter(
    (r) => r.reliableOpening && (r.reserveNeed ?? 0) > 0,
  ))
    alerts.push({
      id: `reserve-${r.mode}`,
      priority: 1,
      title: `${t("work.reserve")} · ${formatCurrency(r.reserveNeed!, data!.currency)}`,
      detail: `${t(r.mode === "included" ? "reserve.text26" : "reserve.text27")} · ${t("work.planAction")}`,
      action: () => finance("reserve"),
      actionLabel: t("work.openPlan"),
    });
  for (const r of scenarios.filter(
    (r) => r.reliableOpening && r.cashFundingGap > 0,
  ))
    alerts.push({
      id: `cash-gap-${r.mode}`,
      priority: 1,
      title: `${t("reserve.text89")} · ${formatCurrency(r.cashFundingGap, data!.currency)}`,
      detail: `${t(r.mode === "included" ? "reserve.text26" : "reserve.text27")} · ${t("work.planAction")}`,
      action: () => finance("reserve"),
      actionLabel: t("work.openPlan"),
    });
  for (const a of data?.accounts.filter((a) => a.balanceReview) ?? [])
    alerts.push({
      id: `account-${a.id}`,
      priority: 2,
      title: a.name,
      detail: t("work.balanceReview"),
      action: () => finance("cash"),
      actionLabel: t("work.details"),
    });
  for (const a of accounts.data?.accounts.filter(accountMismatch) ?? []) {
    if (!alerts.some(alert=>alert.id===`account-${a.id}`)) alerts.push({id:`account-${a.id}`,priority:2,title:a.name,detail:t('work.balanceReview'),action:()=>finance('cash'),actionLabel:t('work.details')});
  }
  for (const payment of flow.data?.calendar ?? [])
    alerts.push({
      id: `payment-${payment.ledgerId}`,
      priority: payment.dueDate < today ? 1 : 4,
      title: `${payment.supplierName} · ${formatCurrency(payment.amount, flow.data!.currency)}`,
      detail: `${formatDate(payment.dueDate)} · ${t("work.planAction")}`,
      action: () => finance("debts"),
      actionLabel: t("work.details"),
    });
  const problem = (part: Part<unknown>) =>
    part.failed ? (
      <p role="alert">{t("work.unavailable")}</p>
    ) : part.data === null ? (
      <p role="status">{t("common.loading")}</p>
    ) : null;
  const failed =
    orders.failed || accounts.failed || flow.failed || snapshot.failed;
  const pending =
    (ordersAllowed && !orders.data && !orders.failed) ||
    (financeAllowed &&
      ((!accounts.data && !accounts.failed) || (!flow.data && !flow.failed))) ||
    (planAllowed && !snapshot.data && !snapshot.failed);
  return (
    <section className="workspace" aria-label={t("work.title")}>
      {['OWNER','ADMIN','ACCOUNTING_OPERATIONS'].includes(role??'')&&<BusinessPositionPanel/>}
      <header className="workspace__header">
        <div>
          <h1>{t("work.title")}</h1>
          <p>{t("work.subtitle")}</p>
        </div>
        <button
          className="btn btn--ghost"
          onClick={() => setRevision((n) => n + 1)}
        >
          {t("work.refresh")}
        </button>
      </header>
      <div className="workspace__actions">
        {canWriteOrders(role) && (
          <button
            className="btn btn--primary"
            onClick={() => {
              markOpenOrderCreate();
              onNavigate?.("orders");
            }}
          >
            {t("work.order")}
          </button>
        )}
        {canWriteFinance(role) && (
          <>
            <button
              className="btn btn--primary"
              onClick={() => {
                markOpenFinanceCollection();
                finance("cash");
              }}
            >
              {t("work.collection")}
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => {
                markOpenFinanceExpense();
                finance("cash");
              }}
            >
              {t("work.expense")}
            </button>
          </>
        )}
      </div>
      <article className="card workspace__section">
        <h2>{t("work.priorities")}</h2>
        <div className="workspace__alerts">{alerts
          .sort((a, b) => a.priority - b.priority)
          .map((a) => (
            <div
              key={a.id}
              className={`workspace__alert ${a.priority < 2 ? "workspace__alert--critical" : ""}`}
            >
              <strong>{a.title}</strong>
              <p>{a.detail}</p>
              <button className="btn btn--ghost" onClick={a.action}>
                {a.actionLabel}
              </button>
            </div>
          ))}</div>
        {!alerts.length && (
          <p>
            {failed
              ? t("work.unavailable")
              : pending
                ? t("common.loading")
                : t("work.noAlerts")}
          </p>
        )}
      </article>
      <div className="workspace__grid">
        {ordersAllowed && (
          <article className="card workspace__section">
            <h2>{t("work.delivery")}</h2>
            {problem(orders)}
            {orders.data && (
              <>
                <button
                  className="workspace__metric"
                  onClick={() => onNavigate?.("orders")}
                >
                  {t("work.active")}
                  <strong>{formatNumber(active.length)}</strong>
                </button>
                {deliveries.slice(0, 6).map((o) => (
                  <button
                    key={o.id}
                    className="workspace__metric"
                    onClick={() => openOrder(o.id)}
                  >
                    <span>
                      {o.orderNumber} · {o.customerName}
                    </span>
                    <span>
                      {o.expectedDeliveryDate
                        ? formatDate(o.expectedDeliveryDate)
                        : t("work.noDate")}{" "}
                      · {formatNumber(o.quantity - o.deliveredQuantity)}
                    </span>
                  </button>
                ))}
                {!deliveries.length && <p>{t("work.emptyOrders")}</p>}
              </>
            )}
          </article>
        )}
        {financeAllowed && (
          <article className="card workspace__section">
            <h2>{t("work.current")}</h2>
            {problem(accounts)}
            {accounts.data?.accounts.map((a) => (
              <button
                key={a.id}
                className="workspace__metric"
                onClick={() => {
                  try {
                    sessionStorage.setItem(
                      "velora.finance.accountName",
                      a.name,
                    );
                  } catch {
                    /* optional preference */
                  }
                  finance("cash");
                }}
              >
                <span>{a.name}</span>
                <strong>
                  {data?.accounts.find((item) => item.id === a.id)
                    ?.balanceReview || accountMismatch(a) || !Number.isFinite(a.balance)
                    ? t("work.unknown")
                    : formatCurrency(a.balance, a.currency)}
                </strong>
                <span>{t("work.details")}</span>
              </button>
            ))}
          </article>
        )}
      </div>
      {planAllowed && (
        <article className="card workspace__section">
          <h2>{t("work.forecast")}</h2>
          {problem(snapshot)}
          {snapshot.data && !plan && <p>{t("work.noPlan")}</p>}
          {plan && (
            <>
              <p>
                {plan.month ?? t("work.noDate")} ·{" "}
                {plan.reserve === null
                  ? t("reserve.unset")
                  : `${t("reserve.text31")}: ${formatCurrency(plan.reserve, data!.currency)}`}
              </p>
              <p>
                {t("work.assumption")} ·{" "}
                {t(
                  plan.openingMode === "excluded"
                    ? "reserve.text36"
                    : plan.openingMode === "manual"
                      ? "reserve.text37"
                      : "reserve.text38",
                )}
              </p>
            </>
          )}
          {scenarios.map((r) => (
            <div className="workspace__scenario" key={r.mode}>
              <h3>
                {t(r.mode === "included" ? "reserve.text26" : "reserve.text27")}
              </h3>
              <div className="workspace__grid">
                {[
                  ["work.cash", r.cash],
                  ["work.bank", r.bank],
                  ["work.total", r.total],
                ].map(([key, value]) => (
                  <button
                    key={key}
                    className="workspace__metric"
                    onClick={() => finance("reserve")}
                  >
                    <span>{t(String(key))}</span>
                    <strong>
                      {r.reliableOpening
                        ? formatCurrency(Number(value), data!.currency)
                        : t("work.unknown")}
                    </strong>
                  </button>
                ))}
              </div>
              {(["collection", "payment"] as const).map((kind) => (
                <details key={kind}>
                  <summary>
                    {t(
                      kind === "collection" ? "work.expected" : "work.payments",
                    )}{" "}
                    ·{" "}
                    {formatCurrency(
                      kind === "collection" ? r.collections : r.outflows,
                      data!.currency,
                    )}
                  </summary>
                  {r.rows
                    .filter(
                      (l) =>
                        l.active &&
                        (kind === "collection"
                          ? l.kind === "collection"
                          : l.kind !== "collection" && l.kind !== "transfer"),
                    )
                    .map((l) => (
                      <div className="workspace__row" key={l.id}>
                        <span>
                          {l.label}
                          {l.assumption ? ` · ${t("work.assumption")}` : ""}
                          <br />
                          {l.date ? formatDate(l.date) : t("work.noDate")}
                        </span>
                        <strong>
                          {formatCurrency(l.remaining, data!.currency)}
                        </strong>
                      </div>
                    ))}
                </details>
              ))}
              <button
                className="btn btn--ghost"
                onClick={() => finance("reserve")}
              >
                {t("work.openPlan")}
              </button>
            </div>
          ))}
          {plan && !scenarios.length && (
            <p role="alert">
              {t("work.unknown")} · {validateReservePlan(plan).join(" ")}
            </p>
          )}
        </article>
      )}
      {financeAllowed && (
        <article className="card workspace__section">
          <h2>{t("work.expected")}</h2>
          {problem(flow)}
          {flow.data?.expectedCollectionsNotice && (
            <p>{flow.data.expectedCollectionsNotice}</p>
          )}
          {flow.data?.expectedCollections.map((row, index) => (
            <button
              className="workspace__metric"
              key={`${row.customerId}-${index}`}
              onClick={() => finance("receivables")}
            >
              <span>
                {row.customerName} ·{" "}
                {row.dueDate ? formatDate(row.dueDate) : t("work.noDate")}
              </span>
              <strong>{formatCurrency(row.amount, flow.data!.currency)}</strong>
              <span>{t("work.assumption")}</span>
            </button>
          ))}
        </article>
      )}
      {snapshot.data?.generatedAt && (
        <p className="workspace__tag">
          {t("work.source")} · {formatDate(snapshot.data.generatedAt)} · ERP
        </p>
      )}
    </section>
  );
}

