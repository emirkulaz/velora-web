import type { ReactElement } from 'react'
import type { CompanyPresentation } from '../data/companyBranding'
import {
  canDeleteCustomers,
  canDeleteProducts,
  canWriteCustomerRequests,
  canWriteCustomers,
  canWriteFinance,
  canWriteOrders,
  canWriteProduction,
  canWriteProducts,
  canWriteStock,
  canManageUsers,
  type AppUserRole,
} from '../data/roles'
import type { MenuId } from '../data/types'
import { CostCalculationModule } from './CostCalculationModule'
import { CustomerRequestsModule } from './CustomerRequestsModule'
import { CustomersModule } from './CustomersModule'
import { DailyWorkModule } from './DailyWorkModule'
import { FinanceAiModule } from './FinanceAiModule'
import { FinanceModule } from './FinanceModule'
import { InventoryModule } from './InventoryModule'
import { OrdersModule } from './OrdersModule'
import { OverviewModule } from './OverviewModule'
import { ProductionModule } from './ProductionModule'
import { ProductsModule } from './ProductsModule'
import { UsersModule } from './UsersModule'
import { UserManagementModule } from './UserManagementModule'

export function renderModule(
  id: MenuId,
  company: CompanyPresentation | null,
  role?: AppUserRole | null,
  onNavigate?: (menuId: MenuId) => void,
): ReactElement {
  switch (id) {
    case 'dailyWork':
      return <DailyWorkModule onNavigate={onNavigate} showActions={false} />
    case 'customers':
      return (
        <CustomersModule
          canWrite={canWriteCustomers(role)}
          canDelete={canDeleteCustomers(role)}
        />
      )
    case 'customerRequests':
      return (
        <CustomerRequestsModule canWrite={canWriteCustomerRequests(role)} />
      )
    case 'products':
      return (
        <ProductsModule
          company={company}
          canWrite={canWriteProducts(role)}
          canDelete={canDeleteProducts(role)}
        />
      )
    case 'orders':
      return <OrdersModule canWrite={canWriteOrders(role)} />
    case 'inventory':
      return (
        <InventoryModule
          company={company}
          canWrite={canWriteStock(role)}
          canManageWarehouses={canWriteProducts(role)}
        />
      )
    case 'yarnInventory':
      return (
        <InventoryModule
          company={company}
          kind="yarn"
          canWrite={canWriteStock(role)}
          canManageWarehouses={canWriteProducts(role)}
        />
      )
    case 'production':
      return (
        <ProductionModule company={company} canWrite={canWriteProduction(role)} />
      )
    case 'costCalculation':
      return <CostCalculationModule canWrite={canWriteProduction(role)} />
    case 'finance':
      return <FinanceModule canWrite={canWriteFinance(role)} />
    case 'financeAi':
      return <FinanceAiModule />
    case 'users':
      return <UsersModule />
    case 'userManagement':
      return canManageUsers(role)
        ? <UserManagementModule />
        : <p className="demo-notice" role="alert">Bu sayfaya yalnızca yöneticiler erişebilir.</p>
    default:
      return <OverviewModule role={role} onNavigate={onNavigate} />
  }
}
