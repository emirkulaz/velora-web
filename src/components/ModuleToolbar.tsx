interface FilterOption {
  value: string
  label: string
}

import { ReportButton, type ReportType } from './ReportButton'

interface ModuleToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filter?: string
  filterOptions?: FilterOption[]
  onFilterChange?: (value: string) => void
  actionLabel?: string
  onAction?: () => void
  reportType?: ReportType
  reportLabel?: string
}

export function ModuleToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Ara...',
  filter,
  filterOptions,
  onFilterChange,
  actionLabel,
  onAction,
  reportType,
  reportLabel,
}: ModuleToolbarProps) {
  return (
    <div className="module-toolbar">
      <input
        type="search"
        className="module-toolbar__search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label="Ara"
      />
      {filterOptions && onFilterChange && (
        <select
          className="module-toolbar__filter"
          value={filter ?? 'all'}
          onChange={(event) => onFilterChange(event.target.value)}
          aria-label="Filtrele"
        >
          {filterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      {actionLabel && onAction && (
        <button type="button" className="btn btn--primary module-toolbar__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
      {reportType && <ReportButton type={reportType} label={reportLabel} />}
    </div>
  )
}
