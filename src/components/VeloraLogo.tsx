/** User-facing product brand (sidebar, header, login — single source of truth). */
export const BRAND_NAME = 'VEXOR'
export const BRAND_PRODUCT = 'VEXOR ERP'

type VeloraLogoProps = {
  variant?: 'full' | 'mark'
  theme?: 'light' | 'dark'
  className?: string
}

export function VeloraMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 44 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 4 L19 40 Q21.2 44.5 24 40 L38 4"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 28 L24 28"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  )
}

export function VeloraLogo({
  variant = 'full',
  theme = 'light',
  className = '',
}: VeloraLogoProps) {
  if (variant === 'mark') {
    return <VeloraMark className={`velora-brand__mark ${className}`.trim()} />
  }

  return (
    <div
      className={`velora-brand velora-brand--${theme} ${className}`.trim()}
      aria-label={BRAND_NAME}
    >
      <VeloraMark className="velora-brand__mark" />
      <div className="velora-brand__text">
        <span className="velora-brand__name">{BRAND_NAME}</span>
        <span className="velora-brand__tag">ERP</span>
      </div>
    </div>
  )
}
