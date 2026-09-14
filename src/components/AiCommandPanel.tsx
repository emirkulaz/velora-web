import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ApiError, apiDownload, apiPost, apiRequest } from '../data/api'
import {
  canAccessAiSuggestionDomain,
  type AiSuggestionDomain,
  type AppUserRole,
} from '../data/roles'
import { useSpeechToText } from '../hooks/useSpeechToText'
import { ConfirmDialog } from './ConfirmDialog'
import { Icon } from './Icons'
import { useI18n } from '../i18n/I18nProvider'

interface AssistantResponse {
  query: string
  content: string
  generatedAt: string
  writePreview?: WritePreviewState | null
  reportUrl?: string
  evidence?: EvidenceItem[]
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
  { key: 'cash', domain: 'finance' },
  { key: 'collections', domain: 'finance' },
  { key: 'stock', domain: 'stock' },
  { key: 'orders', domain: 'orders' },
  { key: 'production', domain: 'production' },
  { key: 'debtors', domain: 'customers' },
  { key: 'suppliers', domain: 'suppliers' },
  { key: 'absent', domain: 'workforce' },
  { key: 'sales', domain: 'finance' },
  { key: 'risks', domain: 'risks' },
]

const INITIAL_SUGGESTION_LIMIT = 10
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
  const { t, formatDate } = useI18n()
  const [conversationId] = useState(() => crypto.randomUUID())
  const [commandInput, setCommandInput] = useState('')
  const [response, setResponse] = useState<AssistantResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [conversationStarted, setConversationStarted] = useState(false)
  const commandInputRef = useRef<HTMLTextAreaElement>(null)
  const lastSentRef = useRef('')
  const voice = useSpeechToText((transcript) => {
    lastSentRef.current = ''
    setCommandInput((current) => `${current}${current.trim() ? ' ' : ''}${transcript}`)
    commandInputRef.current?.focus()
  })

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
  })

  const sendMessage = async (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed || loading || confirming) return

    setCommandInput(trimmed)
    setError('')
    setResponse(null)
    setConfirmOpen(false)
    setEvidenceOpen(false)
    setQuickOpen(false)
    setLoading(true)
    setConversationStarted(true)

    try {
      const data = await apiRequest<ErpChatResponse>('/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, conversationId }),
      })

      lastSentRef.current = trimmed
      setResponse(mapResponse(trimmed, data))
    } catch (err) {
      setError(mapErrorMessage(err, t))
    } finally {
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
    if (!token || confirming) return
    setConfirming(true)
    setError('')
    try {
      const data = await apiPost<ErpChatResponse>('/ai/confirm-write', {
        previewToken: token,
      })
      setConfirmOpen(false)
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
    if (event.key === 'Enter' && !event.shiftKey) {
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
  const firstName = userName?.trim().split(/\s+/)[0]

  return (
    <section className="ai-command" aria-label={t('ai.ask')}>
      <div className="ai-command__header">
        <span className="ai-command__eyebrow">
          <Icon name="spark" /> {t('ai.ask')}
        </span>
        <h2 className="ai-command__title">
          {firstName ? t('ai.greetingNamed', { name: firstName }) : t('ai.greeting')}
        </h2>
        <p className="ai-command__subtitle">{t('ai.subtitle')}</p>
      </div>

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
          style={{
            direction: 'ltr',
            textAlign: 'left',
            unicodeBidi: 'normal',
          }}
          value={commandInput}
          onChange={(event) => {
            lastSentRef.current = ''
            setCommandInput(event.target.value)
          }}
          onKeyDown={handleCommandKeyDown}
          placeholder={t('ai.placeholder')}
          rows={1}
          maxLength={1000}
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
            disabled={!commandInput.trim() || loading || confirming}
            aria-label={loading ? t('ai.sending') : t('ai.send')}
            title={loading ? t('ai.sending') : t('ai.send')}
          >
            <span aria-hidden="true">{loading ? '···' : '↑'}</span>
          </button>
        </div>
      </div>

      {showInlineSuggestions && (
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
        </div>
      )}

      {showQuickDrawer && (
        <div className="ai-command__quick" aria-label={t('ai.quickQuestions')}>
          {filteredSuggestions
            .slice(0, conversationStarted ? CONTINUED_SUGGESTION_LIMIT : INITIAL_SUGGESTION_LIMIT)
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
          <div className="demo-response__body">
            {response.content.split('\n').map((line, index) => (
              <p dir="auto" key={`${index}-${line.slice(0, 12)}`}>{line || '\u00A0'}</p>
            ))}
          </div>
          {response.reportUrl && (
            <button
              type="button"
              className="btn btn--report"
              onClick={() =>
                void (async () => {
                  const blob = await apiDownload(response.reportUrl!)
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = 'vexor-ai-raporu.pdf'
                  link.click()
                  setTimeout(() => URL.revokeObjectURL(url), 1000)
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
                      <strong>{item.metric}</strong>
                      <span>
                        {item.source} · {t('ai.recordCount', { count: item.recordCount })} ·{' '}
                        {t(`ai.confidence.${item.confidence}`)}
                      </span>
                      {item.period && (
                        <span>
                          {item.period.from} · {item.period.timezone ?? 'Africa/Algiers'}
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
                    disabled={confirming}
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
