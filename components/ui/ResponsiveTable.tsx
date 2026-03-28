'use client'

import { ReactNode } from 'react'

type Column<T> = {
  key: keyof T | string
  header: string
  render?: (row: T) => ReactNode
  mobileLabel?: string
  className?: string
}

type Props<T> = {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (row: T) => void
  emptyMessage?: string
  mobileCardClassName?: string
}

export default function ResponsiveTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  emptyMessage = 'No hay datos para mostrar.',
  mobileCardClassName = '',
}: Props<T>) {
  if (!data.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <p className="text-sm text-white/55">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              {columns.map((col, index) => (
                <th
                  key={`${String(col.key)}-${index}`}
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/70 ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                onClick={() => onRowClick?.(row)}
                className={`transition ${
                  onRowClick ? 'cursor-pointer hover:bg-white/[0.03]' : ''
                }`}
              >
                {columns.map((col, colIndex) => (
                  <td
                    key={`${String(col.key)}-${colIndex}`}
                    className={`px-4 py-4 text-sm text-white ${col.className || ''}`}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {data.map((row, rowIndex) => (
          <div
            key={rowIndex}
            onClick={() => onRowClick?.(row)}
            className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition ${
              onRowClick ? 'cursor-pointer active:scale-[0.99] active:bg-white/[0.05]' : ''
            } ${mobileCardClassName}`}
          >
            {columns.map((col, colIndex) => (
              <div
                key={`${String(col.key)}-${colIndex}`}
                className="mb-3 border-b border-white/5 pb-2 last:mb-0 last:border-b-0 last:pb-0"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                  {col.mobileLabel || col.header}
                </p>
                <div className="mt-1 text-sm text-white">
                  {col.render ? col.render(row) : row[col.key]}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}