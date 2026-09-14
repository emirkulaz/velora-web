import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ApiError, apiRequest } from '../data/api'
import { algiersYmd } from '../data/dates'
import { useSpeechToText } from '../hooks/useSpeechToText'
import { Icon } from '../components/Icons'
import { useI18n } from '../i18n/I18nProvider'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  dateFrom?: string | null
  dateTo?: string | null
  dataFreshness?: string
  recordsUsed?: number
}

interface FinanceChatResponse {
  answer: string
  dateFrom: string | null
  dateTo: string | null
  generatedAt: string
  dataFreshness: string
  recordsUsed: number
  disclaimer: string
}

function todayIso() {
  return algiersYmd()
}

function daysAgoIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return algiersYmd(d)
}

export function FinanceAiModule() {
  const { t, formatDate, locale } = useI18n()
  const quickPrompts = ['cash', 'expenses', 'unusual', 'collections', 'decrease'].map((key) => t(`financeAi.quick.${key}`))
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [dateFrom, setDateFrom] = useState(daysAgoIso(30))
  const [dateTo, setDateTo] = useState(todayIso())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const lastPayloadRef = useRef('')
  const listRef = useRef<HTMLDivElement>(null)
  const voice = useSpeechToText((transcript) => {
    lastPayloadRef.current = ''
    setInput((current) => `${current}${current.trim() ? ' ' : ''}${transcript}`)
  }, locale)

  const send = async (rawMessage: string) => {
    const message = rawMessage.trim()
    if (!message || loading) return

    const payloadKey = `${message}|${dateFrom}|${dateTo}`
    if (payloadKey === lastPayloadRef.current) {
      setError(t('financeAi.duplicate'))
      return
    }

    setError('')
    setLoading(true)
    const userMsg: ChatMessage = {
      id: `u-${crypto.randomUUID()}`,
      role: 'user',
      content: message,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    try {
      const response = await apiRequest<FinanceChatResponse>('/ai/finance/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
      })

      lastPayloadRef.current = payloadKey
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${crypto.randomUUID()}`,
          role: 'assistant',
          content: response.answer,
          dateFrom: response.dateFrom,
          dateTo: response.dateTo,
          dataFreshness: response.dataFreshness ?? response.generatedAt,
          recordsUsed: response.recordsUsed,
        },
      ])
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
      })
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      if (status === 401) {
        setError(t('financeAi.unauthorized'))
      } else if (status === 403) {
        setError(t('financeAi.forbidden'))
      } else if (status === 429) {
        setError(t('financeAi.rateLimit'))
      } else if (status === 503) {
        setError(
          err instanceof ApiError && err.message
            ? err.message
            : t('financeAi.unavailable'),
        )
      } else if (status === 400) {
        setError(err instanceof ApiError ? err.message : t('financeAi.invalid'))
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : t('financeAi.error'),
        )
      }
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void send(input)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send(input)
    }
  }

  return (
    <section className="panel panel--full finance-ai">
      <div className="panel__header">
        <div>
          <h2>{t('financeAi.title')}</h2>
          <p className="finance-ai__subtitle">
            {t('financeAi.subtitle')}
          </p>
        </div>
      </div>

      <div className="finance-ai__filters">
        <label>
          {t('financeAi.from')}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              lastPayloadRef.current = ''
              setDateFrom(e.target.value)
            }}
          />
        </label>
        <label>
          {t('financeAi.to')}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              lastPayloadRef.current = ''
              setDateTo(e.target.value)
            }}
          />
        </label>
      </div>

      <div className="finance-ai__quick">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="finance-ai__chip"
            disabled={loading}
            onClick={() => void send(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="finance-ai__thread" ref={listRef}>
        {messages.length === 0 && (
          <div className="finance-ai__empty">
            {t('financeAi.empty')}
          </div>
        )}
        {messages.map((msg) => (
          <article
            key={msg.id}
            className={
              msg.role === 'user'
                ? 'finance-ai__bubble finance-ai__bubble--user'
                : 'finance-ai__bubble finance-ai__bubble--assistant'
            }
          >
            <div className="finance-ai__bubble-label">
              {msg.role === 'user' ? t('financeAi.you') : 'VEXOR AI'}
            </div>
            <div className="finance-ai__bubble-body">{msg.content}</div>
            {msg.role === 'assistant' && (
              <div className="finance-ai__meta">
                {t('financeAi.range')}: {msg.dateFrom ?? '—'} → {msg.dateTo ?? '—'} · {t('financeAi.data')}:{' '}
                {msg.dataFreshness ? formatDate(msg.dataFreshness, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                {typeof msg.recordsUsed === 'number'
                  ? ` · ${t('financeAi.records', { count: msg.recordsUsed })}`
                  : ''}
              </div>
            )}
          </article>
        ))}
        {loading && (
          <div className="finance-ai__bubble finance-ai__bubble--assistant finance-ai__bubble--loading">
            {t('financeAi.analyzing')}
          </div>
        )}
      </div>

      {error && <p className="finance-ai__error">{error}</p>}
      {voice.error && <p className="finance-ai__error" role="alert">{voice.error}</p>}

      <form className="finance-ai__composer" onSubmit={onSubmit}>
        <textarea
          value={input}
          onChange={(e) => {
            lastPayloadRef.current = ''
            setInput(e.target.value)
          }}
          onKeyDown={onKeyDown}
          rows={2}
          maxLength={1000}
          placeholder={t('financeAi.placeholder')}
          disabled={loading}
        />
        <div className="finance-ai__composer-actions">
          <button
            type="button"
            className={`finance-ai__voice ${voice.isListening ? 'finance-ai__voice--listening' : ''}`}
            onClick={voice.isListening ? voice.stop : voice.start}
            disabled={!voice.isSupported || loading}
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
          <button type="submit" disabled={loading || !input.trim()}>
            {t('financeAi.send')}
          </button>
        </div>
      </form>

      <p className="finance-ai__disclaimer">{t('financeAi.disclaimer')}</p>
    </section>
  )
}
