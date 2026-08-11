import { useEffect, useRef, useState } from 'react'
import { ApiError, apiGet } from '../data/api'

type RateTrend = 'up' | 'down' | 'flat'

interface ExchangePairQuote {
  pair: 'USD/DZD' | 'EUR/DZD' | 'TRY/DZD' | 'DZD'
  companyValue: number | null
  bankValue: number | null
  previousBankValue: number | null
  changePercent: number | null
  trend: RateTrend
}

interface LiveExchangeRatesResponse {
  dzdPerUsd: number
  dzdPerEur: number
  dzdPerTry: number | null
  bank: {
    dzdPerUsd: number | null
    dzdPerEur: number | null
    dzdPerTry: number | null
  }
  changePercent: {
    usdDzd: number | null
    eurDzd: number | null
    tryDzd: number | null
  }
  pairs: ExchangePairQuote[]
  source: string
  fetchedAt: string
  stale: boolean
  bankAvailable: boolean
  disclaimer: string
}

const REFRESH_MS = 60_000

const PAIR_LABEL: Record<ExchangePairQuote['pair'], string> = {
  'USD/DZD': 'USD',
  'EUR/DZD': 'EUR',
  'TRY/DZD': 'TRY',
  DZD: 'DZD',
}

function formatRate(value: number): string {
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

function formatChange(changePercent: number | null): string {
  if (changePercent == null) return '—'
  const abs = Math.abs(changePercent).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (changePercent > 0) return `+${abs}%`
  if (changePercent < 0) return `-${abs}%`
  return `${abs}%`
}

function formatFetchedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('tr-TR', {
    timeZone: 'Africa/Algiers',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TrendMark({ trend }: { trend: RateTrend }) {
  if (trend === 'up') {
    return (
      <span className="fx-ticker__trend fx-ticker__trend--up" aria-label="Yükseliş">
        ▲
      </span>
    )
  }
  if (trend === 'down') {
    return (
      <span className="fx-ticker__trend fx-ticker__trend--down" aria-label="Düşüş">
        ▼
      </span>
    )
  }
  return (
    <span className="fx-ticker__trend fx-ticker__trend--flat" aria-label="Değişim yok">
      —
    </span>
  )
}

function RateValue({ pair }: { pair: ExchangePairQuote }) {
  if (pair.pair === 'DZD') {
    return <span className="fx-ticker__value">1,00</span>
  }

  const company =
    pair.companyValue == null ? '—' : formatRate(pair.companyValue)
  const bank = pair.bankValue == null ? '—' : formatRate(pair.bankValue)

  return (
    <span className="fx-ticker__value" title="Şirket kuru / Banka kuru (DZD)">
      <span className="fx-ticker__company">{company}</span>
      <span className="fx-ticker__slash"> / </span>
      <span className="fx-ticker__bank">{bank}</span>
      <span className="fx-ticker__unit"> DZD</span>
    </span>
  )
}

export function ExchangeRateTicker() {
  const [data, setData] = useState<LiveExchangeRatesResponse | null>(null)
  const [error, setError] = useState('')
  const dataRef = useRef<LiveExchangeRatesResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = () => {
      apiGet<LiveExchangeRatesResponse>('/exchange-rates/live')
        .then((response) => {
          if (cancelled) return
          dataRef.current = response
          setData(response)
          setError('')
        })
        .catch((err: unknown) => {
          if (cancelled) return
          if (dataRef.current) return
          setError(
            err instanceof ApiError
              ? err.message
              : 'Döviz kurları şu an alınamıyor.',
          )
        })
    }

    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  if (error && !data) {
    return (
      <section className="fx-ticker fx-ticker--empty" aria-label="Döviz şeridi">
        <p className="fx-ticker__empty">{error}</p>
        <p className="fx-ticker__disclaimer">
          TRIKOMEX kuru · Bilgilendirme amaçlıdır
        </p>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="fx-ticker fx-ticker--loading" aria-label="Döviz şeridi">
        <p className="fx-ticker__empty">Döviz kurları yükleniyor…</p>
      </section>
    )
  }

  const items = data.pairs.length > 0 ? data.pairs : []

  return (
    <section className="fx-ticker" aria-label="Döviz şeridi" dir="ltr">
      <div className="fx-ticker__meta">
        <span className="fx-ticker__brand">Döviz</span>
        <span className="fx-ticker__updated">
          Tarih / Saat: {formatFetchedAt(data.fetchedAt)}
          {data.stale ? ' · önbellek' : ''}
          {data.bankAvailable ? '' : ' · banka bekleniyor'}
        </span>
      </div>

      <div className="fx-ticker__viewport">
        <div className="fx-ticker__track">
          {[0, 1].map((copy) => (
            <ul
              key={copy}
              className="fx-ticker__list"
              aria-hidden={copy === 1 ? true : undefined}
            >
              {items.map((pair) => (
                <li key={`${copy}-${pair.pair}`} className="fx-ticker__item">
                  <span className="fx-ticker__pair">{PAIR_LABEL[pair.pair]}</span>
                  <RateValue pair={pair} />
                  {pair.pair !== 'DZD' ? (
                    <span
                      className={`fx-ticker__change fx-ticker__change--${pair.trend}`}
                    >
                      <TrendMark trend={pair.trend} />
                      {formatChange(pair.changePercent)}
                    </span>
                  ) : (
                    <span className="fx-ticker__previous">baz para</span>
                  )}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      <p className="fx-ticker__disclaimer">{data.disclaimer}</p>
    </section>
  )
}
