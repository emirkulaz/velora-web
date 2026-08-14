import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

export function PwaUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const updateRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    updateRef.current = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
    })
  }, [])

  if (!needRefresh) return null

  return (
    <aside className="pwa-update" role="status" aria-live="polite">
      <div>
        <strong>Yeni VEXOR sürümü hazır.</strong>
        <span>Güncel arayüzü kullanmak için sayfayı yenileyin.</span>
      </div>
      <button
        type="button"
        className="btn btn--primary"
        onClick={() => void updateRef.current?.(true)}
      >
        Şimdi yenile
      </button>
      <button
        type="button"
        className="btn btn--ghost"
        aria-label="Güncelleme bildirimini kapat"
        onClick={() => setNeedRefresh(false)}
      >
        Daha sonra
      </button>
    </aside>
  )
}
