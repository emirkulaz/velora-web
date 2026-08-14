import { useRef, useState, type KeyboardEvent } from 'react'
import { ApiError, apiDownload, apiPost, apiRequest } from '../data/api'
import { useSpeechToText } from '../hooks/useSpeechToText'
import { ConfirmDialog } from './ConfirmDialog'
import { Icon } from './Icons'

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

const COMMAND_PLACEHOLDER =
  "VEXOR'a sorun"

const QUICK_COMMANDS = [
  'Bugün neler oldu?',
  'Kasa ve cari durumunu özetle',
  'Kritik stokları göster',
  'Geciken siparişleri listele',
]

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
    return error.message || 'AI asistanına şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.'
  }
  if (error.status === 400 || error.status === 404) {
    return error.message || 'Geçersiz soru. Lütfen metni kontrol edin.'
  }
  return error.message || 'Yanıt alınamadı. Lütfen daha sonra tekrar deneyin.'
}

export function AiCommandPanel({ userName }: { userName?: string }) {
  const [commandInput, setCommandInput] = useState('')
  const [response, setResponse] = useState<AssistantResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const commandInputRef = useRef<HTMLTextAreaElement>(null)
  const lastSentRef = useRef('')
  const voice = useSpeechToText((transcript) => {
    lastSentRef.current = ''
    setCommandInput((current) => `${current}${current.trim() ? ' ' : ''}${transcript}`)
    commandInputRef.current?.focus()
  })

  const mapResponse = (trimmed: string, data: ErpChatResponse): AssistantResponse => ({
    query: trimmed,
    content: data.answer,
    generatedAt: formatAlgiersTime(data.dataFreshness || data.generatedAt),
  writePreview: data.writePreview ?? null,
  reportUrl: data.reportUrl,
  evidence: data.evidence ?? [],
  })

  const handleCommandSubmit = async () => {
    const trimmed = commandInput.trim()
    if (!trimmed || loading) return

    setError('')
    setResponse(null)
    setConfirmOpen(false)
    setEvidenceOpen(false)
    setLoading(true)

    try {
      const data = await apiRequest<ErpChatResponse>('/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })

      lastSentRef.current = trimmed
      setResponse(mapResponse(trimmed, data))
    } catch (err) {
      setError(mapErrorMessage(err))
    } finally {
      setLoading(false)
    }
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
          : mapResponse('Onay', data),
      )
    } catch (err) {
      setError(mapErrorMessage(err))
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
    <section className="ai-command" aria-label="VEXOR'a Sor">
      <div className="ai-command__header">
        <span className="ai-command__eyebrow"><Icon name="spark" /> VEXOR'A SOR</span>
        <h2 className="ai-command__title">{firstName ? `Nasıl gidiyor, ${firstName}?` : 'Bugün nasıl yardımcı olabilirim?'}</h2>
        <p className="ai-command__subtitle">Şirket verilerinizi sorun, VEXOR doğru modülü sizin için bulsun.</p>
      </div>

      <div className="ai-command__input-wrap">
        <button
          type="button"
          className={`ai-command__plus ${quickOpen ? 'ai-command__plus--active' : ''}`}
          onClick={() => setQuickOpen((open) => !open)}
          aria-label="Hazır soruları göster"
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
          placeholder={COMMAND_PLACEHOLDER}
          rows={1}
          maxLength={1000}
          disabled={loading || confirming}
          aria-label="VEXOR'a komut girin"
        />
        <div className="ai-command__actions">
          <span className="ai-command__mode"><i aria-hidden="true" /> VEXOR AI</span>
          <button
            type="button"
            className={`ai-command__voice ${voice.isListening ? 'ai-command__voice--listening' : ''}`}
            onClick={voice.isListening ? voice.stop : voice.start}
            disabled={!voice.isSupported || loading || confirming}
            aria-pressed={voice.isListening}
            aria-label={voice.isListening ? 'Dinlemeyi durdur' : 'Konuşarak yaz'}
            title={
              voice.isSupported
                ? voice.isListening
                  ? 'Dinlemeyi durdur'
                  : 'Konuşarak yaz'
                : 'Tarayıcınız sesli girişi desteklemiyor'
            }
          >
            <Icon name="microphone" />
          </button>
          <button
            type="button"
            className="ai-command__submit"
            onClick={() => void handleCommandSubmit()}
            disabled={!commandInput.trim() || loading || confirming}
            aria-label={loading ? 'Gönderiliyor' : 'Gönder'}
            title={loading ? 'Gönderiliyor' : 'Gönder'}
          >
            <span aria-hidden="true">{loading ? '···' : '↑'}</span>
          </button>
        </div>
      </div>

      {quickOpen && (
        <div className="ai-command__quick" aria-label="Hazır sorular">
          {QUICK_COMMANDS.map((command) => (
            <button key={command} type="button" className="quick-chip" onClick={() => {
              setCommandInput(command)
              setQuickOpen(false)
              commandInputRef.current?.focus()
            }}>{command}</button>
          ))}
        </div>
      )}

      {loading && (
        <p className="ai-command__status" aria-live="polite">
          Niyet yorumlanıyor ve yetkili veriler analiz ediliyor…
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
            <span className="demo-response__query-label">Soru: </span>
            {response.query}
          </p>
          <div className="demo-response__header">
            <span className="demo-response__badge">Yanıt</span>
            <span className="demo-response__time">{response.generatedAt}</span>
          </div>
          <div className="demo-response__body">
            {response.content.split('\n').map((line, index) => (
              <p key={`${index}-${line.slice(0, 12)}`}>{line || '\u00A0'}</p>
            ))}
          </div>
          {response.reportUrl && (
            <button type="button" className="btn btn--report" onClick={() => void (async () => {
              const blob = await apiDownload(response.reportUrl!)
              const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'vexor-ai-raporu.pdf'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
            })()}>PDF Raporunu İndir</button>
          )}
          {response.evidence && response.evidence.length > 0 && (
            <div className="ai-evidence">
              <button type="button" className="ai-evidence__toggle" onClick={() => setEvidenceOpen((open) => !open)} aria-expanded={evidenceOpen}>
                {evidenceOpen ? 'Veri kaynağını gizle' : 'Veri kaynağını göster'}
              </button>
              {evidenceOpen && <div className="ai-evidence__details">{response.evidence.map((item) => (
                <div className="ai-evidence__item" key={`${item.metric}-${item.source}`}>
                  <strong>{item.metric}</strong><span>{item.source} · {item.recordCount} kayıt · {item.confidence}</span>
                  {item.period && <span>{item.period.from} · {item.period.timezone ?? 'Africa/Algiers'}</span>}
                  {item.detail && <small>{item.detail}</small>}
                </div>
              ))}</div>}
            </div>
          )}

          {preview && !preview.applied && (
            <div className="ai-write-preview">
              <div className="ai-write-preview__title">İşlem önizleme</div>
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
                    Onayla ve uygula
                  </button>
                </div>
              )}
              {preview.ready === false && (
                <p className="ai-write-preview__hint">
                  Onay için ürün, miktar veya müşteri bilgisini netleştirin.
                </p>
              )}
            </div>
          )}

          {preview?.applied && (
            <p className="ai-write-preview__applied">Onaylı işlem uygulandı.</p>
          )}
        </article>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="İşlemi onayla"
        message={
          preview
            ? `${preview.lines?.join('\n') ?? preview.preview}\n\nBu işlem şirket verisini değiştirecek. Onaylıyor musunuz?`
            : 'Bu işlem şirket verisini değiştirecek. Onaylıyor musunuz?'
        }
        confirmLabel={confirming ? 'Uygulanıyor…' : 'Onayla'}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleConfirmWrite()}
      />
    </section>
  )
}
