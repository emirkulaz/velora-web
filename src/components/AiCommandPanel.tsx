import { useRef, useState, type KeyboardEvent } from 'react'
import { ApiError, apiRequest } from '../data/api'
import { QUICK_COMMANDS } from '../data/demoData'

interface AssistantResponse {
  query: string
  content: string
  source: string
  module?: string
  intent?: string
  generatedAt: string
  dateFrom?: string | null
  dateTo?: string | null
  disclaimer?: string
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
  writePreview?: {
    applied: boolean
    notice: string
    preview: string
  }
}

const COMMAND_PLACEHOLDER =
  'Kasa, müşteri, stok, ürün veya üretim hakkında sorun...'

const MODULE_LABELS: Record<string, string> = {
  finance: 'Finans',
  cash: 'Kasa',
  customers: 'Müşteriler',
  stock: 'Stok',
  products: 'Ürünler',
  warehouses: 'Depolar',
  production: 'Üretim',
  write_action: 'İşlem önizleme',
  unsupported: 'Genel',
}

function formatAlgiersTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleString('tr-TR', {
    timeZone: 'Africa/Algiers',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mapErrorMessage(error: unknown): string {
  if (error instanceof TypeError) {
    return 'Sunucuya bağlanılamadı. API veya ağ bağlantısını kontrol edin.'
  }
  if (!(error instanceof ApiError)) {
    return 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'
  }
  if (error.status === 401) {
    return 'Oturum süreniz dolmuş olabilir. Lütfen yeniden giriş yapın.'
  }
  if (error.status === 403) {
    return 'Bu soruyu sormak için yetkiniz yok.'
  }
  if (error.status === 429) {
    return 'Çok fazla istek gönderdiniz. Lütfen bir dakika sonra tekrar deneyin.'
  }
  if (error.status === 503) {
    return (
      error.message ||
      'Velora asistanı şu an kullanılamıyor. Yapılandırmayı kontrol edin.'
    )
  }
  if (error.status === 400) {
    return error.message || 'Geçersiz soru. Lütfen metni kontrol edin.'
  }
  return error.message || 'Yanıt alınamadı. Lütfen daha sonra tekrar deneyin.'
}

export function AiCommandPanel({
  onQuickCommand,
}: {
  onQuickCommand?: (command: string) => void
}) {
  const [commandInput, setCommandInput] = useState('')
  const [response, setResponse] = useState<AssistantResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const commandInputRef = useRef<HTMLTextAreaElement>(null)
  const lastSentRef = useRef('')

  const handleQuickCommand = (command: string) => {
    setCommandInput(command)
    setError('')
    commandInputRef.current?.focus()
    onQuickCommand?.(command)
  }

  const handleCommandSubmit = async () => {
    const trimmed = commandInput.trim()
    if (!trimmed || loading) return

    if (trimmed === lastSentRef.current && response) {
      setError('Aynı soruyu art arda göndermeyin. Metni biraz değiştirin.')
      return
    }

    setError('')
    setResponse(null)
    setLoading(true)

    try {
      const data = await apiRequest<ErpChatResponse>('/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })

      lastSentRef.current = trimmed
      const moduleKey = data.module ?? data.intent ?? 'unsupported'
      setResponse({
        query: trimmed,
        content: data.answer,
        source: data.dataSource
          ? `Veri kaynağı: ${data.dataSource}`
          : `Velora AI · ${data.recordsUsed} kayıt özeti`,
        module: MODULE_LABELS[moduleKey] ?? moduleKey,
        intent: data.intent,
        generatedAt: formatAlgiersTime(data.dataFreshness || data.generatedAt),
        dateFrom: data.dateFrom,
        dateTo: data.dateTo,
        disclaimer: data.disclaimer,
      })
    } catch (err) {
      setError(mapErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleCommandKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleCommandSubmit()
    }
  }

  return (
    <section className="ai-command" aria-label="Velora'ya Sor">
      <div className="ai-command__header">
        <h2 className="ai-command__title">Velora'ya Sor</h2>
        <p className="ai-command__subtitle">
          Salt-okunur ERP asistanı — yetkili olduğunuz şirket verileriyle yanıtlar
        </p>
      </div>

      <div className="ai-command__input-wrap">
        <textarea
          ref={commandInputRef}
          className="ai-command__input"
          value={commandInput}
          onChange={(event) => {
            lastSentRef.current = ''
            setCommandInput(event.target.value)
          }}
          onKeyDown={handleCommandKeyDown}
          placeholder={COMMAND_PLACEHOLDER}
          rows={2}
          maxLength={1000}
          disabled={loading}
          aria-label="Velora'ya komut girin"
        />
        <button
          type="button"
          className="ai-command__submit"
          onClick={() => void handleCommandSubmit()}
          disabled={!commandInput.trim() || loading}
        >
          {loading ? 'Gönderiliyor…' : 'Gönder'}
        </button>
      </div>

      <div className="ai-command__quick">
        {QUICK_COMMANDS.map((command) => (
          <button
            key={command}
            type="button"
            className="quick-chip"
            disabled={loading}
            onClick={() => handleQuickCommand(command)}
          >
            {command}
          </button>
        ))}
      </div>

      {loading && (
        <p className="ai-command__status" aria-live="polite">
          Yetkili veriler analiz ediliyor…
        </p>
      )}

      {error && (
        <p className="ai-command__error" role="alert">
          {error}
        </p>
      )}

      {response && (
        <article className="demo-response" aria-live="polite">
          <div className="demo-response__header">
            <span className="demo-response__badge">Yanıt</span>
            <span className="demo-response__time">{response.generatedAt}</span>
          </div>
          <p className="demo-response__query">
            <span className="demo-response__query-label">Soru: </span>
            {response.query}
          </p>
          <div className="demo-response__body">
            {response.content.split('\n').map((line, index) => (
              <p key={`${index}-${line.slice(0, 12)}`}>{line || '\u00A0'}</p>
            ))}
          </div>
          <p className="demo-response__meta">
            Modül: {response.module ?? '—'}
            {' · '}
            Aralık: {response.dateFrom ?? '—'} → {response.dateTo ?? '—'}
          </p>
          <footer className="demo-response__footer">{response.source}</footer>
          {response.disclaimer && (
            <p className="demo-response__disclaimer">{response.disclaimer}</p>
          )}
        </article>
      )}
    </section>
  )
}
