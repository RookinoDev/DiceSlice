// Ported from GamePhone.dc.html's bottom navigation bar.
import type { ReactElement } from 'react'
import { audio } from '../game/audio/AudioManager'
import { registerLandmark } from './combatFx/landmarks'
import { NavCombatIcon, NavFleetIcon, NavArtifactsIcon, NavPrestigeIcon, NavCardsIcon, NavTalentsIcon } from './icons'

export type NavTab = 'combat' | 'fleet' | 'artifacts' | 'prestige' | 'cards' | 'talents'

const DIM = '#5C6480'
const ACTIVE_COLORS: Record<NavTab, string> = {
  combat: '#FFB238',
  fleet: '#43DDEE',
  artifacts: '#F49CFF',
  prestige: '#E24FFF',
  cards: '#FFD873',
  talents: '#7CFFB2',
}

const ICONS: Record<NavTab, (props: { color: string }) => ReactElement> = {
  combat: NavCombatIcon,
  fleet: NavFleetIcon,
  artifacts: NavArtifactsIcon,
  prestige: NavPrestigeIcon,
  cards: NavCardsIcon,
  talents: NavTalentsIcon,
}

/** dot color/animation per tab (see ui.css's .dot-* rules) - only tabs that ever set `dot` need an entry. */
const DOT_CLASS: Partial<Record<NavTab, string>> = { cards: 'dot-cards', prestige: 'dot-prestige', talents: 'dot-talents' }

interface TabSpec {
  tab: NavTab
  label: string
  visible: boolean
  dot?: boolean
}

interface BottomNavProps {
  current: NavTab
  onSelect: (tab: NavTab) => void
  showFleet: boolean
  showArtifacts: boolean
  showPrestige: boolean
  prestigeReady: boolean
  showCards: boolean
  cardsReady: boolean
  showTalents: boolean
  talentsReady: boolean
}

export function BottomNav({ current, onSelect, showFleet, showArtifacts, showPrestige, prestigeReady, showCards, cardsReady, showTalents, talentsReady }: BottomNavProps) {
  const tabs: TabSpec[] = [
    { tab: 'combat', label: 'Combat', visible: true },
    { tab: 'fleet', label: 'Fleet', visible: showFleet },
    { tab: 'artifacts', label: 'Artifacts', visible: showArtifacts },
    { tab: 'talents', label: 'Talents', visible: showTalents, dot: talentsReady },
    { tab: 'cards', label: 'Cards', visible: showCards, dot: cardsReady },
    { tab: 'prestige', label: 'Prestige', visible: showPrestige, dot: prestigeReady },
  ]

  return (
    <div className="bottomnav">
      {tabs
        .filter((t) => t.visible)
        .map((t) => {
          const color = t.tab === current ? ACTIVE_COLORS[t.tab] : DIM
          const Icon = ICONS[t.tab]
          return (
            <button
              key={t.tab}
              className="bottomnav-tab"
              // Landmark per tab - the boss-kill "+pack" fly-to animation needs CARDS specifically,
              // and the tutorial overlay (TutorialSteps.ts) spotlights whichever tab it's teaching.
              ref={(el) => registerLandmark(`nav-${t.tab}`, el)}
              onClick={() => {
                audio.click()
                onSelect(t.tab)
              }}
            >
              <span className={`bottomnav-icon ${t.tab === 'cards' && t.dot ? 'bottomnav-icon--pulse' : ''}`}>
                <Icon color={color} />
                {t.dot && <span className={`dot ${DOT_CLASS[t.tab] ?? 'dot-prestige'}`} />}
              </span>
              <span className="bottomnav-label" style={{ color }}>
                {t.label.toUpperCase()}
              </span>
            </button>
          )
        })}
    </div>
  )
}
