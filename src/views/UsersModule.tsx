import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { apiDelete, apiGet, apiPatch, apiPost, apiRequest, apiUpload } from '../data/api'
import { roleLabels, type AppUserRole } from '../data/roles'

type UserRole = AppUserRole
type TeamTab = 'accounts' | 'salary' | 'advances' | 'leave'

interface LeaveSummary {
  entitlementDays: number
  usedDays: number
  remainingDays: number
  accruedDaysYtd: number
  accrualPerMonth: number
  statutoryAnnualDays: number
  hireDate: string | null
}

interface SalaryPreview {
  currency: string
  gross: number
  socialRatePercent: number
  socialDeduction: number
  otherDeduction: number
  estimatedNet: number
  assumptions: string[]
}

interface CompanyUser {
  id: number
  name: string
  email: string | null
  role: UserRole
  isActive: boolean
  createdAt: string
  monthlySalaryGross: number | null
  annualLeaveEntitlement: number
  usedLeaveDays: number
  hireDate: string | null
  leave: LeaveSummary
  salaryPreview: SalaryPreview | null
}

interface SalaryImportResult {
  periodLabel: string | null
  sheetName: string
  parsedRows: number
  updatedCount: number
  unmatchedCount: number
  ambiguousCount: number
  skippedCount: number
  updated: Array<{
    userId: number
    userName: string
    excelName: string
    monthlySalaryGross: number
    matchedBy: 'email' | 'name' | 'name-fuzzy'
  }>
  unmatched: Array<{
    excelName: string
    monthlySalaryGross: number
    rowNumber: number
  }>
  ambiguous: Array<{
    excelName: string
    monthlySalaryGross: number
    candidates: string[]
    rowNumber: number
  }>
  skipped: Array<{ rowNumber: number; name: string | null; reason: string }>
  note?: string
}

interface PayrollAdjustment {
  id: number
  userId: number
  type: 'ADVANCE' | 'DEDUCTION'
  amount: number
  currency: string
  occurredAt: string
  period: string | null
  note: string | null
  cashTransactionId: number | null
  postedToCash: boolean
  user?: { id: number; name: string }
}

interface PayrollPeriodSummary {
  currency: string
  userId: number
  userName: string
  period: string
  gross: number | null
  socialRatePercent: number
  socialDeduction: number | null
  advancesTotal: number
  deductionsTotal: number
  salaryCutFromAdvances: number
  estimatedNet: number | null
  assumptions: string[]
}

const DEFAULT_SOCIAL_RATE = 9

