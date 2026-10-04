import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ApiError, apiDownload, apiGet, apiPost, apiRequest } from '../data/api'
import {
  canAccessAiSuggestionDomain,
  canWriteOrders,
  canWriteFinance,
  type AiSuggestionDomain,
  type AppUserRole,
} from '../data/roles'
import { useSpeechToText } from '../hooks/useSpeechToText'
import { suggestErpSpelling } from '../data/aiUnderstanding'
import { AI_COMMAND_LIMIT } from '../data/aiCalculation'
import { aiPeriodRange, validAiDateRange, type AiDateRange, type AiPeriod } from '../data/aiPeriod'
import { ConfirmDialog } from './ConfirmDialog'
import { AiEntryAssistant } from './AiEntryAssistant'
import { AiOrderContext } from './AiOrderContext'
import { AiDocumentImport } from './AiDocumentImport'
import { DailyEntryPanel, type DailyReview } from './DailyEntryPanel'
import { BusinessRecords, type BusinessRecord } from './BusinessPositionPanel'
import { aiWorkspaceLabels } from '../i18n/catalogs/aiWorkspace'
import { Icon } from './Icons'
import { useI18n } from '../i18n/I18nProvider'

interface AssistantResponse {
  query: string
  content: string
  generatedAt: string
  writePreview?: WritePreviewState | null
  reportUrl?: string
  evidence?: EvidenceItem[]
  dataSource?: string
  recordsUsed?: number
  disclaimer?: string
  dateFrom?: string | null
  dateTo?: string | null
}

interface EvidenceItem {
  metric: string
  value: number | string | null
  source: string
  period?: { from: string; to: string; timezone?: string }
  recordCount: number
  confidence: 'VERIFIED' | 'PARTIAL' | 'REVIEW_REQUIRED' | 'UNAVAILABLE'
  detail?: string
}

interface WritePreviewState {
  applied: boolean
  notice: string
  preview: string
  lines?: string[]
  previewToken?: string
  confirmationRequired?: boolean
  plannedAction?: string
  ready?: boolean
}

interface ErpChatResponse {
  data?: { documentImportId?: string; dailyEntry?: DailyReview; businessReport?: { records: BusinessRecord[]; totalRecords:number } }
  answer: string
  intent?: string
  module?: string
  dateFrom: string | null
  dateTo: string | null
  generatedAt: string
  dataFreshness: string
  recordsUsed: number
  dataSource?: string
  disclaimer: string
  writePreview?: WritePreviewState
  reportUrl?: string
  evidence?: EvidenceItem[]
}

type SuggestionDef = {
  key: string
  domain: AiSuggestionDomain
}

/** Örnek soru anahtarları — yalnız metin; ERP verisi yok. */
const AI_SUGGESTIONS: SuggestionDef[] = [
  { key: 'orders', domain: 'orders' },
  { key: 'stock', domain: 'stock' },
  { key: 'cash', domain: 'finance' },
  { key: 'production', domain: 'production' },
  { key: 'collections', domain: 'finance' },
  { key: 'debtors', domain: 'customers' },
  { key: 'suppliers', domain: 'suppliers' },
  { key: 'absent', domain: 'workforce' },
  { key: 'sales', domain: 'finance' },
  { key: 'risks', domain: 'risks' },
]

const INITIAL_SUGGESTION_LIMIT = 4
const CONTINUED_SUGGESTION_LIMIT = 3

function mapErrorMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof TypeError) {
    return t('ai.error.network')
  }
  if (!(error instanceof ApiError)) {
    return t('ai.error.unexpected')
  }
  if (error.status === 401) {
    return t('ai.error.unauthorized')
  }
  if (error.status === 403) {
    return t('ai.error.forbidden')
  }
  if (error.status === 429) {
    return t('ai.error.rateLimit')
  }
  if (error.status === 503) {
    return error.message || t('ai.error.unavailable')
  }
  if (error.status === 400 || error.status === 404) {
    return error.message || t('ai.error.invalid')
  }
  return error.message || t('ai.error.generic')
}

