import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { apiDelete, apiGet, apiPatch, apiRequest } from '../data/api'

interface Employee {
  id: number
  userId: number | null
  externalCode: string | null
  name: string
  isActive: boolean
  monthlySalaryGross: number | null
  salaryCurrency: string
  salaryReviewRequired: boolean
  createdAt: string
}

type WorkPlan = { id: number; employeeId: number; workDate: string; shiftId?: number; machineId?: number; taskType?: string; notes?: string; status: string; employee: { id: number; name: string }; shift?: { id: number; name: string; startTime: string; endTime: string } }
type WorkShift = { id: number; name: string; startTime: string; endTime: string; sortOrder: number }
const today = new Date().toISOString().slice(0, 10)
const taskLabels: Record<string, string> = { MACHINE_OPERATOR: 'Makine Operatörü', PRODUCTION: 'Üretim', PACKAGING: 'Paketleme', WAREHOUSE: 'Depo', DELIVERY: 'Teslimat', ACCOUNTING: 'Muhasebe', GENERAL: 'Genel' }
const statusLabels: Record<string, string> = { PLANNED: 'Planlandı', PRESENT: 'İşte', COMPLETED: 'Tamamlandı', ABSENT: 'Gelmedi', ON_LEAVE: 'İzinli', SICK_LEAVE: 'Raporlu', CANCELLED: 'İptal' }

