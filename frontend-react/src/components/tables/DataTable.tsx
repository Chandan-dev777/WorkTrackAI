import { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Skeleton } from '@/components/common/Skeleton'

export interface ColumnDef<T> {
  key: keyof T
  header: string
  sortable?: boolean
  render?: (value: T[keyof T], row: T) => React.ReactNode
}

export interface DataTableProps<T extends { id: number | string }> {
  columns: ColumnDef<T>[]
  data: T[]
  isLoading?: boolean
  emptyMessage?: string
  selectable?: boolean
  onSelectionChange?: (selected: T[]) => void
  className?: string
}

type SortDir = 'asc' | 'desc' | null

export function DataTable<T extends { id: number | string }>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No data available',
  selectable = false,
  onSelectionChange,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [selected, setSelected] = useState<Set<T['id']>>(new Set())

  function handleSort(col: ColumnDef<T>) {
    if (!col.sortable) return
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'))
      if (sortDir === 'desc') setSortKey(null)
    } else {
      setSortKey(col.key)
      setSortDir('asc')
    }
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey || !sortDir) return 0
    const av = a[sortKey]
    const bv = b[sortKey]
    const cmp = String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? cmp : -cmp
  })

  function toggleRow(row: T) {
    const next = new Set(selected)
    next.has(row.id) ? next.delete(row.id) : next.add(row.id)
    setSelected(next)
    onSelectionChange?.(data.filter((r) => next.has(r.id)))
  }

  function toggleAll() {
    const allSelected = data.every((r) => selected.has(r.id))
    const next = allSelected ? new Set<T['id']>() : new Set(data.map((r) => r.id))
    setSelected(next)
    onSelectionChange?.(allSelected ? [] : [...data])
  }

  if (isLoading) {
    return (
      <div
        className={cn('rounded-xl overflow-hidden', className)}
        style={{ border: '1px solid var(--color-border-subtle)' }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="border-collapse" style={{ minWidth: 480, width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-elevated)' }}>
                {selectable && <th className="w-10 px-4 py-3" />}
                {columns.map((col) => (
                  <th key={String(col.key)} className="px-4 py-3 text-left">
                    <Skeleton className="h-3 w-16" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, ri) => (
                <tr key={ri} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                  {selectable && <td className="px-4 py-3.5"><Skeleton className="h-4 w-4" /></td>}
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3.5">
                      <Skeleton className="h-3 w-full animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('rounded-xl overflow-hidden', className)}
      style={{ border: '1px solid var(--color-border-subtle)' }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table className="border-collapse" style={{ minWidth: 480, width: '100%' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-elevated)', borderBottom: '1px solid var(--color-border-default)' }}>
              {selectable && (
                <th className="w-10 px-4">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={data.length > 0 && data.every((r) => selected.has(r.id))}
                    onChange={toggleAll}
                    className="cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  role="columnheader"
                  onClick={() => handleSort(col)}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide',
                    col.sortable && 'cursor-pointer sortable select-none hover:text-[var(--color-text-primary)]'
                  )}
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        {sortKey === col.key && sortDir === 'asc' ? (
                          <ChevronUp size={12} />
                        ) : sortKey === col.key && sortDir === 'desc' ? (
                          <ChevronDown size={12} />
                        ) : (
                          <ChevronsUpDown size={12} />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-12 text-center text-sm"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-[var(--color-bg-elevated)]"
                  style={{
                    borderTop: '1px solid var(--color-border-subtle)',
                    background: selected.has(row.id) ? 'rgba(99,102,241,0.08)' : undefined,
                  }}
                >
                  {selectable && (
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row)}
                        aria-label={`Select row ${row.id}`}
                        className="cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className="px-4 py-3.5 text-sm"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
