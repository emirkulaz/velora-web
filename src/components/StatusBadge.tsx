import { statusClass } from '../utils/status'

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status ${statusClass(status)}`}>{status}</span>
}
