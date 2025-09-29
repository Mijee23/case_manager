'use client'

import { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ResponsiveTableProps {
  children: ReactNode
  className?: string
}

interface ResponsiveTableRowProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  onDoubleClick?: () => void
}

interface ResponsiveTableCellProps {
  children: ReactNode
  label?: string
  className?: string
  hideOnMobile?: boolean
}

export function ResponsiveTable({ children, className }: ResponsiveTableProps) {
  return (
    <div className={cn("space-y-0", className)}>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <div className="rounded-md border">
          <table className="w-full">
            {children}
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {children}
      </div>
    </div>
  )
}

export function ResponsiveTableHeader({ children }: { children: ReactNode }) {
  return (
    <thead className="hidden md:table-header-group">
      {children}
    </thead>
  )
}

export function ResponsiveTableBody({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Desktop */}
      <tbody className="hidden md:table-row-group">
        {children}
      </tbody>

      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {children}
      </div>
    </>
  )
}

export function ResponsiveTableRow({
  children,
  className,
  onClick,
  onDoubleClick
}: ResponsiveTableRowProps) {
  return (
    <>
      {/* Desktop Row */}
      <tr
        className={cn("hidden md:table-row", className)}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        {children}
      </tr>

      {/* Mobile Card */}
      <Card
        className={cn(
          "md:hidden cursor-pointer hover:bg-muted/50 transition-colors",
          className
        )}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        <CardContent className="p-4 space-y-2">
          {children}
        </CardContent>
      </Card>
    </>
  )
}

export function ResponsiveTableCell({
  children,
  label,
  className,
  hideOnMobile = false
}: ResponsiveTableCellProps) {
  return (
    <>
      {/* Desktop Cell */}
      <td className={cn("hidden md:table-cell px-4 py-2", className)}>
        {children}
      </td>

      {/* Mobile Field */}
      {!hideOnMobile && (
        <div className="md:hidden flex justify-between items-center">
          {label && (
            <span className="text-sm font-medium text-muted-foreground min-w-0 flex-shrink-0 mr-3">
              {label}:
            </span>
          )}
          <div className="text-sm text-right min-w-0 flex-1">
            {children}
          </div>
        </div>
      )}
    </>
  )
}

export function ResponsiveTableHead({ children, className }: {
  children: ReactNode
  className?: string
}) {
  return (
    <th className={cn("hidden md:table-cell px-4 py-2 text-left font-medium", className)}>
      {children}
    </th>
  )
}