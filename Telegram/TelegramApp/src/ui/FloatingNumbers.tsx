import type { FloatingEntry } from './useFloatingNumbers'

interface FloatingNumbersProps {
  entries: FloatingEntry[]
}

export function FloatingNumbers({ entries }: FloatingNumbersProps) {
  return (
    <div className="floating-numbers">
      {entries.map((e) => (
        <span
          key={e.id}
          className="floating-number"
          style={{ left: `calc(50% + ${e.x}px)`, color: e.color, animationDuration: `${e.life}s` }}
        >
          {e.text}
        </span>
      ))}
    </div>
  )
}