export function UsersModule() {
  const [users, setUsers] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tab, setTab] = useState<'team' | 'daily' | 'plan' | 'leave' | 'weekly'>('team')
  const [view, setView] = useState<'daily' | 'weekly'>('daily')
  const [selectedDate, setSelectedDate] = useState(today)
  const [plans, setPlans] = useState<WorkPlan[]>([])
  const [todayPlans, setTodayPlans] = useState<WorkPlan[]>([])
  const [shifts, setShifts] = useState<WorkShift[]>([])
  const [planOpen, setPlanOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<WorkPlan | null>(null)

  const loadUsers = () => {
    apiGet<Employee[]>('/employees')
      .then(setUsers)
      .catch(() => setError('Çalışanlar alınamadı.'))
  }

  useEffect(() => {
    loadUsers()
    apiGet<WorkShift[]>('/employee-work-plans/shifts').then(setShifts).catch(() => undefined)
    apiGet<WorkPlan[]>(`/employee-work-plans/daily?date=${today}`).then(setTodayPlans).catch(() => undefined)
  }, [])

  const loadPlans = () => {
    const mode = tab === 'weekly' ? 'weekly' : view
    const path = mode === 'daily' ? `/employee-work-plans/daily?date=${selectedDate}` : `/employee-work-plans/weekly?startDate=${selectedDate}`
    apiGet<WorkPlan[]>(path).then(setPlans).catch(() => setError('Çalışma planı alınamadı.'))
  }
  useEffect(() => { if (tab !== 'team') loadPlans() }, [tab, view, selectedDate])

  const filtered = useMemo(() => {
    const query = search.toLocaleLowerCase('tr-TR')
    return users.filter((user) =>
      [user.name, user.externalCode ?? '']
        .some((value) => value.toLocaleLowerCase('tr-TR').includes(query)),
    )
  }, [search, users])
  const knownSalaryTotal = useMemo(
    () => users.reduce((sum, user) => sum + (user.monthlySalaryGross ?? 0), 0),
    [users],
  )
  const weeklyDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${selectedDate}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + index)
    return date.toISOString().slice(0, 10)
  }), [selectedDate])

  const submitPlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setError(''); setIsSubmitting(true)
    const payload = { employeeId: Number(form.get('employeeId')), workDate: form.get('workDate'), shiftId: form.get('shiftId') ? Number(form.get('shiftId')) : undefined, machineId: form.get('machineId') ? Number(form.get('machineId')) : undefined, taskType: form.get('taskType'), status: form.get('status'), notes: form.get('notes') }
    try {
      if (editingPlan) await apiPatch(`/employee-work-plans/${editingPlan.id}`, payload)
      else await apiRequest('/employee-work-plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setPlanOpen(false); setEditingPlan(null); loadPlans()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Plan kaydedilemedi.') }
    finally { setIsSubmitting(false) }
  }

  return (
    <>
      <div className="module-tabs">
        <button className={tab === 'team' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('team')}>Personeller</button>
        <button className={tab === 'daily' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('daily')}>Günlük Çalışma</button>
        <button className={tab === 'plan' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('plan')}>Vardiya Planı</button>
        <button className={tab === 'leave' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('leave')}>İzin / Devamsızlık</button>
        <button className={tab === 'weekly' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('weekly')}>Haftalık Plan</button>
      </div>
      {tab === 'team' ? <><ModuleSummary
        items={[
          { label: 'Toplam Personel', value: String(users.length) },
          { label: 'Aktif', value: String(users.filter((user) => user.isActive).length) },
          { label: 'Aylık Maaş Toplamı', value: `${knownSalaryTotal.toLocaleString('tr-TR')} DZD` },
          { label: 'İnceleme Gereken', value: String(users.filter((user) => user.salaryReviewRequired).length) },
        ]}
      />

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>TRIKOMEX Çalışanları</h2>
        </div>
        <ModuleToolbar
          reportType="personnel"
          reportLabel="Personel Raporu"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Personel ara..."
        />
        {error && <p className="demo-notice">{error}</p>}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ad</th>
                <th>Personel Kodu</th>
                <th>Aylık Maaş</th>
                <th>Bugünkü Vardiya</th>
                <th>Bugünkü Durum</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const currentPlan = todayPlans.find((plan) => plan.employeeId === user.id)
                return (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.externalCode ?? 'KOD YOK'}</td>
                  <td>{user.monthlySalaryGross === null ? 'İnceleme gerekiyor' : `${user.monthlySalaryGross.toLocaleString('tr-TR')} ${user.salaryCurrency}`}</td>
                  <td>{currentPlan?.shift ? `${currentPlan.shift.name} · ${currentPlan.shift.startTime}–${currentPlan.shift.endTime}` : 'Planlanmadı'}</td>
                  <td>{currentPlan ? statusLabels[currentPlan.status] ?? currentPlan.status : '—'}</td>
                </tr>
              )})}
              {!error && filtered.length === 0 && (
                <tr><td colSpan={5}>Henüz personel bulunmuyor.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section></> : <section className="panel panel--full workforce-panel">
        <div className="panel__header workforce-header"><div><h2>Personel Çalışma Planı</h2><p>Günlük ve haftalık vardiya atamaları</p></div><button className="btn btn--primary" onClick={() => { setEditingPlan(null); setPlanOpen(true) }}>+ Plan Ekle</button></div>
        <div className="workforce-toolbar">
          <div className="view-switch"><button className={view === 'daily' ? 'active' : ''} onClick={() => setView('daily')}>Günlük</button><button className={view === 'weekly' ? 'active' : ''} onClick={() => setView('weekly')}>Haftalık</button></div>
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </div>
        {error && <p className="demo-notice">{error}</p>}
        {tab === 'daily' && <div className="shift-board">{shifts.map((shift) => <div className="shift-column" key={shift.id}><h3>{shift.name}<small>{shift.startTime}–{shift.endTime}</small></h3>{plans.filter((plan) => plan.shiftId === shift.id).map((plan) => <article className="shift-card" key={plan.id}><strong>{plan.employee.name}</strong><span>{taskLabels[plan.taskType ?? ''] ?? 'Görev belirtilmedi'}{plan.machineId ? ` · Makine ${plan.machineId}` : ''}</span><em>{statusLabels[plan.status] ?? plan.status}</em>{plan.notes && <small>{plan.notes}</small>}</article>)}{!plans.some((plan) => plan.shiftId === shift.id) && <p className="empty-shift">Atama yok</p>}</div>)}</div>}
        {tab === 'weekly' && <div className="weekly-plan table-wrap"><table className="data-table"><thead><tr><th>Personel</th>{weeklyDays.map((day) => <th key={day}>{new Date(`${day}T12:00:00Z`).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric' })}</th>)}</tr></thead><tbody>{users.filter((user) => user.isActive).map((user) => <tr key={user.id}><td><strong>{user.name}</strong></td>{weeklyDays.map((day) => { const plan = plans.find((item) => item.employeeId === user.id && item.workDate.slice(0, 10) === day); return <td key={day}>{plan ? <span className={`work-status work-status--${plan.status.toLowerCase()}`}>{plan.status === 'ON_LEAVE' ? 'İzin' : plan.status === 'ABSENT' ? 'Devamsız' : plan.shift?.name ?? statusLabels[plan.status]}</span> : 'Boş'}</td> })}</tr>)}</tbody></table></div>}
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Tarih</th><th>Personel</th><th>Vardiya</th><th>Görev</th><th>Makine</th><th>Durum</th><th>Not</th><th></th></tr></thead><tbody>
          {plans.filter((plan) => tab !== 'leave' || ['ABSENT', 'ON_LEAVE', 'SICK_LEAVE'].includes(plan.status)).map((plan) => <tr key={plan.id}><td>{new Date(plan.workDate).toLocaleDateString('tr-TR')}</td><td><strong>{plan.employee.name}</strong></td><td>{plan.shift ? `${plan.shift.name} · ${plan.shift.startTime}–${plan.shift.endTime}` : 'Belirtilmedi'}</td><td>{taskLabels[plan.taskType ?? ''] ?? 'Belirtilmedi'}</td><td>{plan.machineId ? `Makine ${plan.machineId}` : '—'}</td><td><span className={`work-status work-status--${plan.status.toLowerCase()}`}>{statusLabels[plan.status] ?? plan.status}</span></td><td>{plan.notes || '—'}</td><td className="row-actions"><button onClick={() => { setEditingPlan(plan); setPlanOpen(true) }}>Düzenle</button><button onClick={async () => { await apiDelete(`/employee-work-plans/${plan.id}`); loadPlans() }}>Sil</button></td></tr>)}
          {!plans.length && <tr><td colSpan={8}>Bu dönem için çalışma planı bulunmuyor.</td></tr>}
        </tbody></table></div>
      </section>}

      <Modal open={planOpen} title={editingPlan ? 'Çalışma Planını Düzenle' : 'Yeni Çalışma Planı'} onClose={() => { setPlanOpen(false); setEditingPlan(null) }}>
        <form className="demo-form" onSubmit={submitPlan} key={editingPlan?.id ?? 'new'}>
          <label>Personel<select name="employeeId" defaultValue={editingPlan?.employeeId} required>{users.filter((user) => user.isActive).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
          <label>Tarih<input name="workDate" type="date" defaultValue={editingPlan?.workDate.slice(0, 10) ?? selectedDate} required /></label>
          <label>Vardiya<select name="shiftId" defaultValue={editingPlan?.shiftId ?? ''}><option value="">Belirtilmedi</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} · {shift.startTime}–{shift.endTime}</option>)}</select></label>
          <label>Görev<select name="taskType" defaultValue={editingPlan?.taskType ?? 'GENERAL'}>{Object.entries(taskLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Makine numarası<input name="machineId" type="number" min="1" defaultValue={editingPlan?.machineId} placeholder="Opsiyonel" /></label>
          <label>Durum<select name="status" defaultValue={editingPlan?.status ?? 'PLANNED'}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Not<textarea name="notes" maxLength={500} defaultValue={editingPlan?.notes} /></label>
          <div className="form-actions"><button type="button" className="btn btn--ghost" onClick={() => setPlanOpen(false)}>Vazgeç</button><button type="submit" className="btn btn--primary" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}</button></div>
        </form>
      </Modal>
    </>
  )
}