export function AiCommandPanel({
  userName,
  userRole,
  onRefresh,
}: {
  userName?: string
  userRole?: AppUserRole | null
  onRefresh?: () => void
}) {
  const { t, formatDate, formatNumber, locale, language } = useI18n()
  const labels = aiWorkspaceLabels[language ?? 'tr']
  const [conversationId] = useState(() => crypto.randomUUID())
  const [commandInput, setCommandInput] = useState('')
  const [response, setResponse] = useState<AssistantResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [documentImportId,setDocumentImportId]=useState<string>()
  const [dailyEntry,setDailyEntry]=useState<DailyReview>()
  const [businessReport,setBusinessReport]=useState<{records:BusinessRecord[];totalRecords:number}>()
  const [conversationStarted, setConversationStarted] = useState(false)
  const commandInputRef = useRef<HTMLTextAreaElement>(null)
  const requestBusyRef = useRef(false)
  const [history, setHistory] = useState<AssistantResponse[]>([])
  const [failedQuery, setFailedQuery] = useState<{ message: string; range: AiDateRange } | null>(null)
  const [period, setPeriod] = useState<AiPeriod>('auto')
  const [customRange, setCustomRange] = useState<AiDateRange>({ dateFrom: '', dateTo: '' })
  const range = aiPeriodRange(period, customRange)
  const periodValid = validAiDateRange(range)
  const [downloading, setDownloading] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const [exampleCustomer, setExampleCustomer] = useState<{role:AppUserRole;name:string}|null>(null)
  const [hasInsurance, setHasInsurance] = useState<{role:AppUserRole;exists:boolean}|null>(null)
  useEffect(() => {
    let live = true
    if (userRole && canWriteOrders(userRole)) apiGet<Array<{id:number;name:string}>>('/customers').then(rows => {
      const customer = rows.find(row => row.name.toLocaleLowerCase().includes('yacine')) ?? rows[0]
      if (live && customer) setExampleCustomer({role:userRole,name:customer.name})
    }).catch(() => { /* Missing data does not become an example. */ })
    if (userRole && canWriteFinance(userRole)) apiGet<{plan:{lines:Array<{kind:string;deferred:boolean}>}|null}>('/reserve-plan').then(result => {
      if (live) setHasInsurance({role:userRole,exists:Boolean(result.plan?.lines.some(line=>line.kind==='insurance'&&!line.deferred))})
    }).catch(() => { /* Keep the normal chat available. */ })
    return () => { live = false }
  }, [userRole])
  const prepareDraft = (text: string) => {
    setCommandInput(text)
    setDraftReady(true)
    commandInputRef.current?.focus()
  }
  const voice = useSpeechToText((transcript) => {

    setCommandInput((current) => `${current}${current.trim() ? ' ' : ''}${transcript}`)
    commandInputRef.current?.focus()
  }, locale)

  const filteredSuggestions = useMemo(() => {
    return AI_SUGGESTIONS.filter((item) =>
      canAccessAiSuggestionDomain(userRole, item.domain),
    ).map((item) => ({
      key: item.key,
      label: t(`ai.suggest.${item.key}`),
    }))
  }, [t, userRole])

  const visibleSuggestions = useMemo(() => {
    const limit = conversationStarted ? CONTINUED_SUGGESTION_LIMIT : INITIAL_SUGGESTION_LIMIT
    return filteredSuggestions.slice(0, limit)
  }, [conversationStarted, filteredSuggestions])

  const showInlineSuggestions = !conversationStarted && visibleSuggestions.length > 0
  const showQuickDrawer = quickOpen && filteredSuggestions.length > 0

  const mapResponse = (trimmed: string, data: ErpChatResponse): AssistantResponse => ({
    query: trimmed,
    content: data.answer,
    generatedAt: formatDate(data.dataFreshness || data.generatedAt, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    writePreview: data.writePreview ?? null,
    reportUrl: data.reportUrl,
    evidence: data.evidence ?? [],
    dataSource: data.dataSource,
    recordsUsed: data.recordsUsed,
    disclaimer: data.disclaimer,
    dateFrom: data.dateFrom,
    dateTo: data.dateTo,
  })

  const sendMessage = async (raw: string, requestedRange = aiPeriodRange(period, customRange)) => {
    const trimmed = raw.trim()
    if (!trimmed || requestBusyRef.current || confirming) return
    if (!validAiDateRange(requestedRange)) {
      setError(labels.periodError)
      return
    }
    if (raw.length > AI_COMMAND_LIMIT) {
      setError(`${t('ai.error.tooLong')} (${raw.length}/${AI_COMMAND_LIMIT})`)
      return
    }
    if (/https:\/\/drive\.google\.com\//i.test(trimmed) && canWriteFinance(userRole)) {
      setCommandInput(trimmed)
      setQuickOpen(true)
      return
    }
    requestBusyRef.current = true

    setCommandInput(trimmed)
    setDraftReady(false)
    setError('')
    setFailedQuery(null)
    setConfirmOpen(false)
    setEvidenceOpen(false)
    setQuickOpen(false)
    setLoading(true)
    setConversationStarted(true)

    try {
      const data = await apiRequest<ErpChatResponse>('/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, conversationId, ...requestedRange }),
      })

      if (response) setHistory((previous) => [...previous, response].slice(-19))
      setCommandInput('')
      setResponse(mapResponse(trimmed, data))
      setDailyEntry(data.data?.dailyEntry)
      setBusinessReport(data.data?.businessReport)
      if(data.data?.documentImportId){setDocumentImportId(data.data.documentImportId);setQuickOpen(true)}
    } catch (err) {
      setFailedQuery({ message: trimmed, range: { ...requestedRange } })
      setError(mapErrorMessage(err, t))
    } finally {
      requestBusyRef.current = false
      setLoading(false)
    }
  }

  const handleCommandSubmit = async () => {
    await sendMessage(commandInput)
  }

  const handleSuggestionClick = (label: string) => {
    void sendMessage(label)
  }

  const handleConfirmWrite = async () => {
    const token = response?.writePreview?.previewToken
    if (!token || confirming || requestBusyRef.current) return
    setConfirming(true)
    setError('')
    try {
      const data = await apiPost<ErpChatResponse>('/ai/confirm-write', {
        previewToken: token,
      })
      setConfirmOpen(false)
      if (data.writePreview?.applied) onRefresh?.()
      setResponse((prev) =>
        prev
          ? {
              ...mapResponse(prev.query, data),
              query: prev.query,
            }
          : mapResponse(t('ai.confirmQuery'), data),
      )
    } catch (err) {
      setError(mapErrorMessage(err, t))
      setConfirmOpen(false)
    } finally {
      setConfirming(false)
    }
  }

  const handleCommandKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void handleCommandSubmit()
    }
  }

  const preview = response?.writePreview
  const canConfirm =
    Boolean(preview?.confirmationRequired) &&
    !preview?.applied &&
    Boolean(preview?.previewToken) &&
    preview?.ready !== false
  const spellingSuggestion = useMemo(() => suggestErpSpelling(commandInput), [commandInput])
  const firstName = userName?.trim().split(/\s+/)[0]

  return (
    <section className="ai-command ai-workspace" aria-label={t('ai.ask')}>
      <div className="ai-command__header">
        <span className="ai-command__eyebrow">
          <Icon name="spark" /> {t('ai.ask')}
        </span>
        <h2 className="ai-command__title">
          {firstName ? t('ai.greetingNamed', { name: firstName }) : t('ai.greeting')}
        </h2>
        <p className="ai-command__subtitle">{labels.intro}</p>
      </div>

      <div className="ai-workspace__tools">
        {canAccessAiSuggestionDomain(userRole, 'orders') && <AiOrderContext disabled={loading || confirming} canReadFinance={canAccessAiSuggestionDomain(userRole, 'finance')} onDraft={prepareDraft} />}
        <AiEntryAssistant disabled={loading || confirming} canDraft={canWriteOrders(userRole)} onDraft={prepareDraft} />
      </div>
      {draftReady && <p className="ai-workspace__draft-notice" role="status">{labels.draftReady}</p>}
      <fieldset className="ai-workspace__period" disabled={loading || confirming}>
        <label>{labels.period}<select value={period} onChange={(event) => { setPeriod(event.target.value as AiPeriod); setError('') }}>
          {(['auto', 'today', 'month', 'previousMonth', 'custom'] as const).map((value) => <option key={value} value={value}>{labels[value]}</option>)}
        </select></label>
        {period === 'custom' && <>
          <label>{labels.from}<input type="date" value={customRange.dateFrom ?? ''} max={customRange.dateTo || undefined} onChange={(event) => { setCustomRange((current) => ({ ...current, dateFrom: event.target.value })); setError('') }} /></label>
          <label>{labels.to}<input type="date" value={customRange.dateTo ?? ''} min={customRange.dateFrom || undefined} onChange={(event) => { setCustomRange((current) => ({ ...current, dateTo: event.target.value })); setError('') }} /></label>
        </>}
        {period !== 'auto' && <p className="ai-entry__hint">{labels.periodHint}{periodValid && <> {range.dateFrom} → {range.dateTo}</>}</p>}
        {!periodValid && <p className="ai-entry__error" role="status">{labels.periodError}</p>}
      </fieldset>
      <div className="ai-command__input-wrap">
        <button
          type="button"
          className={`ai-command__plus ${quickOpen ? 'ai-command__plus--active' : ''}`}
          onClick={() => setQuickOpen((open) => !open)}
          aria-label={t('ai.showQuick')}
          aria-expanded={quickOpen}
        >
          <span aria-hidden="true">+</span>
        </button>
        <textarea
          ref={commandInputRef}
          className="ai-command__input"
          dir="ltr"
          style={{ direction: 'ltr', textAlign: 'left', unicodeBidi: 'normal' }}
          value={commandInput}
          onChange={(event) => {

            setCommandInput(event.target.value)
          }}
          onKeyDown={handleCommandKeyDown}
          placeholder={labels.queryHint}
          rows={Math.min(6, Math.max(2, commandInput.split('\n').length))}
          disabled={loading || confirming}
          aria-label={t('ai.commandLabel')}
        />
        <div className="ai-command__actions">
          <span className="ai-command__mode">
            <i aria-hidden="true" /> VEXOR AI
          </span>
          <button
            type="button"
            className={`ai-command__voice ${voice.isListening ? 'ai-command__voice--listening' : ''}`}
            onClick={voice.isListening ? voice.stop : voice.start}
            disabled={!voice.isSupported || loading || confirming}
            aria-pressed={voice.isListening}
            aria-label={voice.isListening ? t('ai.stopListening') : t('ai.speak')}
            title={
              voice.isSupported
                ? voice.isListening
                  ? t('ai.stopListening')
                  : t('ai.speak')
                : t('ai.speechUnsupported')
            }
          >
            <Icon name="microphone" />
          </button>
          <button
            type="button"
            className="ai-command__submit"
            onClick={() => void handleCommandSubmit()}
            disabled={!commandInput.trim() || loading || confirming || !periodValid}
            aria-label={loading ? t('ai.sending') : t('ai.send')}
            title={loading ? t('ai.sending') : t('ai.send')}
          >
            <span aria-hidden="true">{loading ? '···' : '↑'}</span>
          </button>
        </div>
      </div>
      <div className="ai-workspace__composer-help"><span>{labels.keyboard}</span><span>{commandInput.length}/{AI_COMMAND_LIMIT}</span></div>
      {dailyEntry&&<DailyEntryPanel key={dailyEntry.draft.sourceText} initial={dailyEntry} onRefresh={onRefresh}/>}
      {businessReport&&<details><summary>Yanıtın kaynak kayıtları ({businessReport.records.length}/{businessReport.totalRecords})</summary><BusinessRecords rows={businessReport.records}/></details>}
      {canWriteFinance(userRole) && <div hidden={!quickOpen}><AiDocumentImport documentId={documentImportId} onRefresh={onRefresh} textInput={commandInput} driveLink={commandInput.match(/https:\/\/drive\.google\.com\/\S+/i)?.[0]} /></div>}

      {spellingSuggestion && !loading && (
        <button type="button" className="quick-chip" disabled={confirming}
          onClick={() => { setCommandInput(spellingSuggestion); commandInputRef.current?.focus() }}>
          {t('ai.spellingSuggestion', { text: spellingSuggestion })}
        </button>
      )}
      {showInlineSuggestions && (
        <div className="ai-workspace__examples">
        <p>{labels.examples}</p>
        <div className="ai-command__suggestions" aria-label={t('ai.quickQuestions')}>
          {visibleSuggestions.map((item) => (
            <button
              key={item.key}
              type="button"
              className="quick-chip"
              disabled={loading || confirming}
              onClick={() => handleSuggestionClick(item.label)}
            >
              {item.label}
            </button>
          ))}
          {filteredSuggestions.length > visibleSuggestions.length && <button type="button" className="quick-chip" aria-expanded={quickOpen} onClick={() => setQuickOpen(!quickOpen)}>{t('ai.showQuick')}</button>}
        </div>
        </div>
      )}
      {!conversationStarted && <div className="ai-command__suggestions">
        {userRole && canAccessAiSuggestionDomain(userRole,'orders') && <button type="button" className="quick-chip" onClick={()=>prepareDraft(t('work.deliveryExample'))}>{t('work.deliveryExample')}</button>}
        {exampleCustomer && exampleCustomer.role===userRole && canWriteOrders(userRole) && <button type="button" className="quick-chip" onClick={()=>prepareDraft(t('work.orderExample',{customer:exampleCustomer.name}))}>{t('work.orderExample',{customer:exampleCustomer.name})}</button>}
        {hasInsurance?.role===userRole && hasInsurance?.exists && canWriteFinance(userRole) && <button type="button" className="quick-chip" onClick={()=>prepareDraft(t('work.insuranceExample'))}>{t('work.insuranceExample')}</button>}
      </div>}

      {showQuickDrawer && (
        <div className="ai-command__quick" aria-label={t('ai.quickQuestions')}>
          {filteredSuggestions
            .slice(conversationStarted ? 0 : INITIAL_SUGGESTION_LIMIT)
            .map((item) => (
              <button
                key={`drawer-${item.key}`}
                type="button"
                className="quick-chip"
                disabled={loading || confirming}
                onClick={() => handleSuggestionClick(item.label)}
              >
                {item.label}
              </button>
            ))}
        </div>
      )}

      {loading && (
        <p className="ai-command__status" aria-live="polite">
          {t('ai.analyzing')}
        </p>
      )}

      {error && (
        <p className="ai-command__error" role="alert">
          {error}
        </p>
      )}
      {voice.error && (
        <p className="ai-command__error" role="alert">
          {voice.error}
        </p>
      )}

      {failedQuery && <button type="button" className="btn btn--ghost" disabled={loading || confirming} onClick={() => void sendMessage(failedQuery.message, failedQuery.range)}>{t('ai.retry')}</button>}
      {history.length > 0 && <details className="ai-workspace__history"><summary>{labels.history} ({history.length})</summary>{history.map((item, index) => (
        <article className="demo-response" key={index}>
          <p className="demo-response__query">{t('ai.question')}: {item.query}</p>
          <div className="demo-response__header"><span className="demo-response__badge">{t('ai.answer')}</span><span className="demo-response__time">{item.generatedAt}</span></div>
          <div className="demo-response__body">{item.content.split('\n').map((line, i) => <p dir="auto" key={i}>{line || '\u00A0'}</p>)}</div>
        </article>
      ))}</details>}
      {response && (
        <article className="demo-response" aria-live="polite">
          <p className="demo-response__query">
            <span className="demo-response__query-label">{t('ai.question')}: </span>
            {response.query}
          </p>
          <div className="demo-response__header">
            <span className="demo-response__badge">{t('ai.answer')}</span>
            <span className="demo-response__time">{response.generatedAt}</span>
          </div>
          {(response.dateFrom || response.dateTo) && <p className="ai-workspace__answer-period">{labels.answerPeriod}: {response.dateFrom ?? '—'} → {response.dateTo ?? '—'}</p>}
          <div className="demo-response__body">
            {response.content.split('\n').map((line, index) => (
              <p dir="auto" key={`${index}-${line.slice(0, 12)}`}>{line || '\u00A0'}</p>
            ))}
          </div>
          {(response.dataSource || response.recordsUsed != null) && <div className="ai-workspace__provenance">
            {response.dataSource && <span>{labels.source}: {response.dataSource}</span>}
            {response.recordsUsed != null && <span>{labels.records}: {response.recordsUsed}</span>}
          </div>}
          {response.disclaimer && <p className="ai-entry__hint">{response.disclaimer}</p>}
          {response.reportUrl && (
            <button
              type="button"
              className="btn btn--report"
              disabled={downloading}
              onClick={() =>
                void (async () => {
                  setDownloading(true)
                  setError('')
                  try {
                  const blob = await apiDownload(response.reportUrl!)
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = 'vexor-ai-raporu.pdf'
                  link.click()
                  setTimeout(() => URL.revokeObjectURL(url), 1000)
                  } catch (err) {
                    setError(mapErrorMessage(err, t))
                  } finally {
                    setDownloading(false)
                  }
                })()
              }
            >
              {t('ai.downloadReport')}
            </button>
          )}
          {response.evidence && response.evidence.length > 0 && (
            <div className="ai-evidence">
              <button
                type="button"
                className="ai-evidence__toggle"
                onClick={() => setEvidenceOpen((open) => !open)}
                aria-expanded={evidenceOpen}
              >
                {evidenceOpen ? t('ai.hideEvidence') : t('ai.showEvidence')}
              </button>
              {evidenceOpen && (
                <div className="ai-evidence__details">
                  {response.evidence.map((item) => (
                    <div className="ai-evidence__item" key={`${item.metric}-${item.source}`}>
                      <strong>{item.metric}: {typeof item.value === 'number' ? formatNumber(item.value) : item.value ?? '—'}</strong>
                      <span>
                        {item.source} · {t('ai.recordCount', { count: item.recordCount })} ·{' '}
                        {t(`ai.confidence.${item.confidence}`)}
                      </span>
                      {item.period && (
                        <span>
                          {item.period.from} → {item.period.to}{item.period.timezone ? ` · ${item.period.timezone}` : ''}
                        </span>
                      )}
                      {item.detail && <small>{item.detail}</small>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {preview && !preview.applied && (
            <div className="ai-write-preview">
              <div className="ai-write-preview__title">{t('ai.preview')}</div>
              {preview.lines && preview.lines.length > 0 ? (
                <ul className="ai-write-preview__list">
                  {preview.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="ai-write-preview__text">{preview.preview}</p>
              )}
              <p className="ai-write-preview__notice">{preview.notice}</p>
              {canConfirm && (
                <div className="ai-write-preview__actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={confirming || loading}
                    onClick={() => setConfirmOpen(true)}
                  >
                    {t('ai.confirmApply')}
                  </button>
                </div>
              )}
              {preview.ready === false && (
                <p className="ai-write-preview__hint">{t('ai.completeDetails')}</p>
              )}
            </div>
          )}

          {preview?.applied && (
            <div className="ai-write-preview__applied">
              <p>{t('ai.applied')}</p>
              {onRefresh && <button type="button" className="btn btn--ghost" onClick={onRefresh}>{t('ai.refreshView')}</button>}
            </div>
          )}
          {!preview && <div className="ai-workspace__followup" aria-label={labels.followUp}>
            {[labels.detail, labels.next].map((question) => <button type="button" key={question} className="quick-chip" disabled={loading || confirming} onClick={() => prepareDraft(question)}>{question}</button>)}
          </div>}
        </article>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={t('ai.confirmTitle')}
        message={
          preview
            ? `${preview.lines?.join('\n') ?? preview.preview}\n\n${t('ai.confirmMessage')}`
            : t('ai.confirmMessage')
        }
        confirmLabel={confirming ? t('ai.applying') : t('ai.confirm')}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleConfirmWrite()}
      />
    </section>
  )
}

