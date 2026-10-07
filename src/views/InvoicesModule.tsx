import { useState } from 'react'
import { AiCommandPanel } from '../components/AiCommandPanel'
import { canWriteOrders, type AppUserRole } from '../data/roles'
import { useI18n } from '../i18n/I18nProvider'
import { ProductInvoicesTab } from './ProductInvoicesTab'

export function InvoicesModule({ role }: { role?: AppUserRole | null }) {
  const { t } = useI18n()
  const [revision, setRevision] = useState(0)
  return <section aria-label={t('nav.invoices')}>
    <h1>{t('nav.invoices')}</h1>
    <p>{t('invoices.documentHint')}</p>
    {canWriteOrders(role) && <AiCommandPanel userRole={role} documentsOpen onRefresh={() => setRevision(value => value + 1)} />}
    <ProductInvoicesTab key={revision} canWrite={canWriteOrders(role)} />
  </section>
}