function currentPeriodAlgiers(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Algiers',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((p) => p.type === 'year')?.value ?? '2026'
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${year}-${month}`
}

function todayInputAlgiers(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Algiers',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function formatDzd(value: number): string {
  return `${value.toLocaleString('fr-DZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} DZD`
}

function parseNum(value: string): number {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : NaN
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function estimateNet(
  gross: number,
  socialRatePercent: number,
  advances: number,
  otherDeduction: number,
) {
  const socialDeduction = round2(gross * (socialRatePercent / 100))
  const estimatedNet = round2(gross - socialDeduction - advances - otherDeduction)
  return { socialDeduction, estimatedNet }
}

function hireDateInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

/** Stabilization seed login — hide from salary & leave calc lists only (not accounts). */
function isSeedCompanyAdminAccount(user: Pick<CompanyUser, 'name' | 'email'>): boolean {
  const name = user.name.trim().toLocaleLowerCase('tr-TR')
  const email = (user.email ?? '').trim().toLowerCase()
  // Exact seed identity only — do not match every name containing "Admin".
  return name === 'trikomex admin' || email === 'admin@trikomex.com'
}

export function UsersModule() {
  const [tab, setTab] = useState<TeamTab>('accounts')
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [salaryUserId, setSalaryUserId] = useState<number | ''>('')
  const [grossInput, setGrossInput] = useState('')
  const [socialRateInput, setSocialRateInput] = useState(String(DEFAULT_SOCIAL_RATE))
  const [otherDeductionInput, setOtherDeductionInput] = useState('0')
  const [salaryPeriod, setSalaryPeriod] = useState(currentPeriodAlgiers())
  const [periodSummary, setPeriodSummary] = useState<PayrollPeriodSummary | null>(null)
  const [savingSalary, setSavingSalary] = useState(false)
  const [importingSalary, setImportingSalary] = useState(false)
  const [importResult, setImportResult] = useState<SalaryImportResult | null>(null)

  const [advances, setAdvances] = useState<PayrollAdjustment[]>([])
  const [advUserId, setAdvUserId] = useState<number | ''>('')
  const [advAmount, setAdvAmount] = useState('')
  const [advDate, setAdvDate] = useState(todayInputAlgiers())
  const [advPeriod, setAdvPeriod] = useState(currentPeriodAlgiers())
  const [advNote, setAdvNote] = useState('')
  const [advPostToCash, setAdvPostToCash] = useState(false)
  const [savingAdvance, setSavingAdvance] = useState(false)

  const [deductUserId, setDeductUserId] = useState<number | ''>('')
  const [deductAmount, setDeductAmount] = useState('')
  const [deductNote, setDeductNote] = useState('')
  const [savingDeduction, setSavingDeduction] = useState(false)

  const [leaveEditUser, setLeaveEditUser] = useState<CompanyUser | null>(null)
  const [leaveEntitlement, setLeaveEntitlement] = useState('30')
  const [leaveUsed, setLeaveUsed] = useState('0')
  const [leaveHireDate, setLeaveHireDate] = useState('')
  const [savingLeave, setSavingLeave] = useState(false)

  const loadUsers = () => {
    apiGet<CompanyUser[]>('/users')
      .then((data) => {
        setUsers(data)
        setError('')
      })
      .catch(() => setError('Kullanıcılar alınamadı.'))
  }

  const loadAdvances = () => {
    const params = new URLSearchParams({ type: 'ADVANCE', limit: '50' })
    if (advPeriod.trim()) params.set('period', advPeriod.trim())
    apiGet<PayrollAdjustment[]>(`/users/hr/payroll-adjustments?${params}`)
      .then((data) => setAdvances(data))
      .catch(() => setError('Avans listesi alınamadı.'))
  }

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    if (tab === 'advances') loadAdvances()
  }, [tab, advPeriod])

  useEffect(() => {
    if (salaryUserId === '' || !salaryPeriod.trim()) {
      setPeriodSummary(null)
      return
    }
    const socialRate = parseNum(socialRateInput)
    const rateQ =
      Number.isFinite(socialRate) && !Number.isNaN(socialRate)
        ? `&socialRatePercent=${encodeURIComponent(String(socialRate))}`
        : ''
    apiGet<PayrollPeriodSummary>(
      `/users/hr/payroll-summary?userId=${salaryUserId}&period=${encodeURIComponent(salaryPeriod)}${rateQ}`,
    )
      .then((data) => setPeriodSummary(data))
      .catch(() => setPeriodSummary(null))
  }, [salaryUserId, salaryPeriod, socialRateInput, tab, advances])

  useEffect(() => {
    if (salaryUserId === '') return
    const selected = users.find((u) => u.id === salaryUserId)
    if (!selected) return
    setGrossInput(
      selected.monthlySalaryGross === null || selected.monthlySalaryGross === undefined
        ? ''
        : String(selected.monthlySalaryGross),
    )
  }, [salaryUserId, users])

  const filtered = useMemo(() => {
    const query = search.toLocaleLowerCase('tr-TR')
    return users.filter((user) =>
      [user.name, user.email ?? '', roleLabels[user.role]].some((value) =>
        value.toLocaleLowerCase('tr-TR').includes(query),
      ),
    )
  }, [search, users])

  /** Salary / leave calc lists — excludes seed company admin account. */
  const calcUsers = useMemo(
    () => users.filter((user) => !isSeedCompanyAdminAccount(user)),
    [users],
  )

  useEffect(() => {
    if (salaryUserId === '') return
    if (!calcUsers.some((user) => user.id === salaryUserId)) {
      setSalaryUserId('')
    }
  }, [calcUsers, salaryUserId])

  const salaryLive = useMemo(() => {
    const gross = parseNum(grossInput)
    const socialRate = parseNum(socialRateInput)
    const otherManual = parseNum(otherDeductionInput || '0')
    if ([gross, socialRate, otherManual].some((n) => Number.isNaN(n)) || gross < 0) {
      return null
    }
    const advancesCut = periodSummary?.salaryCutFromAdvances ?? 0
    const recordedOther = periodSummary?.deductionsTotal ?? 0
    const other = round2(otherManual + recordedOther)
    const { socialDeduction, estimatedNet } = estimateNet(
      gross,
      socialRate,
      advancesCut,
      other,
    )
    return {
      gross,
      socialRate,
      advancesCut,
      other,
      recordedOther,
      otherManual,
      socialDeduction,
      estimatedNet,
    }
  }, [grossInput, socialRateInput, otherDeductionInput, periodSummary])

  const leaveTotals = useMemo(() => {
    // Only sum balances for users with real leave tracking (hire date or used days).
    // Default entitlement leftovers (e.g. 5×30) must not inflate the summary.
    const remainingSum = calcUsers.reduce((sum, u) => {
      const tracked = Boolean(u.hireDate) || (u.usedLeaveDays ?? 0) > 0
      if (!tracked) return sum
      return sum + (u.leave?.remainingDays ?? 0)
    }, 0)
    const usedSum = calcUsers.reduce((sum, u) => sum + (u.usedLeaveDays ?? 0), 0)
    const withSalary = calcUsers.filter((u) => u.monthlySalaryGross != null).length
    const salaryGrossSum = calcUsers.reduce(
      (sum, u) => sum + (u.monthlySalaryGross ?? 0),
      0,
    )
    return { remainingSum, usedSum, withSalary, salaryGrossSum }
  }, [calcUsers])

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError('')
    setNotice('')
    setIsSubmitting(true)

    const salaryRaw = String(form.get('monthlySalaryGross') ?? '').trim()
    const leaveRaw = String(form.get('annualLeaveEntitlement') ?? '').trim()
    const monthlySalaryGross = salaryRaw === '' ? undefined : parseNum(salaryRaw)
    const annualLeaveEntitlement = leaveRaw === '' ? 30 : parseNum(leaveRaw)

    if (monthlySalaryGross !== undefined && (Number.isNaN(monthlySalaryGross) || monthlySalaryGross < 0)) {
      setError('Brüt maaş geçerli bir sayı olmalıdır (DZD).')
      setIsSubmitting(false)
      return
    }
    if (Number.isNaN(annualLeaveEntitlement) || annualLeaveEntitlement < 0) {
      setError('Yıllık izin günü geçerli bir sayı olmalıdır.')
      setIsSubmitting(false)
      return
    }

    try {
      await apiRequest<CompanyUser>('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
          role: form.get('role') || 'MEMBER',
          ...(monthlySalaryGross !== undefined ? { monthlySalaryGross } : {}),
          annualLeaveEntitlement: Math.round(annualLeaveEntitlement),
        }),
      })
      setFormOpen(false)
      setNotice('Çalışan hesabı oluşturuldu.')
      loadUsers()
    } catch {
      setError('Kullanıcı oluşturulamadı. E-posta veya parola kurallarını kontrol edin.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const saveSalary = async () => {
    if (salaryUserId === '') {
      setError('Maaş kaydı için bir çalışan seçin.')
      return
    }
    const gross = parseNum(grossInput)
    if (Number.isNaN(gross) || gross < 0) {
      setError('Geçerli bir brüt maaş girin.')
      return
    }
    setSavingSalary(true)
    setError('')
    setNotice('')
    try {
      await apiPatch<CompanyUser>(`/users/${salaryUserId}`, {
        monthlySalaryGross: gross,
      })
      setNotice('Brüt maaş kaydedildi (DZD).')
      loadUsers()
    } catch {
      setError('Maaş kaydedilemedi.')
    } finally {
      setSavingSalary(false)
    }
  }

  const importSalaryExcel = async (file: File | null) => {
    if (!file) return
    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      setError('Yalnızca .xlsx / .xls dosyaları yükleyebilirsiniz.')
      return
    }
    setImportingSalary(true)
    setError('')
    setNotice('')
    setImportResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const result = await apiUpload<SalaryImportResult>('/users/hr/import-salary', form)
      setImportResult(result)
      const period = result.periodLabel ? ` (${result.periodLabel})` : ''
      setNotice(
        `Excel içe aktarıldı${period}: ${result.updatedCount} güncellendi` +
          (result.unmatchedCount ? `, ${result.unmatchedCount} eşleşmedi` : '') +
          (result.ambiguousCount ? `, ${result.ambiguousCount} belirsiz` : '') +
          '.',
      )
      loadUsers()
    } catch {
      setError('Excel içe aktarılamadı. Dosya biçimini ve yetkinizi kontrol edin.')
    } finally {
      setImportingSalary(false)
    }
  }

  const openLeaveEdit = (user: CompanyUser) => {
    setLeaveEditUser(user)
    setLeaveEntitlement(String(user.annualLeaveEntitlement ?? 30))
    setLeaveUsed(String(user.usedLeaveDays ?? 0))
    setLeaveHireDate(hireDateInputValue(user.hireDate))
    setError('')
  }

  const submitAdvance = async (event: FormEvent) => {
    event.preventDefault()
    if (advUserId === '') {
      setError('Avans için bir çalışan seçin.')
      return
    }
    const amount = parseNum(advAmount)
    if (Number.isNaN(amount) || amount <= 0) {
      setError('Geçerli bir avans tutarı girin.')
      return
    }
    if (!advDate.trim()) {
      setError('Avans tarihi gerekli.')
      return
    }
    setSavingAdvance(true)
    setError('')
    setNotice('')
    try {
      await apiPost<PayrollAdjustment>('/users/hr/payroll-adjustments', {
        userId: advUserId,
        type: 'ADVANCE',
        amount,
        occurredAt: new Date(`${advDate}T12:00:00`).toISOString(),
        period: advPeriod.trim() || undefined,
        note: advNote.trim() || undefined,
        postToCash: advPostToCash,
      })
      setAdvAmount('')
      setAdvNote('')
      setAdvPostToCash(false)
      setNotice(
        advPostToCash
          ? 'Avans kaydedildi ve kasaya yazıldı. Maaş netinden düşülecek.'
          : 'Avans kaydedildi. Maaş ödenirken bu tutar netten kesilir.',
      )
      loadAdvances()
    } catch {
      setError(
        advPostToCash
          ? 'Avans kaydedilemedi. Kasa bakiyesi veya yetkiyi kontrol edin.'
          : 'Avans kaydedilemedi.',
      )
    } finally {
      setSavingAdvance(false)
    }
  }

  const submitOtherDeduction = async (event: FormEvent) => {
    event.preventDefault()
    if (deductUserId === '') {
      setError('Kesinti için bir çalışan seçin.')
      return
    }
    const amount = parseNum(deductAmount)
    if (Number.isNaN(amount) || amount <= 0) {
      setError('Geçerli bir kesinti tutarı girin.')
      return
    }
    setSavingDeduction(true)
    setError('')
    setNotice('')
    try {
      await apiPost<PayrollAdjustment>('/users/hr/payroll-adjustments', {
        userId: deductUserId,
        type: 'DEDUCTION',
        amount,
        occurredAt: new Date().toISOString(),
        period: salaryPeriod.trim() || currentPeriodAlgiers(),
        note: deductNote.trim() || undefined,
        postToCash: false,
      })
      setDeductAmount('')
      setDeductNote('')
      setNotice('Diğer kesinti kaydedildi (avans dışı).')
      if (salaryUserId === deductUserId) {
        setPeriodSummary(null)
        const socialRate = parseNum(socialRateInput)
        const rateQ =
          Number.isFinite(socialRate) && !Number.isNaN(socialRate)
            ? `&socialRatePercent=${encodeURIComponent(String(socialRate))}`
            : ''
        const data = await apiGet<PayrollPeriodSummary>(
          `/users/hr/payroll-summary?userId=${deductUserId}&period=${encodeURIComponent(salaryPeriod)}${rateQ}`,
        )
        setPeriodSummary(data)
      }
    } catch {
      setError('Kesinti kaydedilemedi.')
    } finally {
      setSavingDeduction(false)
    }
  }

  const removeAdvance = async (id: number) => {
    if (!window.confirm('Bu avans kaydını silmek istiyor musunuz?')) return
    setError('')
    setNotice('')
    try {
      await apiDelete(`/users/hr/payroll-adjustments/${id}`)
      setNotice('Avans kaydı silindi.')
      loadAdvances()
    } catch {
      setError('Avans silinemedi. Kasaya yazılmış kayıtlar silinemez.')
    }
  }

  const saveLeave = async (event: FormEvent) => {
    event.preventDefault()
    if (!leaveEditUser) return
    const entitlement = parseNum(leaveEntitlement)
    const used = parseNum(leaveUsed)
    if (Number.isNaN(entitlement) || Number.isNaN(used) || entitlement < 0 || used < 0) {
      setError('İzin günleri geçerli sayı olmalıdır.')
      return
    }
    setSavingLeave(true)
    setError('')
    setNotice('')
    try {
      await apiPatch<CompanyUser>(`/users/${leaveEditUser.id}`, {
        annualLeaveEntitlement: Math.round(entitlement),
        usedLeaveDays: used,
        hireDate: leaveHireDate.trim() ? leaveHireDate : null,
      })
      setLeaveEditUser(null)
      setNotice('İzin bakiyesi güncellendi.')
      loadUsers()
    } catch {
      setError('İzin bakiyesi kaydedilemedi.')
    } finally {
      setSavingLeave(false)
    }
  }

  return (
    <>
      <ModuleSummary
        items={[
          { label: 'Toplam Kullanıcı', value: String(users.length) },
          { label: 'Aktif', value: String(users.filter((user) => user.isActive).length) },
          { label: 'Maaşı tanımlı', value: String(leaveTotals.withSalary) },
          {
            label: 'Brüt maaş toplamı',
            value: formatDzd(leaveTotals.salaryGrossSum),
          },
          {
            label: 'Kalan izin (gün)',
            value: String(Math.round(leaveTotals.remainingSum * 10) / 10),
          },
        ]}
      />

      <section className="panel panel--full">
        <div className="panel__header team-panel-header">
          <h2>TRIKOMEX Ekibi</h2>
          <div className="team-panel-header__right">
            <div className="team-tabs" role="tablist" aria-label="Ekip bölümleri">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'accounts'}
                className={`team-tabs__btn${tab === 'accounts' ? ' is-active' : ''}`}
                onClick={() => setTab('accounts')}
              >
                Hesaplar
              </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'salary'}
              className={`team-tabs__btn${tab === 'salary' ? ' is-active' : ''}`}
              onClick={() => setTab('salary')}
            >
              Maaş
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'advances'}
              className={`team-tabs__btn${tab === 'advances' ? ' is-active' : ''}`}
              onClick={() => setTab('advances')}
            >
              Avanslar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'leave'}
              className={`team-tabs__btn${tab === 'leave' ? ' is-active' : ''}`}
              onClick={() => setTab('leave')}
            >
              İzin (Congé)
            </button>
            </div>
            <div className="panel__header-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setTab('accounts')
                  setError('')
                  setFormOpen(true)
                }}
              >
                Çalışan ekle
              </button>
            </div>
          </div>
        </div>

        {error && <p className="demo-notice">{error}</p>}
        {notice && <p className="demo-notice demo-notice--success">{notice}</p>}

        {tab === 'accounts' && (
          <>
            <ModuleToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Ad, e-posta veya rol ara..."
            />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ad</th>
                    <th>E-posta</th>
                    <th>Rol</th>
                    <th>Durum</th>
                    <th>Oluşturulma</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.email ?? '—'}</td>
                      <td>{roleLabels[user.role]}</td>
                      <td>{user.isActive ? 'Aktif' : 'Pasif'}</td>
                      <td className="date-cell">
                        {new Date(user.createdAt).toLocaleDateString('tr-TR')}
                      </td>
                    </tr>
                  ))}
                  {!error && filtered.length === 0 && (
                    <tr>
                      <td colSpan={5}>Henüz çalışan hesabı bulunmuyor.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'salary' && (
          <div className="team-calc">
            <p className="team-calc__intro">
              Basit brüt → yaklaşık net. Para birimi <strong>DZD</strong>.{' '}
              <strong>Avanslar</strong> sekmesinden girilen tutarlar bu dönemde maaştan
              kesilir. CNAS / IRG motoru değildir.
            </p>

            <div className="team-salary-import">
              <div className="team-salary-import__row">
                <div>
                  <h3 className="team-salary-import__title">Excel’den içe aktar</h3>
                  <p className="team-salary-import__hint">
                    Haziran / JUIN bordro dosyası (.xlsx). Çalışanlar e-posta veya ada göre
                    eşleştirilir; brüt maaş güncellenir.
                  </p>
                </div>
                <label className="btn btn--ghost team-salary-import__btn">
                  {importingSalary ? 'Aktarılıyor…' : 'Excel İçe Aktar'}
                  <input
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    hidden
                    disabled={importingSalary}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      event.target.value = ''
                      void importSalaryExcel(file)
                    }}
                  />
                </label>
              </div>

              {importResult && (
                <div className="team-salary-import__result" role="status">
                  <p>
                    Sayfa: <strong>{importResult.sheetName}</strong>
                    {importResult.periodLabel ? ` · ${importResult.periodLabel}` : ''}
                    {' · '}
                    {importResult.parsedRows} satır okundu · {importResult.updatedCount} güncellendi
                  </p>
                  {importResult.unmatched.length > 0 && (
                    <div>
                      <h4>Eşleşmeyenler</h4>
                      <ul>
                        {importResult.unmatched.map((row) => (
                          <li key={`${row.rowNumber}-${row.excelName}`}>
                            {row.excelName} ({formatDzd(row.monthlySalaryGross)}) — satır{' '}
                            {row.rowNumber}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {importResult.ambiguous.length > 0 && (
                    <div>
                      <h4>Belirsiz eşleşmeler</h4>
                      <ul>
                        {importResult.ambiguous.map((row) => (
                          <li key={`${row.rowNumber}-${row.excelName}`}>
                            {row.excelName} → {row.candidates.join(', ')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {importResult.updated.length > 0 && (
                    <div>
                      <h4>Güncellenenler</h4>
                      <ul>
                        {importResult.updated.map((row) => (
                          <li key={row.userId}>
                            {row.userName}
                            {row.excelName !== row.userName ? ` ← ${row.excelName}` : ''}
                            : {formatDzd(row.monthlySalaryGross)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="team-calc__grid">
              <form
                className="demo-form team-calc__form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void saveSalary()
                }}
              >
                <label>
                  Çalışan
                  <select
                    value={salaryUserId === '' ? '' : String(salaryUserId)}
                    onChange={(event) => {
                      const value = event.target.value
                      setSalaryUserId(value ? Number(value) : '')
                    }}
                  >
                    <option value="">Seçin…</option>
                    {calcUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                        {user.monthlySalaryGross != null
                          ? ` — ${formatDzd(user.monthlySalaryGross)}`
                          : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Aylık brüt maaş (DZD)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={grossInput}
                    onChange={(event) => setGrossInput(event.target.value)}
                    placeholder="örn. 85000"
                  />
                </label>
                <label>
                  Sosyal kesinti oranı (%)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={socialRateInput}
                    onChange={(event) => setSocialRateInput(event.target.value)}
                  />
                </label>
                <label>
                  Dönem (YYYY-MM)
                  <input
                    type="month"
                    value={salaryPeriod}
                    onChange={(event) => setSalaryPeriod(event.target.value)}
                  />
                </label>
                <label>
                  Diğer kesinti önizleme (DZD)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={otherDeductionInput}
                    onChange={(event) => setOtherDeductionInput(event.target.value)}
                  />
                </label>
                <div className="form-actions">
                  <button type="submit" className="btn btn--primary" disabled={savingSalary}>
                    {savingSalary ? 'Kaydediliyor…' : 'Brüt maaşı kaydet'}
                  </button>
                </div>
              </form>

              <div className="team-calc__result">
                <h3>Yaklaşık sonuç</h3>
                {salaryLive ? (
                  <dl className="team-calc__stats">
                    <div>
                      <dt>Brüt</dt>
                      <dd>{formatDzd(salaryLive.gross)}</dd>
                    </div>
                    <div>
                      <dt>Sosyal kesinti (%{salaryLive.socialRate})</dt>
                      <dd>{formatDzd(salaryLive.socialDeduction)}</dd>
                    </div>
                    <div>
                      <dt>Avans kesimi ({salaryPeriod || 'dönem'})</dt>
                      <dd>{formatDzd(salaryLive.advancesCut)}</dd>
                    </div>
                    <div>
                      <dt>Diğer kesinti</dt>
                      <dd>{formatDzd(salaryLive.other)}</dd>
                    </div>
                    <div className="team-calc__net">
                      <dt>Tahmini net</dt>
                      <dd>{formatDzd(salaryLive.estimatedNet)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="team-calc__empty">Brüt maaş girerek sonucu görün.</p>
                )}
                {periodSummary && salaryLive && salaryLive.advancesCut > 0 && (
                  <p className="team-calc__hint">
                    Bu dönemde Avanslar’dan {formatDzd(periodSummary.salaryCutFromAdvances)}{' '}
                    maaştan kesilecek.
                  </p>
                )}
              </div>
            </div>

            <div className="team-salary-import" style={{ marginTop: 20 }}>
              <h3 className="team-salary-import__title">Diğer kesinti (avans dışı)</h3>
              <p className="team-salary-import__hint">
                Gecikme, hasar vb. Avans için burayı kullanmayın — Avanslar sekmesine gidin.
              </p>
              <form className="demo-form team-calc__form" onSubmit={(e) => void submitOtherDeduction(e)}>
                <label>
                  Çalışan
                  <select
                    value={deductUserId === '' ? '' : String(deductUserId)}
                    onChange={(event) => {
                      const value = event.target.value
                      setDeductUserId(value ? Number(value) : '')
                    }}
                  >
                    <option value="">Seçin…</option>
                    {calcUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tutar (DZD)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={deductAmount}
                    onChange={(event) => setDeductAmount(event.target.value)}
                  />
                </label>
                <label>
                  Not
                  <input
                    type="text"
                    value={deductNote}
                    onChange={(event) => setDeductNote(event.target.value)}
                    placeholder="örn. hasar"
                  />
                </label>
                <div className="form-actions">
                  <button type="submit" className="btn btn--ghost" disabled={savingDeduction}>
                    {savingDeduction ? 'Kaydediliyor…' : 'Kesinti ekle'}
                  </button>
                </div>
              </form>
            </div>
            <div className="table-wrap" style={{ marginTop: 20 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Çalışan</th>
                    <th>Brüt (DZD)</th>
                    <th>Tahmini net (%{DEFAULT_SOCIAL_RATE})</th>
                  </tr>
                </thead>
                <tbody>
                  {calcUsers.map((user) => {
                    const preview =
                      user.monthlySalaryGross == null
                        ? null
                        : estimateNet(user.monthlySalaryGross, DEFAULT_SOCIAL_RATE, 0, 0)
                    return (
                      <tr key={user.id}>
                        <td>{user.name}</td>
                        <td>
                          {user.monthlySalaryGross == null
                            ? '—'
                            : formatDzd(user.monthlySalaryGross)}
                        </td>
                        <td>{preview ? formatDzd(preview.estimatedNet) : '—'}</td>
                      </tr>
                    )
                  })}
                  {calcUsers.length === 0 && (
                    <tr>
                      <td colSpan={3}>Henüz çalışan yok.</td>
                    </tr>
                  )}
                </tbody>
                {calcUsers.some((u) => u.monthlySalaryGross != null) && (
                  <tfoot>
                    <tr>
                      <td>Toplam brüt</td>
                      <td>{formatDzd(leaveTotals.salaryGrossSum)}</td>
                      <td>
                        {formatDzd(
                          estimateNet(leaveTotals.salaryGrossSum, DEFAULT_SOCIAL_RATE, 0, 0)
                            .estimatedNet,
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {tab === 'advances' && (
          <div className="team-calc">
            <p className="team-calc__intro">
              Çalışan avansını burada girin. Kayıt, seçilen dönemde <strong>maaştan kesilir</strong>
              — aynı tutar için ayrıca kesinti yazmanız gerekmez. Kasaya yazım yalnızca kutuyu
              işaretlerseniz olur.
            </p>

            <div className="team-calc__grid">
              <form className="demo-form team-calc__form" onSubmit={(e) => void submitAdvance(e)}>
                <label>
                  Çalışan
                  <select
                    value={advUserId === '' ? '' : String(advUserId)}
                    onChange={(event) => {
                      const value = event.target.value
                      setAdvUserId(value ? Number(value) : '')
                    }}
                    required
                  >
                    <option value="">Seçin…</option>
                    {calcUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tutar (DZD)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={advAmount}
                    onChange={(event) => setAdvAmount(event.target.value)}
                    placeholder="örn. 10000"
                    required
                  />
                </label>
                <label>
                  Tarih
                  <input
                    type="date"
                    value={advDate}
                    onChange={(event) => setAdvDate(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Dönem (maaş kesimi)
                  <input
                    type="month"
                    value={advPeriod}
                    onChange={(event) => setAdvPeriod(event.target.value)}
                  />
                </label>
                <label>
                  Not
                  <input
                    type="text"
                    value={advNote}
                    onChange={(event) => setAdvNote(event.target.value)}
                    placeholder="opsiyonel"
                  />
                </label>
                <label className="team-calc__check">
                  <input
                    type="checkbox"
                    checked={advPostToCash}
                    onChange={(event) => setAdvPostToCash(event.target.checked)}
                  />
                  Kasaya da kaydet (CASH_OUT)
                </label>
                <div className="form-actions">
                  <button type="submit" className="btn btn--primary" disabled={savingAdvance}>
                    {savingAdvance ? 'Kaydediliyor…' : 'Avans ekle'}
                  </button>
                </div>
              </form>

              <div className="team-calc__result">
                <h3>Nasıl çalışır?</h3>
                <p className="team-calc__empty" style={{ margin: 0 }}>
                  Avans → Maaş sekminde aynı dönem için “Avans kesimi” olarak görünür → net =
                  brüt − sosyal − avanslar − diğer.
                </p>
              </div>
            </div>

            <div className="table-wrap" style={{ marginTop: 20 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Çalışan</th>
                    <th>Dönem</th>
                    <th>Tutar</th>
                    <th>Kasa</th>
                    <th>Not</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {advances.map((row) => (
                    <tr key={row.id}>
                      <td className="date-cell">
                        {new Date(row.occurredAt).toLocaleDateString('tr-TR', {
                          timeZone: 'Africa/Algiers',
                        })}
                      </td>
                      <td>{row.user?.name ?? `User #${row.userId}`}</td>
                      <td>{row.period ?? '—'}</td>
                      <td>{formatDzd(row.amount)}</td>
                      <td>{row.postedToCash ? 'Evet' : 'Hayır'}</td>
                      <td>{row.note ?? '—'}</td>
                      <td>
                        {!row.postedToCash && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => void removeAdvance(row.id)}
                          >
                            Sil
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {advances.length === 0 && (
                    <tr>
                      <td colSpan={7}>Bu dönemde avans kaydı yok.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'leave' && (
          <div className="team-calc">
            <p className="team-calc__intro">
              Cezayir yasal yıllık izin hakkı: <strong>30 gün / yıl</strong> (≈ 2,5 gün / ay
              tahakkuk). Kalan = hak − kullanılan.
            </p>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Çalışan</th>
                    <th>Hak (gün)</th>
                    <th>Kullanılan</th>
                    <th>Kalan</th>
                    <th>YTD tahakkuk</th>
                    <th>İşe giriş</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {calcUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.annualLeaveEntitlement}</td>
                      <td>{user.usedLeaveDays}</td>
                      <td
                        className={
                          (user.leave?.remainingDays ?? 0) < 0 ? 'team-leave--warn' : undefined
                        }
                      >
                        {user.leave?.remainingDays ?? user.annualLeaveEntitlement - user.usedLeaveDays}
                      </td>
                      <td>{user.leave?.accruedDaysYtd ?? '—'}</td>
                      <td className="date-cell">
                        {user.hireDate
                          ? new Date(user.hireDate).toLocaleDateString('tr-TR', {
                              timeZone: 'Africa/Algiers',
                            })
                          : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => openLeaveEdit(user)}
                        >
                          Düzenle
                        </button>
                      </td>
                    </tr>
                  ))}
                  {calcUsers.length === 0 && (
                    <tr>
                      <td colSpan={7}>Henüz çalışan yok.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <Modal open={formOpen} title="Çalışan ekle" onClose={() => setFormOpen(false)}>
        <form className="demo-form" onSubmit={submitCreate}>
          <label>
            Ad soyad
            <input name="name" type="text" minLength={2} required />
          </label>
          <label>
            E-posta
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Geçici parola
            <input
              name="password"
              type="password"
              minLength={12}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            Rol
            <select name="role" defaultValue="MEMBER">
              <option value="MEMBER">Çalışan — günlük operasyonlar</option>
              <option value="VIEWER">Görüntüleyici — yalnızca okuma</option>
              <option value="ACCOUNTING_OPERATOR">Muhasebe Operatörü — finans ve cari</option>
              <option value="PRODUCTION_MANAGER">Üretim Müdürü — üretim ve stok</option>
              <option value="ADMIN">Yönetici — TRIKOMEX tam yetki</option>
              <option value="OWNER">Şirket Sahibi — tam yetki</option>
            </select>
          </label>
          <label>
            Aylık brüt maaş (DZD, isteğe bağlı)
            <input
              name="monthlySalaryGross"
              type="text"
              inputMode="decimal"
              placeholder="Örn. 85000"
            />
          </label>
          <label>
            Yıllık izin (gün)
            <input
              name="annualLeaveEntitlement"
              type="text"
              inputMode="numeric"
              defaultValue="30"
            />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setFormOpen(false)}>
              Vazgeç
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
              {isSubmitting ? 'Oluşturuluyor…' : 'Çalışan ekle'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(leaveEditUser)}
        title={leaveEditUser ? `İzin — ${leaveEditUser.name}` : 'İzin'}
        onClose={() => setLeaveEditUser(null)}
      >
        <form className="demo-form" onSubmit={saveLeave}>
          <p className="team-calc__intro" style={{ marginTop: 0 }}>
            Cezayir yasal hak: 30 gün / yıl. Kullanılan günleri buradan güncelleyin.
          </p>
          <label>
            Yıllık hak (gün)
            <input
              type="text"
              inputMode="numeric"
              value={leaveEntitlement}
              onChange={(event) => setLeaveEntitlement(event.target.value)}
              required
            />
          </label>
          <label>
            Kullanılan (gün)
            <input
              type="text"
              inputMode="decimal"
              value={leaveUsed}
              onChange={(event) => setLeaveUsed(event.target.value)}
              required
            />
          </label>
          <label>
            İşe giriş tarihi
            <input
              type="date"
              value={leaveHireDate}
              onChange={(event) => setLeaveHireDate(event.target.value)}
            />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setLeaveEditUser(null)}>
              Vazgeç
            </button>
            <button type="submit" className="btn btn--primary" disabled={savingLeave}>
              {savingLeave ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
