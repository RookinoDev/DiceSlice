// Artifacts and Prestige merged into one bottom-nav tab with two internal pages, so the bar
// itself has room for Shop. Each half is untouched - this just adds the sub-tab switcher on top.
import { useState } from 'react'
import type { GameSession } from '../../game/gameplay/GameSession'
import { NavArtifactsIcon, NavPrestigeIcon } from '../icons'
import { registerLandmark } from '../combatFx/landmarks'
import { ArtifactsScreen } from './ArtifactsScreen'
import { PrestigeScreen } from './PrestigeScreen'

interface ArtifactsPrestigeScreenProps {
  session: GameSession
  onToast: (text: string) => void
  onPrestigeRequested: () => void
  prestigeReady: boolean
}

type SubTab = 'artifacts' | 'prestige'

export function ArtifactsPrestigeScreen({ session, onToast, onPrestigeRequested, prestigeReady }: ArtifactsPrestigeScreenProps) {
  const [subTab, setSubTab] = useState<SubTab>('artifacts')

  return (
    <div className="artifacts-prestige-screen">
      <div className="subtab-row">
        <button className={`subtab-chip ${subTab === 'artifacts' ? 'subtab-chip--active' : ''}`} onClick={() => setSubTab('artifacts')}>
          <NavArtifactsIcon color={subTab === 'artifacts' ? '#F49CFF' : '#5C6480'} size={15} />
          ARTIFACTS
        </button>
        <button
          className={`subtab-chip ${subTab === 'prestige' ? 'subtab-chip--active' : ''}`}
          // See TutorialSteps.ts's 'prestige-explain' step - always mounted regardless of which
          // sub-tab is currently showing, unlike anything inside PrestigeScreen itself.
          ref={(el) => registerLandmark('prestige-subtab', el)}
          onClick={() => setSubTab('prestige')}
        >
          <NavPrestigeIcon color={subTab === 'prestige' ? '#E24FFF' : '#5C6480'} size={15} />
          <span className="subtab-label-wrap">
            PRESTIGE
            {prestigeReady && <span className="dot dot-prestige" />}
          </span>
        </button>
      </div>
      {subTab === 'artifacts' ? (
        <ArtifactsScreen session={session} onToast={onToast} />
      ) : (
        <PrestigeScreen session={session} onPrestigeRequested={onPrestigeRequested} />
      )}
    </div>
  )
}
