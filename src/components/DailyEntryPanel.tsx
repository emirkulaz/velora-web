import { useState } from "react";
import { apiPost } from "../data/api";
import { ConfirmDialog } from "./ConfirmDialog";
import "./BusinessPositionPanel.css";

type Kind =
  | "employee.salary"
  | "salary.due"
  | "salary.pay"
  | "collection"
  | "expense"
  | "delivery"
  | "production.progress"
  | "production.complete"
  | "purchase.receive";
type Draft = {
  kind: Kind;
  sourceText: string;
  date: string;
  [key: string]: string | number | undefined;
};
export type DailyReview = {
  draft: Draft;
  title: string;
  fields: string[];
  choices: Record<string, { id: number; label: string }[]>;
  errors: string[];
  lines: string[];
  ready: boolean;
  previewToken?: string;
};
const titles: Record<Kind, string> = {
  "employee.salary": "Personel maaş tanımı",
  "salary.due": "Ödenmemiş maaş borcu",
  "salary.pay": "Maaş ödemesi",
  collection: "Müşteri tahsilatı",
  expense: "Kasa gideri",
  delivery: "Sipariş teslimatı",
  "production.progress": "Günlük üretim ilerlemesi",
  "production.complete": "Üretimi tamamlama ve stok girişi",
  "purchase.receive": "Satın alma ve mal kabul",
};
const labels: Record<string, string> = {
  name: "Personel adı (yeni kayıt için)",
  employeeId: "Mevcut personel",
  period: "Maaş dönemi",
  amount: "Tutar / kaynak toplamı",
  currency: "Para birimi",
  salaryDueId: "Kayıtlı maaş borcu",
  cashAccountId: "Kasa",
  customerId: "Müşteri",
  orderId: "Sipariş",
  warehouseId: "Depo",
  quantity: "Miktar",
  unitPrice: "Birim fiyat",
  productionOrderId: "Üretim emri",
  supplierId: "Tedarikçi",
  productId: "Ürün",
};
export function DailyEntryPanel({
  initial,
  onRefresh,
}: {
  initial: DailyReview;
  onRefresh?: () => void;
}) {
  const [review, setReview] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(""),
    [confirmOpen, setConfirmOpen] = useState(false);
  const edit = (key: string, value: string | number | undefined) => {
    setReview((r) => ({
      ...r,
      draft: { ...r.draft, [key]: value },
      previewToken: undefined,
      ready: false,
    }));
    setResult("");
  };
  const preview = async () => {
    setBusy(true);
    setError("");
    try {
      setReview(await apiPost<DailyReview>("/ai/daily/preview", review.draft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Önizleme oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (!review.previewToken) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiPost<{ answer: string; applied: boolean }>(
        "/ai/daily/confirm",
        { previewToken: review.previewToken },
      );
      setResult(response.answer);
      setConfirmOpen(false);
      setReview((r) => ({ ...r, previewToken: undefined }));
      if (response.applied) onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kayıt tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="daily-entry" aria-label="Günlük işlem taslağı">
      <h3>{review.title}</h3>
      <p>{review.draft.sourceText}</p>
      <p>Eksik seçimleri tamamlayın. Onaydan önce kalıcı kayıt yapılmaz.</p>
      <div className="daily-entry__fields">
        <label>
          İşlem
          <select
            value={review.draft.kind}
            disabled={busy}
            onChange={(e) => edit("kind", e.target.value)}
          >
            {Object.entries(titles).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tarih
          <input
            type="date"
            value={review.draft.date}
            disabled={busy}
            onChange={(e) => edit("date", e.target.value)}
          />
        </label>
        <label>
          Belge / işlem referansı (varsa)
          <input
            value={review.draft.externalReference ?? ""}
            disabled={busy}
            maxLength={64}
            onChange={(e) =>
              edit("externalReference", e.target.value || undefined)
            }
          />
        </label>
        {review.fields.map((field) => (
          <label key={field}>
            {labels[field] ?? field}
            {review.choices[field] ? (
              <select
                value={review.draft[field] ?? ""}
                disabled={busy}
                onChange={(e) =>
                  edit(
                    field,
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
              >
                <option value="">
                  Seçin
                  {field === "employeeId"
                    ? " (yeni personelse boş bırakın)"
                    : ""}
                </option>
                {review.choices[field].map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={
                  field === "period"
                    ? "month"
                    : ["amount", "quantity", "unitPrice"].includes(field)
                      ? "number"
                      : "text"
                }
                step={field === "quantity" ? "0.001" : "0.01"}
                min="0"
                value={review.draft[field] ?? ""}
                disabled={busy}
                onChange={(e) =>
                  edit(
                    field,
                    e.target.value === ""
                      ? undefined
                      : ["amount", "quantity", "unitPrice"].includes(field)
                        ? Number(e.target.value)
                        : e.target.value,
                  )
                }
              />
            )}
          </label>
        ))}
      </div>
      {review.draft.unit && <p>Miktar birimi: {review.draft.unit}</p>}
      {review.errors.length > 0 && (
        <ul>
          {review.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      {review.previewToken && (
        <div
          className="daily-entry__preview"
          aria-label="Günlük işlem önizlemesi"
        >
          {review.lines.join("\n")}
        </div>
      )}
      <div className="daily-entry__actions">
        <button
          className="btn btn--ghost"
          disabled={busy}
          onClick={() => void preview()}
        >
          Kontrol et ve önizle
        </button>
        <button
          className="btn btn--primary"
          disabled={busy || !review.ready || !review.previewToken}
          onClick={() => setConfirmOpen(true)}
        >
          Onayla ve kaydet
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {result && <p role="status">{result}</p>}
      <ConfirmDialog
        open={confirmOpen && !busy}
        title="Günlük işlemi kaydet"
        message={review.lines.join("\n")}
        confirmLabel="Onayla ve kaydet"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void confirm()}
      />
    </section>
  );
}
