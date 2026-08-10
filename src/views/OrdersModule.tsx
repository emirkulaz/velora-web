import { useState } from 'react'
import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'

export function OrdersModule() {
  const [formOpen, setFormOpen] = useState(false)
  const [notice, setNotice] = useState('')

  return (
    <>
      <ModuleSummary
        items={[
          { label: 'Toplam Sipariş', value: '0' },
          { label: 'Üretimde', value: '0' },
          { label: 'Onay Bekliyor', value: '0' },
          { label: 'Bu Ay Tutar', value: '0', unit: 'DZD' },
        ]}
      />

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>Siparişler</h2>
          <button type="button" className="btn btn--primary" onClick={() => setFormOpen(true)}>
            + Yeni Sipariş
          </button>
        </div>

        {notice && <p className="demo-notice">{notice}</p>}

        <div className="empty-state" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Sipariş kaydı bulunamadı
          </p>
          <p style={{ marginBottom: 20 }}>
            İlk gerçek siparişinizi kaydedin. Demo sipariş üretilmez.
          </p>
          <button type="button" className="btn btn--primary" onClick={() => setFormOpen(true)}>
            Yeni sipariş ekle
          </button>
        </div>
      </section>

      <Modal open={formOpen} title="Yeni Sipariş" onClose={() => setFormOpen(false)}>
        <form
          className="demo-form"
          onSubmit={(event) => {
            event.preventDefault()
            setFormOpen(false)
            setNotice(
              'Sipariş API’si henüz hazır değil. Form kaydedilmedi; gerçek sipariş modülü tamamlanınca buradan eklenecek.',
            )
          }}
        >
          <p className="empty-state" style={{ marginBottom: 16 }}>
            Sipariş kaydı API’si henüz yok. Bu form şimdilik yalnızca hazırlık amaçlıdır; sahte
            sipariş oluşturulmaz.
          </p>
          <label>
            Müşteri
            <input type="text" placeholder="Müşteri adı" required />
          </label>
          <label>
            Ürün
            <input type="text" placeholder="Ürün adı" required />
          </label>
          <label>
            Miktar
            <input type="number" min="1" required />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setFormOpen(false)}>
              Vazgeç
            </button>
            <button type="submit" className="btn btn--primary">
              Kaydet (API bekleniyor)
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
