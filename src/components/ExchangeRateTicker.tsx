import { useEffect, useRef, useState } from 'react'
import { ApiError, apiGet } from '../data/api'
import { useI18n } from '../i18n/I18nProvider'

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

function TrendMark({ trend }: { trend: RateTrend }) {
  const { t } = useI18n()
  if (trend === 'up') {
    return (
      <span className="fx-ticker__trend fx-ticker__trend--up" aria-label={t('fx.trend.up')}>
        ▲
      </span>
    )
  }
  if (trend === 'down') {
    return (
      <span className="fx-ticker__trend fx-ticker__trend--down" aria-label={t('fx.trend.down')}>
        ▼
      </span>
    )
  }
  return (
    <span className="fx-ticker__trend fx-ticker__trend--flat" aria-label={t('fx.trend.flat')}>
      —
    </span>
  )
}

function RateValue({ pair }: { pair: ExchangePairQuote }) {
  const { t, formatNumber } = useI18n()
  const formatRate = (value: number) => formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  if (pair.pair === 'DZD') {
    return <span className="fx-ticker__value">{formatNumber(1, { minimumFractionDigits: 2 })}</span>
  }

  const company =
    pair.companyValue == null ? '—' : formatRate(pair.companyValue)
  const bank = pair.bankValue == null ? '—' : formatRate(pair.bankValue)

  return (
    <span className="fx-ticker__value" title={t('fx.rateTitle')}>
      <span className="fx-ticker__company">{company}</span>
      <span className="fx-ticker__slash"> / </span>
      <span className="fx-ticker__bank">{bank}</span>
      <span className="fx-ticker__unit"> DZD</span>
    </span>
  )
}

export function ExchangeRateTicker() {
  const { t, formatDate, formatNumber } = useI18n()
  const formatChange = (changePercent: number | null) => {
    if (changePercent == null) return '—'
    const abs = formatNumber(Math.abs(changePercent), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `${changePercent > 0 ? '+' : changePercent < 0 ? '-' : ''}${abs}%`
  }
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
              : t('fx.unavailable'),
          )
        })
    }

    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [t])

  if (error && !data) {
    return (
      <section className="fx-ticker fx-ticker--empty" aria-label={t('fx.label')}>
        <p className="fx-ticker__empty">{error}</p>
        <p className="fx-ticker__disclaimer">
          {t('fx.disclaimer')}
        </p>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="fx-ticker fx-ticker--loading" aria-label={t('fx.label')}>
        <p className="fx-ticker__empty">{t('fx.loading')}</p>
      </section>
    )
  }

  const items = data.pairs.length > 0 ? data.pairs : []

  return (
    <section className="fx-ticker" aria-label={t('fx.label')} dir="ltr">
      <div className="fx-ticker__meta">
        <span className="fx-ticker__brand">{t('fx.brand')}</span>
        <span className="fx-ticker__updated">
          {t('fx.updated')}: {formatDate(data.fetchedAt, { dateStyle: 'short', timeStyle: 'short' })}
          {data.stale ? ` · ${t('fx.cache')}` : ''}
          {data.bankAvailable ? '' : ` · ${t('fx.bankPending')}`}
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
                    <span className="fx-ticker__previous">{t('fx.base')}</span>
                  )}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      <p className="fx-ticker__disclaimer">{t('fx.disclaimer')}</p>
    </section>
  )
}
