import { useEffect, useState } from "react";
import { apiGet } from "../data/api";
import "./BusinessPositionPanel.css";

export type BusinessRecord = {
  id: number;
  source: string;
  label: string;
  date?: string;
  currency?: string;
  amount?: number;
  paid?: number;
  remaining?: number;
  quantity?: number;
  unit?: string;
  status?: string;
  dueDate?: string | null;
  daysOutstanding?: number;
  note?: string;
  plannedQuantity?: number;
  remainingQuantity?: number;
};
type Money = Record<string, number>;
type Period = {
  from: string;
  to: string;
  opening: Money;
  inflow: Money;
  outflow: Money;
  closing: Money;
  collections: Money;
  sales: Money;
  deliveries: Money;
  deliveredAllocatedPaid: Money;
  deliveredUncollected: Money;
  productionQuantity: Money;
  deliveryQuantity: Money;
  invoiceCount: number;
  salaryPayments: Money;
  supplierPayments: Money;
  otherOutflow: Money;
  otherInflow: Money;
  details: Record<string, BusinessRecord[]>;
};
type Position = {
  generatedAt: string;
  asOf: string;
  timezone: string;
  source: string;
  totals: {
    cash: Money;
    receivables: Money;
    pipeline: Money;
    liabilities: Money;
    payroll: Money;
    suppliers: Money;
  };
  scenario: Money;
  current: Period;
  previous: Period;
  today: Period;
  month: Period;
  groups: Record<string, BusinessRecord[]>;
  notices: string[];
};
const labelUnit = (unit: string) =>
  ({ METER: "metre", PIECE: "adet", KILOGRAM: "kg", LITER: "litre" })[unit] ??
  unit;
const display = (value?: number) =>
  value == null
    ? "—"
    : value.toLocaleString("tr-TR", { maximumFractionDigits: 3 });
export const businessMoney = (values?: Money) =>
  Object.entries(values ?? {})
    .map(([unit, v]) => `${display(v)} ${labelUnit(unit)}`)
    .join(" · ") || "Kayıt yok";

