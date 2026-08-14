import { ReportButton } from '../components/ReportButton'
import type { MenuId } from '../data/types'
import { useI18n } from '../i18n/I18nProvider'
import { markOpenCustomerRequestCreate } from './customerRequestActions'
import { markOpenFinanceCash, markOpenFinanceCollection } from './financeActions'
import { markOpenInventoryMovement } from './inventoryActions'
import { markOpenOrderCreate } from './orderActions'

const DAILY_ACTIONS: Array<{
  labelKey: string
  menu: MenuId
  hintKey: string
  open?: () => void
}> = [
  { labelKey: 'daily.action.request', menu: 'customerRequests', hintKey: 'daily.hint.request', open: markOpenCustomerRequestCreate },
  { labelKey: 'daily.action.order', menu: 'orders', hintKey: 'daily.hint.order', open: markOpenOrderCreate },
  { labelKey: 'daily.action.cash', menu: 'finance', hintKey: 'daily.hint.cash', open: markOpenFinanceCash },
  { labelKey: 'daily.action.collection', menu: 'finance', hintKey: 'daily.hint.collection', open: markOpenFinanceCollection },
  { labelKey: 'daily.action.stock', menu: 'inventory', hintKey: 'daily.hint.stock', open: markOpenInventoryMovement },
]

export function DailyWorkActions({ onNavigate }: { onNavigate?: (menuId: MenuId) => void }) {
  const { t } = useI18n()
  return (
    <section className="panel panel--full daily-work-actions">
      <div className="panel__header">
        <h2>{t('daily.title')}</h2>
        <ReportButton type="daily-summary" label={t('daily.report')} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {DAILY_ACTIONS.map((action) => (
          <button
            key={action.labelKey}
            type="button"
            className="btn btn--primary"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '14px 16px', height: 'auto', textAlign: 'left' }}
            onClick={() => {
              action.open?.()
              onNavigate?.(action.menu)
            }}
          >
            <span>{t(action.labelKey)}</span>
            <span style={{ fontSize: 12, opacity: 0.85, fontWeight: 400 }}>{t(action.hintKey)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
