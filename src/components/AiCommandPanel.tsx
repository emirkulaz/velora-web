import { useRef, useState, type KeyboardEvent } from 'react'
import { QUICK_COMMANDS } from '../data/demoData'

interface DemoResponse {
  query: string
  content: string
  source: string
  generatedAt: string
}

const COMMAND_PLACEHOLDER =
  'Satışları özetle, sipariş oluştur veya stok durumunu sor...'

function formatAlgiersTime(date: Date): string {
  return date.toLocaleString('tr-TR', {
    timeZone: 'Africa/Algiers',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getDemoResponse(query: string): DemoResponse {
  const normalized = query.toLowerCase().trim()
  const generatedAt = formatAlgiersTime(new Date())

  if (normalized.includes('üretim') && normalized.includes('özet')) {
    return {
      query,
      content:
        'Üretim özeti için henüz gerçek üretim kaydı bağlanmadı.\n\n' +
        'TRIKOMEX üretim hatları ve günlük çıktı verisi geldiğinde burada gösterilecek.',
      source: 'Üretim modülü · TRIKOMEX Textile',
      generatedAt,
    }
  }

  if (normalized.includes('stok') && normalized.includes('azal')) {
    return {
      query,
      content:
        'Kritik stok uyarısı için gerçek stok eşiği analizi henüz aktif değil.\n\n' +
        'Stok modülündeki mevcut ürün miktarlarını kontrol edebilirsiniz.',
      source: 'Stok modülü · TRIKOMEX Textile',
      generatedAt,
    }
  }

  if (normalized.includes('sipariş') && normalized.includes('oluştur')) {
    return {
      query,
      content:
        'Yeni sipariş formu hazırlanabilir (henüz kaydedilmedi):\n\n' +
        '• Müşteri: [Belirtilmedi — lütfen müşteri adını ekleyin]\n' +
        '• Ürün: [Belirtilmedi — lütfen ürün seçin]\n' +
        '• Miktar: [Belirtilmedi]\n' +
        '• Birim fiyat: DZD cinsinden hesaplanacak\n\n' +
        'Siparişi kaydetmek için onayınız gerekiyor.',
      source: 'Sipariş modülü · TRIKOMEX Textile',
      generatedAt,
    }
  }

  if (normalized.includes('geciken') && normalized.includes('ödeme')) {
    return {
      query,
      content:
        'Geciken ödeme listesi için sahte müşteri verisi kullanılmıyor.\n\n' +
        'Cari ve tahsilat verileri içe aktarıldığında burada gerçek bakiyeler listelenecek.',
      source: 'Finans modülü · TRIKOMEX Textile',
      generatedAt,
    }
  }

  return {
    query,
    content:
      'Komutunuz alındı. Gerçek AI entegrasyonu henüz aktif değil.\n\n' +
      'Velora, doğal dildeki isteğinizi ilgili ERP modülüne yönlendirecek. ' +
      'Veri değiştiren işlemlerde uygulamadan önce onayınız istenecektir.',
    source: 'Velora AI',
    generatedAt,
  }
}

export function AiCommandPanel({
  onQuickCommand,
}: {
  onQuickCommand?: (command: string) => void
}) {
  const [commandInput, setCommandInput] = useState('')
  const [demoResponse, setDemoResponse] = useState<DemoResponse | null>(null)
  const commandInputRef = useRef<HTMLTextAreaElement>(null)

  const handleQuickCommand = (command: string) => {
    setCommandInput(command)
    setDemoResponse(null)
    commandInputRef.current?.focus()
    onQuickCommand?.(command)
  }

  const handleCommandSubmit = () => {
    const trimmed = commandInput.trim()
    if (!trimmed) return
    setDemoResponse(getDemoResponse(trimmed))
  }

  const handleCommandKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleCommandSubmit()
    }
  }

  return (
    <section className="ai-command" aria-label="Velora'ya Sor">
      <div className="ai-command__header">
        <h2 className="ai-command__title">Velora'ya Sor</h2>
        <p className="ai-command__subtitle">
          Doğal dilde sorun — Velora doğru modülü bulsun
        </p>
      </div>

      <div className="ai-command__input-wrap">
        <textarea
          ref={commandInputRef}
          className="ai-command__input"
          value={commandInput}
          onChange={(event) => setCommandInput(event.target.value)}
          onKeyDown={handleCommandKeyDown}
          placeholder={COMMAND_PLACEHOLDER}
          rows={2}
          aria-label="Velora'ya komut girin"
        />
        <button
          type="button"
          className="ai-command__submit"
          onClick={handleCommandSubmit}
          disabled={!commandInput.trim()}
        >
          Gönder
        </button>
      </div>

      <div className="ai-command__quick">
        {QUICK_COMMANDS.map((command) => (
          <button
            key={command}
            type="button"
            className="quick-chip"
            onClick={() => handleQuickCommand(command)}
          >
            {command}
          </button>
        ))}
      </div>

      {demoResponse && (
        <article className="demo-response" aria-live="polite">
          <div className="demo-response__header">
            <span className="demo-response__badge">Yanıt</span>
            <span className="demo-response__time">{demoResponse.generatedAt}</span>
          </div>
          <p className="demo-response__query">
            <span className="demo-response__query-label">Soru: </span>
            {demoResponse.query}
          </p>
          <div className="demo-response__body">
            {demoResponse.content.split('\n').map((line, index) => (
              <p key={`${index}-${line.slice(0, 12)}`}>{line || '\u00A0'}</p>
            ))}
          </div>
          <footer className="demo-response__footer">{demoResponse.source}</footer>
        </article>
      )}
    </section>
  )
}
