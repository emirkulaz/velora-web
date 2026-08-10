interface SummaryItem {
  label: string
  value: string
  unit?: string
}

export function ModuleSummary({ items }: { items: SummaryItem[] }) {
  return (
    <div className="module-summary">
      {items.map((item) => (
        <article key={item.label} className="module-summary__card">
          <span className="module-summary__value">
            {item.value}
            {item.unit && <span className="module-summary__unit"> {item.unit}</span>}
          </span>
          <span className="module-summary__label">{item.label}</span>
        </article>
      ))}
    </div>
  )
}
