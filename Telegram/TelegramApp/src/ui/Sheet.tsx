// Ported from GamePhone.dc.html's shared bottom-sheet modal shell.
import type { ReactNode } from 'react'
import { CloseIcon } from './icons'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-drag-handle-row">
          <div className="sheet-drag-handle" />
        </div>
        <div className="sheet-header">
          {title && <h2>{title}</h2>}
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
