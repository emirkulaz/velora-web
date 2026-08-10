export function statusClass(status: string): string {
  switch (status) {
    case 'Üretimde':
      return 'status--production'
    case 'Sevk Edildi':
      return 'status--shipped'
    case 'Onay Bekliyor':
      return 'status--pending'
    case 'Tamamlandı':
      return 'status--done'
    case 'Aktif':
      return 'status--active'
    case 'Bakım':
      return 'status--maintenance'
    case 'Kritik':
      return 'status--critical'
    case 'Normal':
      return 'status--normal'
    case 'Gecikmiş ödeme':
      return 'status--overdue'
    case 'Gecikmiş':
      return 'status--delayed'
    case 'Devam ediyor':
      return 'status--production'
    case 'Başladı':
      return 'status--pending'
    default:
      return ''
  }
}
