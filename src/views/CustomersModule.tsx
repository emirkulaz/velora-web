import { useEffect, useMemo, useState } from 'react'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { apiGet } from '../data/api'

interface Customer {
  id: number
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  country: string
  city: string | null
  address: string | null
  isActive: boolean
}

export function CustomersModule() {
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet<Customer[]>('/customers')
      .then(setCustomers)
      .catch(() => setError('Müşteri verileri alınamadı.'))
  }, [])

  const filtered = useMemo(
    () =>
      customers.filter(
        (c) =>
          c.name.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')) ||
          (c.city?.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')) ?? false) ||
          (c.contactName?.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')) ?? false),
      ),
    [customers, search],
  )

  return (
    <>
      <ModuleSummary
        items={[
          { label: 'Toplam Müşteri', value: String(customers.length) },
          { label: 'Aktif', value: String(customers.filter((customer) => customer.isActive).length) },
          { label: 'Pasif', value: String(customers.filter((customer) => !customer.isActive).length) },
          { label: 'Şehir', value: String(new Set(customers.map((customer) => customer.city).filter(Boolean)).size) },
        ]}
      />

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>Müşteri Listesi</h2>
        </div>
        <ModuleToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Firma, şehir veya yetkili ara..."
        />
        {error && <p className="demo-notice">{error}</p>}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Firma</th>
                <th>Yetkili</th>
                <th>Şehir</th>
                <th>Telefon</th>
                <th>E-posta</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.contactName ?? '—'}</td>
                  <td>{c.city ?? '—'}</td>
                  <td>{c.phone ?? '—'}</td>
                  <td>{c.email ?? '—'}</td>
                  <td>{c.isActive ? 'Aktif' : 'Pasif'}</td>
                </tr>
              ))}
              {!error && filtered.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    {customers.length === 0
                      ? 'Henüz müşteri kaydı bulunmuyor.'
                      : 'Arama kriterine uyan müşteri bulunamadı.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
