/* Route-level lazy components intentionally share this module with the render factory. */
/* eslint-disable react-refresh/only-export-components */
import { lazy, type ReactElement } from 'react'
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
const CostCalculationModule = lazy(() => import('./CostCalculationModule').then((m) => ({ default: m.CostCalculationModule })))
const CustomerRequestsModule = lazy(() => import('./CustomerRequestsModule').then((m) => ({ default: m.CustomerRequestsModule })))
const CustomersModule = lazy(() => import('./CustomersModule').then((m) => ({ default: m.CustomersModule })))
const DailyWorkModule = lazy(() => import('./DailyWorkModule').then((m) => ({ default: m.DailyWorkModule })))
const FinanceAiModule = lazy(() => import('./FinanceAiModule').then((m) => ({ default: m.FinanceAiModule })))
const FinanceModule = lazy(() => import('./FinanceModule').then((m) => ({ default: m.FinanceModule })))
const InventoryModule = lazy(() => import('./InventoryModule').then((m) => ({ default: m.InventoryModule })))
const OrdersModule = lazy(() => import('./OrdersModule').then((m) => ({ default: m.OrdersModule })))
const OverviewModule = lazy(() => import('./OverviewModule').then((m) => ({ default: m.OverviewModule })))
const ProductionModule = lazy(() => import('./ProductionModule').then((m) => ({ default: m.ProductionModule })))
const ProductsModule = lazy(() => import('./ProductsModule').then((m) => ({ default: m.ProductsModule })))
const UsersModule = lazy(() => import('./UsersModule').then((m) => ({ default: m.UsersModule })))
const UserManagementModule = lazy(() => import('./UserManagementModule').then((m) => ({ default: m.UserManagementModule })))

export function renderModule(
  id: MenuId,
  company: CompanyPresentation | null,
  role?: AppUserRole | null,
  onNavigate?: (menuId: MenuId) => void,
  t: (key: string) => string = (key) => key,
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
        : <p className="demo-notice" role="alert">{t('userMgmt.adminOnly')}</p>
    default:
      return <OverviewModule role={role} onNavigate={onNavigate} />
  }
}
