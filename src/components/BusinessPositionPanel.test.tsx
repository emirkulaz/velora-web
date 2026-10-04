import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { BusinessPositionPanel } from './BusinessPositionPanel'
const {apiGet}=vi.hoisted(()=>({apiGet:vi.fn()}));vi.mock('../data/api',()=>({apiGet}))
afterEach(()=>{cleanup();vi.resetAllMocks()})
it('drills into the source rows and labels projected money separately',async()=>{
 const details=Object.fromEntries(['opening','closing','inflow','outflow','collections','salaryPayments','supplierPayments','otherOutflow','otherInflow','sales','deliveries','production','invoices','newSalaryLiabilities'].map(k=>[k,[]]));
 const p={from:'2026-10-04',to:'2026-10-04',opening:{},inflow:{},outflow:{},closing:{},collections:{},sales:{},deliveries:{},deliveredAllocatedPaid:{},deliveredUncollected:{},productionQuantity:{},deliveryQuantity:{},invoiceCount:0,salaryPayments:{},supplierPayments:{},otherOutflow:{},otherInflow:{},details};
 const groups=Object.fromEntries(['cash','receivables','pipeline','payroll','suppliers','liabilities','finishedStock','production','review'].map(k=>[k,[]]));
 groups.cash=[{id:18,source:'CashAccount/CashTransaction',label:'Kaynak kasa',currency:'DZD',amount:99380}] as never;
 apiGet.mockResolvedValue({generatedAt:'2026-10-04T09:00:00Z',asOf:'2026-10-04',timezone:'Africa/Algiers',source:'ERP kayıtları',totals:{cash:{DZD:99380},receivables:{DZD:380830},pipeline:{DZD:263800},liabilities:{DZD:351600},payroll:{DZD:351600},suppliers:{}},scenario:{DZD:392410},current:p,previous:p,today:p,month:p,groups,notices:['Tahsilat olmayan sipariş nakit değildir.']});
 render(<BusinessPositionPanel/>);
 const cash=await screen.findByRole('button',{name:/Gerçek kasa/});expect(within(cash).getByText('99.380 DZD')).toBeInTheDocument();
 expect(screen.getByText(/Tüm tahsilatlar gerçekleşirse senaryo: 392.410 DZD/)).toBeInTheDocument();
 fireEvent.click(cash);expect(within(screen.getByRole('dialog')).getByText('CashAccount/CashTransaction #18')).toBeInTheDocument();
 expect(apiGet).toHaveBeenCalledWith('/dashboard/business-position?');
})
