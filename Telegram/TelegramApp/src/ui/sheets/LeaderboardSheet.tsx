// Public leaderboard: top players by one of 4 plain-integer stats (relics/stardust are
// BigNumbers - see leaderboardApi.ts's comment on why those aren't sortable here). Owns its
// fetch/sort state locally (unlike ownedCards, nothing else in the tree needs this data).
import { useEffect, useState } from 'react'
import { fetchLeaderboard, type LeaderboardEntry, type LeaderboardSortBy } from '../../game/leaderboardApi'
import { getTelegramUser } from '../../telegram'
import { Sheet } from '../Sheet'

interface LeaderboardSheetProps {
  open: boolean
  onClose: () => void
  apiBaseUrl: string | undefined
}

const SORT_TABS: Array<{ id: LeaderboardSortBy; label: string }> = [
  { id: 'deepestStage', label: 'DEEPEST SECTOR' },
  { id: 'bossesDefeated', label: 'BOSSES DEFEATED' },
  { id: 'prestigeCount', label: 'ASCENSIONS' },
  { id: 'deepestBossCleared', label: 'FRONTIER' },
]

function displayValue(sortBy: LeaderboardSortBy, value: number): string {
  // FRONTIER's underlying stat is a stage NUMBER (deepestBossCleared) - shown as the distinct-
  // boss count it actually represents (see LifetimeStats.ts), so it doesn't read as a duplicate
  // of DEEPEST SECTOR.
  if (sortBy === 'deepestBossCleared') return Math.floor(value / 5).toLocaleString()
  return value.toLocaleString()
}

export function LeaderboardSheet({ open, onClose, apiBaseUrl }: LeaderboardSheetProps) {
  const [sortBy, setSortBy] = useState<LeaderboardSortBy>('deepestStage')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(false)
  const myId = getTelegramUser()?.id

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetchLeaderboard(apiBaseUrl, sortBy, 50).then((result) => {
      if (!cancelled) {
        setEntries(result)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, sortBy, apiBaseUrl])

  const chip = (active: boolean) => `leaderboard-sort-chip ${active ? 'leaderboard-sort-chip--active' : ''}`

  return (
    <Sheet open={open} onClose={onClose} title="LEADERBOARD">
      <div className="leaderboard-sort-row">
        {SORT_TABS.map((t) => (
          <button key={t.id} className={chip(sortBy === t.id)} onClick={() => setSortBy(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="cards-empty">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="cards-empty">No ranked players yet.</div>
      ) : (
        <div className="leaderboard-list">
          {entries.map((e, i) => (
            <div key={e.telegramUserId} className={`leaderboard-row ${e.telegramUserId === myId ? 'leaderboard-row--me' : ''}`}>
              <div className="leaderboard-rank">{i + 1}</div>
              {e.photoUrl ? (
                <img className="leaderboard-avatar" src={e.photoUrl} alt="" />
              ) : (
                <div className="leaderboard-avatar leaderboard-avatar-fallback">{(e.firstName ?? '?').slice(0, 1).toUpperCase()}</div>
              )}
              <div className="leaderboard-name">{e.firstName ?? 'Commander'}</div>
              <div className="leaderboard-value">{displayValue(sortBy, e.value)}</div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}
