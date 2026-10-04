import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DailyEntryPanel, type DailyReview } from './DailyEntryPanel'
const { apiPost }=vi.hoisted(()=>({apiPost:vi.fn()}))
vi.mock('../data/api',()=>({apiPost}))
vi.mock('../i18n/I18nProvider',()=>({useI18n:()=>({t:(s:string)=>s})}))
const initial:DailyReview={draft:{kind:'employee.salary',sourceText:"Hamid's salary is 40,000 DZD",date:'2026-10-04',name:'Hamid',amount:40000,currency:'DZD'},title:'Personel maaş tanımı',fields:['name','amount','currency'],choices:{},errors:[],lines:['Hamid 40000 DZD','Maaş borcu oluşturulmaz.'],ready:true}
beforeEach(()=>vi.resetAllMocks());afterEach(cleanup)
it('requires a server preview and invalidates it when the salary changes',async()=>{
 apiPost.mockResolvedValue({...initial,previewToken:'immutable-token'});render(<DailyEntryPanel initial={initial}/>);
 expect(screen.getByRole('button',{name:'Onayla ve kaydet'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Kontrol et ve önizle'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Onayla ve kaydet'})).toBeEnabled());
 expect(apiPost).toHaveBeenCalledWith('/ai/daily/preview',initial.draft);
 fireEvent.change(screen.getByLabelText('Tutar / kaynak toplamı'),{target:{value:'45000'}});
 expect(screen.getByRole('button',{name:'Onayla ve kaydet'})).toBeDisabled();
})
it('sends only the immutable token after explicit confirmation and refreshes records',async()=>{
 apiPost.mockResolvedValueOnce({...initial,previewToken:'immutable-token'}).mockResolvedValueOnce({applied:true,answer:'Personel kaydedildi; maaş borcu oluşturulmadı.'});
 const refresh=vi.fn();render(<DailyEntryPanel initial={initial} onRefresh={refresh}/>);
 fireEvent.click(screen.getByRole('button',{name:'Kontrol et ve önizle'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Onayla ve kaydet'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Onayla ve kaydet'}));
 fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:'Onayla ve kaydet'}));
 await screen.findByText('Personel kaydedildi; maaş borcu oluşturulmadı.');
 expect(apiPost).toHaveBeenLastCalledWith('/ai/daily/confirm',{previewToken:'immutable-token'});expect(refresh).toHaveBeenCalledOnce();
})
