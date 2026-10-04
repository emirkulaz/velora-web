import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OverviewModule } from "./OverviewModule";
import { initialReservePlan, type PlanData } from "../data/reservePlan";
import { I18nProvider } from "../i18n/I18nProvider";
const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock("../data/api", () => ({ apiGet }));
let plan = initialReservePlan();
const data: PlanData = {
  accounts: [
    { id: 1, name: "Ana kasa", currency: "DZD", balance: 500 },
    { id: 2, name: "Banka", currency: "DZD", balance: 100000 },
  ],
  movements: [],
  today: "2026-10-02",
  currency: "DZD",
};
const order = {
  id: 11,
  orderNumber: "SO-11",
  customerName: "Yacine",
  status: "CONFIRMED",
  quantity: 500,
  deliveredQuantity: 100,
  expectedDeliveryDate: "2026-10-03",
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("velora.uiLanguage", "tr");
  plan = initialReservePlan();
  apiGet
    .mockReset()
    .mockImplementation((path: string) =>
      Promise.resolve(
        path === "/orders"
          ? [order]
          : path === "/cash/summary"
            ? { accounts: data.accounts }
            : path === "/cash-flow"
              ? { currency: "DZD", calendar: [], expectedCollections: [] }
              : { plan, data },
      ),
    );
});
afterEach(cleanup);
const show = (
  role: "OWNER" | "PRODUCTION_MANAGER" | "VIEWER" = "OWNER",
  navigate = vi.fn(),
) => {
  render(
    <I18nProvider>
      <OverviewModule role={role} onNavigate={navigate} />
    </I18nProvider>,
  );
  return navigate;
};
it("shows real accounts separately from expected funds and leaves the reserve unset", async () => {
  show();
  expect(
    await screen.findByText(/Rezerv hedefi belirlenmedi/),
  ).toBeInTheDocument();
  expect(screen.getByText("30.110 DZD")).toBeInTheDocument();
  expect(screen.getByText("186.110 DZD")).toBeInTheDocument();
  const current = screen
    .getByRole("heading", { name: "Gerçekleşen hesap kayıtları" })
    .closest("article")!;
  expect(within(current).getByText("500 DZD")).toBeInTheDocument();
  expect(within(current).queryByText("30.110 DZD")).not.toBeInTheDocument();
  expect(screen.getByText(/Vade girilmeli/)).toBeInTheDocument();
  expect(
    screen.queryByText(/Rezerv için ek kaynak gerekli/),
  ).not.toBeInTheDocument();
});
it("shows the 19,890 reserve gap only after a 50,000 target is entered", async () => {
  plan = {
    ...plan,
    insuranceMode: "separate",
    reserve: 50000,
    bankAvailable: true,
  };
  show();
  expect(
    await screen.findByText("Rezerv için ek kaynak gerekli · 19.890 DZD"),
  ).toBeInTheDocument();
});
it("only loads orders for a production manager", async () => {
  show("PRODUCTION_MANAGER");
  await screen.findAllByText(/SO-11/);
  expect(apiGet.mock.calls.map((call) => call[0])).toEqual(["/orders"]);
  expect(
    screen.queryByRole("button", { name: "Tahsilat kaydet" }),
  ).not.toBeInTheDocument();
});
it("shows failures instead of invented zero balances and can refresh", async () => {
  apiGet.mockRejectedValue(new Error("offline"));
  show();
  await screen.findAllByText(
    "Bilgi alınamadı. Bağlantınızı kontrol edip yeniden deneyin.",
  );
  expect(screen.queryByText("0 DZD")).not.toBeInTheDocument();
  apiGet.mockResolvedValue({ accounts: data.accounts });
  fireEvent.click(screen.getByRole("button", { name: "Bilgileri yenile" }));
  await screen.findByText("500 DZD");
});
it("opens the quick forms and the specific order", async () => {
  const navigate = show();
  await screen.findByText(/Rezerv hedefi belirlenmedi/);
  fireEvent.click(screen.getByRole("button", { name: "Gider gir" }));
  expect(sessionStorage.getItem("velora.finance.cashType")).toBe("CASH_OUT");
  expect(navigate).toHaveBeenLastCalledWith("finance");
  fireEvent.click(screen.getByRole("button", { name: "Tahsilat kaydet" }));
  expect(sessionStorage.getItem("velora.finance.openCollection")).toBe("1");
  fireEvent.click(
    screen
      .getAllByRole("button")
      .find((button) => button.textContent?.includes("SO-11"))!,
  );
  expect(sessionStorage.getItem("velora.orders.selectedId")).toBe("11");
});
it("removes the insurance warning when a matching actual payment completes it", async () => {
  plan.cashAccountId = 1;
  plan.lines.find((l) => l.kind === "insurance")!.accountId = 1;
  plan.lines.find((l) => l.kind === "insurance")!.transactionIds = [90];
  const paid = {
    ...data,
    movements: [
      {
        id: 90,
        cashAccountId: 1,
        debit: 0,
        credit: 156000,
        date: "2026-10-02",
        reversesId: null,
      },
    ],
  };
  apiGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/orders"
        ? []
        : path === "/cash/summary"
          ? { accounts: data.accounts }
          : path === "/cash-flow"
            ? { currency: "DZD", calendar: [], expectedCollections: [] }
            : { plan, data: paid },
    ),
  );
  show();
  await screen.findByText(/Rezerv hedefi belirlenmedi/);
  expect(screen.queryByText(/Sigorta ödemesi ·/)).not.toBeInTheDocument();
});
it("does not give viewers financial write shortcuts or payroll planning access", async () => {
  show("VIEWER");
  await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(3));
  expect(apiGet).not.toHaveBeenCalledWith("/reserve-plan");
  expect(
    screen.queryByRole("button", { name: "Gider gir" }),
  ).not.toBeInTheDocument();
});
