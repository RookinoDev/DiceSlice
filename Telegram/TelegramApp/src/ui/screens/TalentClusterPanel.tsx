// One cluster's nodes + the SVG lines connecting them, replacing the old CSS-bar connectors
// (which only worked between two DOM-adjacent siblings, so could never draw a line for a
// fork/merge). Coordinates are the node data's own `pos: {col,row}` (see TalentDefinition.ts),
// normalized to this panel's own bounding box so a cluster's positions can be authored as small
// local numbers regardless of where other clusters sit. X is percentage-based (the panel is as
// wide as whatever its CSS Grid column gives it - a phone screen, not a fixed design width);
// Y is fixed px per row, since the screen scrolls vertically but never horizontally.
import type { GameSession } from '../../game/gameplay/GameSession'
import type { TalentDefinition } from '../../game/config/TalentDefinition'
import { TalentNode } from './TalentNode'

const ROW_PX = 84

interface TalentClusterPanelProps {
  session: GameSession
  /** Global indices into session.talents' node array that belong to this cluster/panel. */
  nodeIndices: number[]
  onToast: (text: string) => void
  onOpenSocket?: (nodeId: string) => void
}

interface Edge {
  from: { i: number; def: TalentDefinition }
  to: { i: number; def: TalentDefinition }
}

export function TalentClusterPanel({ session: s, nodeIndices, onToast, onOpenSocket }: TalentClusterPanelProps) {
  const t = s.talents
  const nodes = nodeIndices.map((i) => ({ i, def: t.def(i) }))
  if (nodes.length === 0) return null

  const cols = nodes.map((n) => n.def.pos.col)
  const rows = nodes.map((n) => n.def.pos.row)
  const minCol = Math.min(...cols)
  const numCols = Math.max(...cols) - minCol + 1
  const minRow = Math.min(...rows)
  const numRows = Math.max(...rows) - minRow + 1

  const xPct = (col: number) => ((col - minCol + 0.5) / numCols) * 100
  const yPx = (row: number) => (row - minRow) * ROW_PX + ROW_PX / 2

  const byId = new Map(nodes.map((n) => [n.def.id, n]))
  const edges: Edge[] = []
  for (const n of nodes) {
    for (const prereqId of n.def.prerequisites) {
      const from = byId.get(prereqId)
      if (from) edges.push({ from, to: n })
    }
  }

  const heightPx = numRows * ROW_PX

  return (
    <div className="talent-cluster-panel" style={{ height: heightPx }}>
      <svg className="talent-connector-svg" viewBox={`0 0 100 ${heightPx}`} preserveAspectRatio="none">
        {edges.map(({ from, to }) => {
          const x1 = xPct(from.def.pos.col)
          const y1 = yPx(from.def.pos.row)
          const x2 = xPct(to.def.pos.col)
          const y2 = yPx(to.def.pos.row)
          const d = x1 === x2 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} Q${x1},${(y1 + y2) / 2} ${x2},${y2}`
          const lit = t.levelOf(from.i) > 0
          return <path key={`${from.def.id}-${to.def.id}`} d={d} className={lit ? 'is-lit' : ''} vectorEffect="non-scaling-stroke" />
        })}
      </svg>
      {nodes.map((n) => (
        <div
          key={n.def.id}
          className="talent-node-slot"
          style={{ left: `${xPct(n.def.pos.col)}%`, top: yPx(n.def.pos.row), width: `${100 / numCols}%` }}
        >
          <TalentNode session={s} index={n.i} onToast={onToast} onOpenSocket={onOpenSocket} />
        </div>
      ))}
    </div>
  )
}
