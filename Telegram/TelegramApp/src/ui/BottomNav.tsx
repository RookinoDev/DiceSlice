// Ported from GamePhone.dc.html's bottom navigation bar.
import type { ReactElement } from 'react'
import { audio } from '../game/audio/AudioManager'
import { NavCombatIcon, NavFleetIcon, NavArtifactsIcon, NavPrestigeIcon } from './icons'

export type NavTab = 'combat' | 'fleet' | 'artifacts' | 'prestige'

const DIM = '#5C6480'
const ACTIVE_COLORS: Record<NavTab, string> = {
  combat: '#FFB238',
  fleet: '#43DDEE',
  artifacts: '#F49CFF',
  prestige: '#E24FFF',
}

const ICONS: Record<NavTab, (props: { color: string }) => ReactElement> = {
  combat: NavCombatIcon,
  fleet: NavFleetIcon,
  artifacts: NavArtifactsIcon,
  prestige: NavPrestigeIcon,
}

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
}

export function BottomNav({ current, onSelect, showFleet, showArtifacts, showPrestige, prestigeReady }: BottomNavProps) {
  const tabs: TabSpec[] = [
    { tab: 'combat', label: 'Combat', visible: true },
    { tab: 'fleet', label: 'Fleet', visible: showFleet },
    { tab: 'artifacts', label: 'Artifacts', visible: showArtifacts },
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
              onClick={() => {
                audio.click()
                onSelect(t.tab)
              }}
            >
              <span className="bottomnav-icon">
                <Icon color={color} />
                {t.dot && <span className="dot dot-prestige" />}
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