export function BusinessRecords({ rows }: { rows: BusinessRecord[] }) {
  return (
    <div className="business-position__table">
      <table>
        <thead>
          <tr>
            <th>Kayıt / kaynak</th>
            <th>Tarih</th>
            <th>Tutar</th>
            <th>Mahsup / ödeme</th>
            <th>Kalan</th>
            <th>Miktar</th>
            <th>Durum / açıklama</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.source}-${r.id}-${i}`}>
              <td>
                {r.label}
                <small>
                  {r.source} #{r.id}
                </small>
              </td>
              <td>
                {r.date ?? "—"}
                {r.dueDate && <small>Vade: {r.dueDate}</small>}
                {r.daysOutstanding != null && (
                  <small>{r.daysOutstanding} gündür açık</small>
                )}
              </td>
              <td>
                {display(r.amount)} {r.currency}
              </td>
              <td>
                {display(r.paid)} {r.currency}
              </td>
              <td>
                {display(r.remaining)} {r.currency}
              </td>
              <td>
                {display(r.quantity)} {r.unit && labelUnit(r.unit)}
                {r.plannedQuantity != null && (
                  <small>
                    Plan: {display(r.plannedQuantity)} · Kalan:{" "}
                    {display(r.remainingQuantity)}
                  </small>
                )}
              </td>
              <td>
                {r.status}
                <small>{r.note}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p>Bu kapsamda kayıt bulunamadı.</p>}
    </div>
  );
}
function dateShift(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function BusinessPositionPanel() {
  const [data, setData] = useState<Position | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const [range, setRange] = useState({
      from: "",
      to: "",
      compareFrom: "",
      compareTo: "",
    }),
    [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<{
    title: string;
    rows: BusinessRecord[];
  } | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const query = new URLSearchParams(
      Object.entries(range).filter(([, v]) => v),
    );
    apiGet<Position>(`/dashboard/business-position?${query}`)
      .then((r) => {
        if (active) {
          if (!r?.totals) throw new Error("Günlük kontrol verisi alınamadı.");
          setData(r);
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Günlük kontrol yüklenemedi.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range, revision]);
  const preset = (key: string) => {
    if (!data) return;
    const today = data.asOf;
    let from = today,
      to = today;
    if (key === "yesterday") from = to = dateShift(today, -1);
    if (key === "week")
      from = dateShift(
        today,
        -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7),
      );
    if (key === "month") from = `${today.slice(0, 7)}-01`;
    if (key === "lastMonth") {
      to = dateShift(`${today.slice(0, 7)}-01`, -1);
      from = `${to.slice(0, 7)}-01`;
    }
    setRange({ from, to, compareFrom: "", compareTo: "" });
  };
  const card = (
    title: string,
    value: string,
    rows: BusinessRecord[],
    hint?: string,
  ) => (
    <button
      className="business-position__card"
      onClick={() => setSelected({ title, rows })}
    >
      <span>{title}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
      <small>Kaynak kayıtları aç →</small>
    </button>
  );
  return (
    <section className="business-position" aria-label="Günlük işletme kontrolü">
      <header>
        <div>
          <h2>İşletmenin bugünkü durumu</h2>
          <p>
            Gerçek nakit, açık borçlar ve beklenen tahsilatlar ayrı hesaplanır.
          </p>
        </div>
        <button
          className="btn btn--ghost"
          disabled={loading}
          onClick={() => setRevision((x) => x + 1)}
        >
          Günlük kontrolü yenile
        </button>
      </header>
      {error && (
        <p role="alert">{error} Önceki değerleri güncel kabul etmeyin.</p>
      )}
      {loading && <p role="status">ERP kayıtları hesaplanıyor…</p>}
      {data && !error && (
        <>
          <small>
            {data.asOf} · {data.timezone} ·{" "}
            {new Date(data.generatedAt).toLocaleTimeString("tr-TR")} ·{" "}
            {data.source}
          </small>
          <div className="business-position__grid">
            {card(
              "Gerçek kasa",
              businessMoney(data.totals.cash),
              data.groups.cash,
            )}
            {card(
              "Teslim edilmiş / faturalanmış alacak",
              businessMoney(data.totals.receivables),
              data.groups.receivables,
            )}
            {card(
              "Kayıtlı toplam borç",
              businessMoney(data.totals.liabilities),
              data.groups.liabilities,
              "Maaş + tedarikçi; desteklenmeyen gider/vergi kalemleri hariç",
            )}
            {card(
              "Teslim edilmemiş siparişlerin kalan bedeli",
              businessMoney(data.totals.pipeline),
              data.groups.pipeline,
              "Beklenen tutar; eldeki nakit değildir",
            )}
          </div>
          <div className="business-position__grid business-position__grid--small">
            {card(
              "Ödenmemiş maaş",
              businessMoney(data.totals.payroll),
              data.groups.payroll,
            )}
            {card(
              "Tedarikçi / satın alma borcu",
              businessMoney(data.totals.suppliers),
              data.groups.suppliers,
              "Mal kabul borcu ikinci kez sayılmaz",
            )}
            {card(
              "Mamul stok",
              businessMoney(
                data.groups.finishedStock.reduce<Money>((a, r) => {
                  if (r.unit) a[r.unit] = (a[r.unit] ?? 0) + (r.quantity ?? 0);
                  return a;
                }, {}),
              ),
              data.groups.finishedStock,
            )}
            {card(
              "Üretimdeki emirler",
              `${data.groups.production.filter((r) => r.status === "IN_PROGRESS").length} emir`,
              data.groups.production.filter((r) => r.status === "IN_PROGRESS"),
            )}
          </div>
          <details>
            <summary>
              Tüm tahsilatlar gerçekleşirse senaryo:{" "}
              {businessMoney(data.scenario)}
            </summary>
            <p>
              Kasa + açık alacak + teslim edilmemiş siparişlerin kalan bedeli −
              kayıtlı maaş ve tedarikçi borçları. Gelecekteki üretim ve işletme
              giderleri dahil değildir.
            </p>
            <button
              className="btn btn--ghost"
              onClick={() =>
                setSelected({
                  title: "Senaryonun kaynakları",
                  rows: [
                    ...data.groups.cash,
                    ...data.groups.receivables,
                    ...data.groups.pipeline,
                    ...data.groups.liabilities,
                  ],
                })
              }
            >
              Senaryo kaynakları
            </button>
          </details>
          <h3>Bugün</h3>
          <div className="business-position__grid business-position__grid--small">
            {card(
              "Bugünkü giriş",
              businessMoney(data.today.inflow),
              data.today.details.inflow,
            )}
            {card(
              "Bugünkü çıkış",
              businessMoney(data.today.outflow),
              data.today.details.outflow,
            )}
            {card(
              "Bugünkü üretim",
              businessMoney(data.today.productionQuantity),
              data.today.details.production,
            )}
            {card(
              "Bugünkü teslimat",
              businessMoney(data.today.deliveries),
              data.today.details.deliveries,
            )}
          </div>
          <h3>Dönem ve günlük kapanış</h3>
          <div className="business-position__filters">
            {[
              ["today", "Bugün"],
              ["yesterday", "Dün"],
              ["week", "Bu hafta"],
              ["month", "Bu ay"],
              ["lastMonth", "Geçen ay"],
            ].map(([key, label]) => (
              <button
                key={key}
                className="btn btn--ghost"
                onClick={() => preset(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <form
            className="business-position__filters"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setRange({
                from: String(f.get("from")),
                to: String(f.get("to")),
                compareFrom: String(f.get("compareFrom")),
                compareTo: String(f.get("compareTo")),
              });
            }}
            key={`${data.current.from}-${data.current.to}`}
          >
            <label>
              Başlangıç
              <input
                type="date"
                name="from"
                required
                defaultValue={data.current.from}
                max={data.asOf}
              />
            </label>
            <label>
              Bitiş
              <input
                type="date"
                name="to"
                required
                defaultValue={data.current.to}
                max={data.asOf}
              />
            </label>
            <label>
              Karşılaştırma başlangıcı
              <input
                type="date"
                name="compareFrom"
                defaultValue={range.compareFrom}
                max={data.asOf}
              />
            </label>
            <label>
              Karşılaştırma bitişi
              <input
                type="date"
                name="compareTo"
                defaultValue={range.compareTo}
                max={data.asOf}
              />
            </label>
            <button className="btn btn--primary" disabled={loading}>
              Hesapla
            </button>
          </form>
          <div className="business-position__comparison">
            {[data.current, data.previous].map((period, index) => (
              <section key={index}>
                <h4>
                  {index === 0 ? "Seçilen dönem" : "Karşılaştırma"} ·{" "}
                  {period.from} – {period.to}
                </h4>
                {(
                  [
                    ["Açılış", "opening"],
                    ["Giriş", "inflow"],
                    ["Çıkış", "outflow"],
                    ["Kapanış", "closing"],
                    ["Müşteri tahsilatı", "collections"],
                    ["Diğer giriş", "otherInflow"],
                    ["Maaş ödemesi", "salaryPayments"],
                    ["Tedarikçi ödemesi", "supplierPayments"],
                    ["Diğer çıkış / gider", "otherOutflow"],
                    ["Onaylı sipariş", "sales"],
                    ["Teslimat", "deliveries"],
                  ] as const
                ).map(([label, key]) => (
                  <button
                    key={key}
                    className="business-position__line"
                    onClick={() =>
                      setSelected({
                        title: `${label} · ${period.from} – ${period.to}`,
                        rows: period.details[key] ?? [],
                      })
                    }
                  >
                    <span>{label}</span>
                    <strong>{businessMoney(period[key])}</strong>
                  </button>
                ))}
                <button
                  className="business-position__line"
                  onClick={() =>
                    setSelected({
                      title: "Üretim olayları",
                      rows: period.details.production,
                    })
                  }
                >
                  <span>Üretim</span>
                  <strong>{businessMoney(period.productionQuantity)}</strong>
                </button>
                <button
                  className="business-position__line"
                  onClick={() =>
                    setSelected({
                      title: "Kesin faturalar",
                      rows: period.details.invoices,
                    })
                  }
                >
                  <span>Kesin fatura</span>
                  <strong>{period.invoiceCount}</strong>
                </button>
                <p>
                  Teslimatların bugünkü mahsup durumu:{" "}
                  {businessMoney(period.deliveredAllocatedPaid)} ödendi /{" "}
                  {businessMoney(period.deliveredUncollected)} açık. Dönem
                  tahsilatından farklıdır.
                </p>
              </section>
            ))}
          </div>
          <details>
            <summary>Dikkat gerektiren kayıtlar</summary>
            <BusinessRecords
              rows={[
                ...data.groups.payroll,
                ...data.groups.suppliers.filter((r) => r.status === "OVERDUE"),
                ...data.groups.receivables,
                ...data.groups.production.filter((r) => r.status === "PLANNED"),
                ...data.groups.pipeline,
                ...data.groups.review,
              ]}
            />
          </details>
          <details>
            <summary>Hesaplama sınırları ve kaynaklar</summary>
            {data.notices.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </details>
        </>
      )}
      {selected && (
        <div
          className="business-position__overlay"
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
        >
          <section>
            <header>
              <h3>{selected.title}</h3>
              <button
                autoFocus
                className="btn btn--ghost"
                onClick={() => setSelected(null)}
              >
                Kapat
              </button>
            </header>
            <BusinessRecords rows={selected.rows} />
          </section>
        </div>
      )}
    </section>
  );
}
