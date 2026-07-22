// Player profile: identity + lifetime stats. Renders either the local player (live
// session data) or a visited player (PublicProfile fetched via a profile deep link).
// This screen is the future home of the card showcase / achievements (see
// docs/CARD_SYSTEM_PLAN.md), so the layout leaves the bottom section free.
import { BigNumber } from '../../game/core/BigNumber'
import type { GameSession } from '../../game/gameplay/GameSession'
import type { PublicProfile, ShowcaseEntry } from '../../game/profileApi'
import type { OwnedCard } from '../../game/cards/cardsApi'
import type { CardDefinition } from '../../game/cards/catalog'
import { getTelegramUser, shareViaTelegram, hapticAction } from '../../telegram'
import { audio } from '../../game/audio/AudioManager'
import { Sheet } from '../Sheet'
import { ShowcaseEditor, ShowcaseView } from '../cards/ShowcaseEditor'

const BOT_LINK = 'https://t.me/StellarBreakerBot'

interface ProfileSheetProps {
  session: GameSession
  open: boolean
  onClose: () => void
  /** When set, shows this player instead of the local one (visitor mode - no share button). */
  visitor?: PublicProfile | null
  apiBaseUrl: string | undefined
  ownedCards: OwnedCard[]
  showcase: ShowcaseEntry[]
  onShowcaseChange: (next: ShowcaseEntry[]) => void
  onInspectCard: (card: CardDefinition) => void
}

interface ProfileView {
  name: string
  username: string | null
  photoUrl: string | null
  deepestStage: number
  prestigeCount: number
  planetsDestroyed: number
  bossesDefeated: number
  relicsText: string
  dailyStreak: number
  sinceUnixSeconds: number
}

function fromSession(s: GameSession): ProfileView {
  const user = getTelegramUser()
  return {
    name: user?.first_name ?? 'COMMANDER',
    username: user?.username ?? null,
    photoUrl: user?.photo_url ?? null,
    deepestStage: Math.max(s.stats.deepestStage, s.stage.highestStage),
    prestigeCount: s.stats.prestigeCount,
    planetsDestroyed: s.stats.planetsDestroyed,
    bossesDefeated: s.stats.bossesDefeated,
    relicsText: s.prestige.relics.balance.toShortString(),
    dailyStreak: s.daily.streak,
    sinceUnixSeconds: s.stats.firstPlayedUnixSeconds,
  }
}

function fromPublic(p: PublicProfile): ProfileView {
  return {
    name: p.firstName ?? 'COMMANDER',
    username: p.username,
    photoUrl: p.photoUrl,
    deepestStage: Math.max(p.stats?.deepestStage ?? 1, p.highestStage ?? 1),
    prestigeCount: p.stats?.prestigeCount ?? 0,
    planetsDestroyed: p.stats?.planetsDestroyed ?? 0,
    bossesDefeated: p.stats?.bossesDefeated ?? 0,
    relicsText: p.relics ? new BigNumber(p.relics.mantissa, p.relics.exponent).toShortString() : '0',
    dailyStreak: p.dailyStreak ?? 0,
    sinceUnixSeconds: p.stats?.firstPlayedUnixSeconds ?? (p.firstSyncedAt ? Math.floor(p.firstSyncedAt / 1000) : 0),
  }
}

function sinceText(unixSeconds: number): string {
  if (!unixSeconds) return '—'
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export function ProfileSheet({ session, open, onClose, visitor, apiBaseUrl, ownedCards, showcase, onShowcaseChange, onInspectCard }: ProfileSheetProps) {
  const v = visitor ? fromPublic(visitor) : fromSession(session)

  const stats: Array<{ label: string; value: string; accent?: 'gold' | 'cyan' | 'magenta' }> = [
    { label: 'DEEPEST SECTOR', value: String(v.deepestStage), accent: 'cyan' },
    { label: 'STELLAR ASCENSIONS', value: String(v.prestigeCount), accent: 'magenta' },
    { label: 'PLANETS DESTROYED', value: v.planetsDestroyed.toLocaleString(), accent: 'gold' },
    { label: 'BOSSES DEFEATED', value: v.bossesDefeated.toLocaleString() },
    { label: 'RELICS', value: v.relicsText, accent: 'magenta' },
    { label: 'DAILY STREAK', value: `${v.dailyStreak}d` },
  ]

  const share = () => {
    audio.click()
    hapticAction()
    shareViaTelegram(
      BOT_LINK,
      `⭐ My Stellar Breaker record: Sector ${v.deepestStage} · ${v.planetsDestroyed.toLocaleString()} planets destroyed · ${v.prestigeCount} Stellar Ascensions. Think you can beat that?`,
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title={visitor ? 'COMMANDER PROFILE' : 'MY PROFILE'}>
      <div className="profile-header">
        {v.photoUrl ? (
          <img className="profile-avatar" src={v.photoUrl} alt="" />
        ) : (
          <div className="profile-avatar profile-avatar-fallback">{v.name.slice(0, 1).toUpperCase()}</div>
        )}
        <div className="profile-identity">
          <div className="profile-name">{v.name}</div>
          {v.username && <div className="profile-username">@{v.username}</div>}
          <div className="profile-since">COMMANDER SINCE {sinceText(v.sinceUnixSeconds).toUpperCase()}</div>
        </div>
      </div>

      <div className="profile-stats-grid">
        {stats.map((s) => (
          <div key={s.label} className={`profile-stat ${s.accent ? `profile-stat--${s.accent}` : ''}`}>
            <div className="profile-stat-value">{s.value}</div>
            <div className="profile-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {visitor ? (
        <ShowcaseView showcase={visitor.showcase ?? []} onInspect={onInspectCard} />
      ) : (
        <ShowcaseEditor apiBaseUrl={apiBaseUrl} ownedCards={ownedCards} showcase={showcase} onChange={onShowcaseChange} onInspect={onInspectCard} />
      )}

      {!visitor && (
        <button className="profile-share-btn" onClick={share}>
          SHARE MY RECORD
        </button>
      )}
    </Sheet>
  )
}
