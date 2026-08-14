import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { apiDelete, apiGet, apiPatch, apiRequest } from '../data/api'
import { useI18n } from '../i18n/I18nProvider'

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
const TASKS = ['MACHINE_OPERATOR', 'PRODUCTION', 'PACKAGING', 'WAREHOUSE', 'DELIVERY', 'ACCOUNTING', 'GENERAL']
const STATUSES = ['PLANNED', 'PRESENT', 'COMPLETED', 'ABSENT', 'ON_LEAVE', 'SICK_LEAVE', 'CANCELLED']

export function UsersModule() {
  const { locale, t, formatCurrency, formatDate } = useI18n()
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

  const loadUsers = useCallback(() => {
    apiGet<Employee[]>('/employees')
      .then(setUsers)
      .catch(() => setError(t('workforce.loadError')))
  }, [t])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadUsers()
      apiGet<WorkShift[]>('/employee-work-plans/shifts').then(setShifts).catch(() => undefined)
      apiGet<WorkPlan[]>(`/employee-work-plans/daily?date=${today}`).then(setTodayPlans).catch(() => undefined)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadUsers])

  const loadPlans = useCallback(() => {
    const mode = tab === 'weekly' ? 'weekly' : view
    const path = mode === 'daily' ? `/employee-work-plans/daily?date=${selectedDate}` : `/employee-work-plans/weekly?startDate=${selectedDate}`
    apiGet<WorkPlan[]>(path).then(setPlans).catch(() => setError(t('workforce.planLoadError')))
  }, [selectedDate, t, tab, view])
  useEffect(() => {
    if (tab === 'team') return
    const timer = window.setTimeout(loadPlans, 0)
    return () => window.clearTimeout(timer)
  }, [loadPlans, tab])

  const filtered = useMemo(() => {
    const query = search.toLocaleLowerCase(locale)
    return users.filter((user) =>
      [user.name, user.externalCode ?? '']
        .some((value) => value.toLocaleLowerCase(locale).includes(query)),
    )
  }, [locale, search, users])
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
    } catch (caught) { setError(caught instanceof Error ? caught.message : t('workforce.planSaveError')) }
    finally { setIsSubmitting(false) }
  }

  return (
    <>
      <div className="module-tabs">
        <button className={tab === 'team' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('team')}>{t('workforce.tab.team')}</button>
        <button className={tab === 'daily' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('daily')}>{t('workforce.tab.daily')}</button>
        <button className={tab === 'plan' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('plan')}>{t('workforce.tab.plan')}</button>
        <button className={tab === 'leave' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('leave')}>{t('workforce.tab.leave')}</button>
        <button className={tab === 'weekly' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('weekly')}>{t('workforce.tab.weekly')}</button>
      </div>
      {tab === 'team' ? <><ModuleSummary
        items={[
          { label: t('workforce.total'), value: String(users.length) },
          { label: t('workforce.active'), value: String(users.filter((user) => user.isActive).length) },
          { label: t('workforce.salaryTotal'), value: formatCurrency(knownSalaryTotal, 'DZD') },
          { label: t('workforce.reviewCount'), value: String(users.filter((user) => user.salaryReviewRequired).length) },
        ]}
      />

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>{t('workforce.title')}</h2>
        </div>
        <ModuleToolbar
          reportType="personnel"
          reportLabel={t('workforce.report')}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('workforce.search')}
        />
        {error && <p className="demo-notice">{error}</p>}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('workforce.name')}</th>
                <th>{t('workforce.code')}</th>
                <th>{t('workforce.salary')}</th>
                <th>{t('workforce.shiftToday')}</th>
                <th>{t('workforce.statusToday')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const currentPlan = todayPlans.find((plan) => plan.employeeId === user.id)
                return (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.externalCode ?? t('workforce.noCode')}</td>
                  <td>{user.monthlySalaryGross === null ? t('workforce.reviewRequired') : formatCurrency(user.monthlySalaryGross, user.salaryCurrency)}</td>
                  <td>{currentPlan?.shift ? `${currentPlan.shift.name} · ${currentPlan.shift.startTime}–${currentPlan.shift.endTime}` : t('workforce.notPlanned')}</td>
                  <td>{currentPlan ? t(`workforce.status.${currentPlan.status}`) : '—'}</td>
                </tr>
              )})}
              {!error && filtered.length === 0 && (
                <tr><td colSpan={5}>{t('workforce.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section></> : <section className="panel panel--full workforce-panel">
        <div className="panel__header workforce-header"><div><h2>{t('workforce.planTitle')}</h2><p>{t('workforce.planSubtitle')}</p></div><button className="btn btn--primary" onClick={() => { setEditingPlan(null); setPlanOpen(true) }}>+ {t('workforce.addPlan')}</button></div>
        <div className="workforce-toolbar">
          <div className="view-switch"><button className={view === 'daily' ? 'active' : ''} onClick={() => setView('daily')}>{t('workforce.daily')}</button><button className={view === 'weekly' ? 'active' : ''} onClick={() => setView('weekly')}>{t('workforce.weekly')}</button></div>
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </div>
        {error && <p className="demo-notice">{error}</p>}
        {tab === 'daily' && <div className="shift-board">{shifts.map((shift) => <div className="shift-column" key={shift.id}><h3>{shift.name}<small>{shift.startTime}–{shift.endTime}</small></h3>{plans.filter((plan) => plan.shiftId === shift.id).map((plan) => <article className="shift-card" key={plan.id}><strong>{plan.employee.name}</strong><span>{plan.taskType ? t(`workforce.task.${plan.taskType}`) : t('workforce.taskMissing')}{plan.machineId ? ` · ${t('workforce.machine', { number: plan.machineId })}` : ''}</span><em>{t(`workforce.status.${plan.status}`)}</em>{plan.notes && <small>{plan.notes}</small>}</article>)}{!plans.some((plan) => plan.shiftId === shift.id) && <p className="empty-shift">{t('workforce.noAssignment')}</p>}</div>)}</div>}
        {tab === 'weekly' && <div className="weekly-plan table-wrap"><table className="data-table"><thead><tr><th>{t('workforce.employee')}</th>{weeklyDays.map((day) => <th key={day}>{formatDate(`${day}T12:00:00Z`, { weekday: 'short', day: 'numeric' })}</th>)}</tr></thead><tbody>{users.filter((user) => user.isActive).map((user) => <tr key={user.id}><td><strong>{user.name}</strong></td>{weeklyDays.map((day) => { const plan = plans.find((item) => item.employeeId === user.id && item.workDate.slice(0, 10) === day); return <td key={day}>{plan ? <span className={`work-status work-status--${plan.status.toLowerCase()}`}>{plan.shift?.name ?? t(`workforce.status.${plan.status}`)}</span> : t('workforce.emptySlot')}</td> })}</tr>)}</tbody></table></div>}
        <div className="table-wrap"><table className="data-table"><thead><tr><th>{t('workforce.date')}</th><th>{t('workforce.employee')}</th><th>{t('workforce.shift')}</th><th>{t('workforce.task')}</th><th>{t('workforce.machineTitle')}</th><th>{t('workforce.status')}</th><th>{t('workforce.note')}</th><th></th></tr></thead><tbody>
          {plans.filter((plan) => tab !== 'leave' || ['ABSENT', 'ON_LEAVE', 'SICK_LEAVE'].includes(plan.status)).map((plan) => <tr key={plan.id}><td>{formatDate(plan.workDate)}</td><td><strong>{plan.employee.name}</strong></td><td>{plan.shift ? `${plan.shift.name} · ${plan.shift.startTime}–${plan.shift.endTime}` : t('workforce.unspecified')}</td><td>{plan.taskType ? t(`workforce.task.${plan.taskType}`) : t('workforce.unspecified')}</td><td>{plan.machineId ? t('workforce.machine', { number: plan.machineId }) : '—'}</td><td><span className={`work-status work-status--${plan.status.toLowerCase()}`}>{t(`workforce.status.${plan.status}`)}</span></td><td>{plan.notes || '—'}</td><td className="row-actions"><button onClick={() => { setEditingPlan(plan); setPlanOpen(true) }}>{t('workforce.edit')}</button><button onClick={async () => { await apiDelete(`/employee-work-plans/${plan.id}`); loadPlans() }}>{t('workforce.delete')}</button></td></tr>)}
          {!plans.length && <tr><td colSpan={8}>{t('workforce.noPlans')}</td></tr>}
        </tbody></table></div>
      </section>}

      <Modal open={planOpen} title={editingPlan ? t('workforce.editPlan') : t('workforce.newPlan')} onClose={() => { setPlanOpen(false); setEditingPlan(null) }}>
        <form className="demo-form" onSubmit={submitPlan} key={editingPlan?.id ?? 'new'}>
          <label>{t('workforce.employee')}<select name="employeeId" defaultValue={editingPlan?.employeeId} required>{users.filter((user) => user.isActive).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
          <label>{t('workforce.date')}<input name="workDate" type="date" defaultValue={editingPlan?.workDate.slice(0, 10) ?? selectedDate} required /></label>
          <label>{t('workforce.shift')}<select name="shiftId" defaultValue={editingPlan?.shiftId ?? ''}><option value="">{t('workforce.unspecified')}</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} · {shift.startTime}–{shift.endTime}</option>)}</select></label>
          <label>{t('workforce.task')}<select name="taskType" defaultValue={editingPlan?.taskType ?? 'GENERAL'}>{TASKS.map((value) => <option key={value} value={value}>{t(`workforce.task.${value}`)}</option>)}</select></label>
          <label>{t('workforce.machineNumber')}<input name="machineId" type="number" min="1" defaultValue={editingPlan?.machineId} placeholder={t('workforce.optional')} /></label>
          <label>{t('workforce.status')}<select name="status" defaultValue={editingPlan?.status ?? 'PLANNED'}>{STATUSES.map((value) => <option key={value} value={value}>{t(`workforce.status.${value}`)}</option>)}</select></label>
          <label>{t('workforce.note')}<textarea name="notes" maxLength={500} defaultValue={editingPlan?.notes} /></label>
          <div className="form-actions"><button type="button" className="btn btn--ghost" onClick={() => setPlanOpen(false)}>{t('common.cancel')}</button><button type="submit" className="btn btn--primary" disabled={isSubmitting}>{isSubmitting ? t('workforce.saving') : t('common.save')}</button></div>
        </form>
      </Modal>
    </>
  )
}
