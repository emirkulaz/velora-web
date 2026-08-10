import type { ReactElement } from 'react'
import type { CompanyPresentation } from '../data/companyBranding'
import type { MenuId } from '../data/types'
import { CustomersModule } from './CustomersModule'
import { FinanceAiModule } from './FinanceAiModule'
import { FinanceModule } from './FinanceModule'
import { InventoryModule } from './InventoryModule'
import { OrdersModule } from './OrdersModule'
import { OverviewModule } from './OverviewModule'
import { ProductionModule } from './ProductionModule'
import { ProductsModule } from './ProductsModule'
import { UsersModule } from './UsersModule'

export function renderModule(
  id: MenuId,
  company: CompanyPresentation | null,
): ReactElement {
  switch (id) {
    case 'customers':
      return <CustomersModule />
    case 'products':
      return <ProductsModule company={company} />
    case 'orders':
      return <OrdersModule />
    case 'inventory':
      return <InventoryModule company={company} />
    case 'production':
      return <ProductionModule />
    case 'finance':
      return <FinanceModule />
    case 'financeAi':
      return <FinanceAiModule />
    case 'users':
      return <UsersModule />
    default:
      return <OverviewModule />
  }
}
