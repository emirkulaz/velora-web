import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ApiError, apiRequest } from '../data/api'

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

const QUICK_PROMPTS = [
  'Kasa durumunu özetle',
  'Bu ay en büyük giderler neler?',
  'Son 30 günde olağan dışı hareket var mı?',
  'En büyük tahsilatlar hangileri?',
  'Kasa neden azalmış olabilir?',
]

const DISCLAIMER =
  'Velora AI analiz amaçlıdır. Kesin muhasebe kararı vermeden önce kayıtları kontrol edin.'

function formatAlgiers(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('tr-TR', {
    timeZone: 'Africa/Algiers',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export function FinanceAiModule() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [dateFrom, setDateFrom] = useState(daysAgoIso(30))
  const [dateTo, setDateTo] = useState(todayIso())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const lastPayloadRef = useRef('')
  const listRef = useRef<HTMLDivElement>(null)

  const send = async (rawMessage: string) => {
    const message = rawMessage.trim()
    if (!message || loading) return

    const payloadKey = `${message}|${dateFrom}|${dateTo}`
    if (payloadKey === lastPayloadRef.current) {
      setError('Aynı soruyu art arda göndermeyin. Tarihi veya metni değiştirin.')
      return
    }

    setError('')
    setLoading(true)
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
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
          id: `a-${Date.now()}`,
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
        setError('Oturumunuz sona ermiş olabilir. Lütfen yeniden giriş yapın.')
      } else if (status === 403) {
        setError('Bu alana erişim yetkiniz yok.')
      } else if (status === 429) {
        setError('Çok fazla istek gönderdiniz. Lütfen bir dakika bekleyin.')
      } else if (status === 503) {
        setError(
          err instanceof ApiError && err.message
            ? err.message
            : 'Finans asistanı şu an kullanılamıyor. Yapılandırmayı kontrol edin.',
        )
      } else if (status === 400) {
        setError(err instanceof ApiError ? err.message : 'Geçersiz istek.')
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Yanıt alınamadı. API bağlantısını kontrol edin.',
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
          <h2>Finans Asistanı</h2>
          <p className="finance-ai__subtitle">
            Salt-okunur analiz. Kayıt eklemez, güncellemez veya silmez.
          </p>
        </div>
      </div>

      <div className="finance-ai__filters">
        <label>
          Başlangıç
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
          Bitiş
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
        {QUICK_PROMPTS.map((prompt) => (
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
            Kasa, tahsilat veya giderler hakkında sorun. Rakamlar backend tarafından hesaplanır.
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
              {msg.role === 'user' ? 'Siz' : 'Velora AI'}
            </div>
            <div className="finance-ai__bubble-body">{msg.content}</div>
            {msg.role === 'assistant' && (
              <div className="finance-ai__meta">
                Aralık: {msg.dateFrom ?? '—'} → {msg.dateTo ?? '—'} · Veri:{' '}
                {formatAlgiers(msg.dataFreshness)}
                {typeof msg.recordsUsed === 'number'
                  ? ` · ${msg.recordsUsed} kayıt özeti`
                  : ''}
              </div>
            )}
          </article>
        ))}
        {loading && (
          <div className="finance-ai__bubble finance-ai__bubble--assistant finance-ai__bubble--loading">
            Analiz hazırlanıyor…
          </div>
        )}
      </div>

      {error && <p className="finance-ai__error">{error}</p>}

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
          placeholder="Örn. Bu ay kasanın durumunu özetle"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Gönder
        </button>
      </form>

      <p className="finance-ai__disclaimer">{DISCLAIMER}</p>
    </section>
  )
}
