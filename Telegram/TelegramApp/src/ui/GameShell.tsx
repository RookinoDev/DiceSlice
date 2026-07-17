// Ported from GamePhone.dc.html's app shell + its real toast/celebration state machine.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { BigNumber } from '../game/core/BigNumber'
import type { GameSession, DailyPreview } from '../game/gameplay/GameSession'
import { buildMainViewModel } from '../game/ui/MainPresenter'
import { nowUnixSeconds } from '../game/persistence/localStorageSave'
import type { OfflineReport } from '../game/useGameSession'
import type { PurchaseGrant } from '../game/monetization/purchases'
import { audio } from '../game/audio/AudioManager'
import { bindTelegramBackButton, getStartParam, getTelegramUser, hapticAction, hapticSuccess } from '../telegram'
import { fetchPublicProfile, type PublicProfile, type ShowcaseEntry } from '../game/profileApi'
import { fetchCollection, fetchPendingPacks, type OpenPackResult, type OwnedCard, type PendingPack } from '../game/cards/cardsApi'
import { summarizeCollection } from '../game/cards/collectionSummary'
import type { CardDefinition } from '../game/cards/catalog'
import { useScreenShake } from './useScreenShake'
import { useParticles } from './combatFx/useParticles'
import { ParticleLayer } from './combatFx/ParticleLayer'
import { getLandmarkRect, getLandmarkElement } from './combatFx/landmarks'
import { TopBar } from './TopBar'
import { BottomNav, type NavTab } from './BottomNav'
import { Toast } from './Toast'
import { FloatingNumbers } from './FloatingNumbers'
import { useFloatingNumbers } from './useFloatingNumbers'
import { CombatScreen } from './screens/CombatScreen'
import { FleetScreen } from './screens/FleetScreen'
import { ArtifactsScreen } from './screens/ArtifactsScreen'
import { PrestigeScreen } from './screens/PrestigeScreen'
import { CardsScreen } from './screens/CardsScreen'
import { PrestigeConfirmSheet } from './sheets/PrestigeConfirmSheet'
import { MissionsSheet } from './sheets/MissionsSheet'
import { DailyRewardSheet } from './sheets/DailyRewardSheet'
import { SettingsSheet } from './sheets/SettingsSheet'
import { ProfileSheet } from './sheets/ProfileSheet'
import { OfflineRewardsSheet } from './sheets/OfflineRewardsSheet'
import { CardDetailSheet } from './cards/CardDetailSheet'
import { ObjectViewer } from './cards/ObjectViewer'
import { PackOpeningOverlay } from './cards/PackOpeningOverlay'
import { ShipUnlockToast, type ShipUnlockInfo } from './ShipUnlockToast'
import './ui.css'

const TOAST_DURATION_MS = 1400

interface GameShellProps {
  session: GameSession
  offline: OfflineReport | null
  claimedGrants: PurchaseGrant[]
  /** Bumped by useGameSession whenever the session is rebooted from a better cloud save. */
  cloudRestores: number
}

// Human-readable label for a purchase grant's toast announcement, keyed by the same
// item id used in TelegramBot/index.mjs's replyWithInvoice and
// src/game/monetization/purchases.ts's GRANT_EFFECTS.
const GRANT_LABELS: Record<string, string> = {
  stardust_pack_500: '+500 Stardust',
}

export function GameShell({ session, offline, claimedGrants, cloudRestores }: GameShellProps) {
  const [tab, setTab] = useState<NavTab>('combat')
  const [prestigeConfirmOpen, setPrestigeConfirmOpen] = useState(false)
  const [missionsOpen, setMissionsOpen] = useState(false)
  const [dailyOpen, setDailyOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  // A visited player's profile, opened via a "u_<id>" deep-link start param.
  const [visitorProfile, setVisitorProfile] = useState<PublicProfile | null>(null)
  const [offlineOpen, setOfflineOpen] = useState(false)
  const [shipUnlock, setShipUnlock] = useState<ShipUnlockInfo | null>(null)
  const [ownedCards, setOwnedCards] = useState<OwnedCard[]>([])
  const [dust, setDust] = useState(0)
  const [myShowcase, setMyShowcase] = useState<ShowcaseEntry[]>([])
  const [pendingPacks, setPendingPacks] = useState<PendingPack[]>([])
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null)
  // The filtered/sorted list CardsScreen was showing when the card was opened - lets the
  // detail sheet's NEXT button browse without needing to re-derive filters up here.
  const [selectedCardList, setSelectedCardList] = useState<CardDefinition[]>([])
  const [objectViewerOpen, setObjectViewerOpen] = useState(false)
  const [packSheetOpen, setPackSheetOpen] = useState(false)
  const [toastText, setToastText] = useState<string | null>(null)
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { ref: shellRef, triggerShake } = useScreenShake<HTMLDivElement>()
  const { containerRef: rewardParticlesRef, spawn: spawnRewardParticle } = useParticles()

  // Resource Vacuum / Multi-Wave Collection / Final Resource Impact (#27-30): reward "coins"
  // fly from the planet to the gold pill (cross-component landmarks, see combatFx/landmarks.ts).
  // No-ops gracefully if either landmark isn't mounted (e.g. a kill happens while off the
  // Combat tab, or before TopBar has laid out) - purely decorative, never blocks the real reward.
  const spawnResourceVacuum = (big: boolean) => {
    const origin = getLandmarkRect('planet')
    const dest = getLandmarkRect('gold-pill')
    const shellRect = shellRef.current?.getBoundingClientRect()
    if (!origin || !dest || !shellRect) return

    const originX = origin.left + origin.width / 2 - shellRect.left
    const originY = origin.top + origin.height / 2 - shellRect.top
    const destX = dest.left + dest.width / 2 - shellRect.left
    const destY = dest.top + dest.height / 2 - shellRect.top
    const travelMs = 480
    // #8 fix: every destruction now sends a proper 8-12 coin flourish (was 1 coin for a normal
    // kill, only boss kills got a multi-wave burst), and the gold pill ticks on EACH arrival
    // instead of only the last one.
    const waveCount = big ? 12 : 8 + Math.floor(Math.random() * 3)

    for (let i = 0; i < waveCount; i++) {
      setTimeout(() => {
        const jitterX = (Math.random() - 0.5) * 26
        const jitterY = (Math.random() - 0.5) * 26
        spawnRewardParticle({
          className: 'fx-coin',
          x: originX + jitterX,
          y: originY + jitterY,
          durationMs: travelMs,
          style: { '--tx': `${destX - originX - jitterX}px`, '--ty': `${destY - originY - jitterY}px` } as CSSProperties,
        })
        setTimeout(() => {
          const el = getLandmarkElement('gold-pill')
          if (!el) return
          el.classList.remove('fx-gold-punch')
          void el.offsetWidth
          el.classList.add('fx-gold-punch')
        }, travelMs)
      }, i * 70)
    }
  }

  // Boss kill = a card pack earned: a pack chip bursts off the planet, hangs for a beat, then
  // flies to the CARDS tab and punches it. Same landmark/particle pattern as the gold vacuum.
  const spawnPackDrop = () => {
    const origin = getLandmarkRect('planet')
    const dest = getLandmarkRect('nav-cards')
    const shellRect = shellRef.current?.getBoundingClientRect()
    if (!origin || !dest || !shellRect) return
    const x = origin.left + origin.width / 2 - shellRect.left
    const y = origin.top + origin.height / 2 - shellRect.top
    const destX = dest.left + dest.width / 2 - shellRect.left
    const destY = dest.top + dest.height / 2 - shellRect.top
    spawnRewardParticle({
      className: 'fx-pack-drop',
      x,
      y,
      durationMs: 1250,
      style: { '--tx': `${destX - x}px`, '--ty': `${destY - y}px` } as CSSProperties,
    })
    setTimeout(() => {
      const el = getLandmarkElement('nav-cards')
      if (!el) return
      el.classList.remove('fx-gold-punch')
      void el.offsetWidth
      el.classList.add('fx-gold-punch')
    }, 1250)
  }

  const showToast = (text: string) => {
    setToastText(text)
    clearTimeout(toastTimeout.current)
    toastTimeout.current = setTimeout(() => setToastText(null), TOAST_DURATION_MS)
  }

  const floatingEntries = useFloatingNumbers(session)

  // claimedGrants only ever grows (see useGameSession) - track how many we've already
  // announced so a re-render doesn't re-show the same toast.
  const announcedGrantCount = useRef(0)
  useEffect(() => {
    for (const grant of claimedGrants.slice(announcedGrantCount.current)) {
      showToast(`Purchase received: ${GRANT_LABELS[grant.item] ?? grant.item}`)
      audio.prestige()
      hapticSuccess()
    }
    announcedGrantCount.current = claimedGrants.length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimedGrants])

  // Same pattern for cloud restores: announce each session reboot from a cloud save once.
  const announcedRestoreCount = useRef(0)
  useEffect(() => {
    if (cloudRestores > announcedRestoreCount.current) {
      announcedRestoreCount.current = cloudRestores
      showToast('PROGRESS RESTORED FROM CLOUD')
      hapticSuccess()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudRestores])

  // Returning Player Power Boost (#61) - purely-visual FX scale-up for the first ~10s back
  // after an offline stretch (see .game-shell--returning in ui.css). Real numbers untouched.
  const [returningBoost, setReturningBoost] = useState(false)

  // Show the offline-rewards sheet once at launch, else the daily-reward sheet if claimable.
  useEffect(() => {
    if (offline) {
      setOfflineOpen(true)
      setReturningBoost(true)
      const t = setTimeout(() => setReturningBoost(false), 10000)
      return () => clearTimeout(t)
    } else if (session.daily.canClaim(nowUnixSeconds())) setDailyOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const offs = [
      session.onMessage.on((msg) => {
        showToast(msg)
        audio.bossFail()
      }),
      session.taps.onDamageDealt.on(() => audio.tap()),
      session.onReward.on(({ planet, gold }) => {
        spawnResourceVacuum(planet.isBoss)
        if (planet.isBoss) {
          showToast(`BOSS DEFEATED · +${gold.toShortString()} Stardust`)
          // Death Silence (#46): a beat of hush before the boom lands, so it reads as an impact.
          audio.silence(120)
          audio.bossDown()
          hapticSuccess()
          triggerShake('big')
          spawnPackDrop()
        } else {
          showToast(`PLANET DESTROYED · +${gold.toShortString()} Stardust`)
          // Calm Before Destruction (#64): a shorter hush than the boss's, same reasoning.
          audio.silence(80)
          audio.explosion()
          hapticAction()
        }
      }),
      // No toast here - the always-visible Combat eyebrow already communicates a boss
      // encounter starting, matching the design's persistent-state (not toast) treatment.
      session.stage.onBossStarted.on(() => {
        audio.bossStart()
      }),
      session.ships.onShipChanged.on(({ index, level }) => {
        if (level === 1) {
          setShipUnlock({ def: session.ships.def(index), shipIndex: index })
          audio.prestige()
          hapticSuccess()
          triggerShake('big')
        }
      }),
    ]
    return () => offs.forEach((off) => off())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const handlePrestiged = (_relicsGained: BigNumber) => {
    audio.prestige()
    hapticSuccess()
    triggerShake('big')
  }

  const handleDailyClaimed = (result: DailyPreview) => {
    showToast(`DAY ${result.day} REWARD CLAIMED`)
    audio.prestige()
    hapticSuccess()
  }

  const handleSkillActivated = (label: string) => {
    showToast(`${label.toUpperCase()} ACTIVATED`)
  }

  const vm = buildMainViewModel(session)

  // Route Telegram's native BackButton to close whichever sheet/toast is open, instead of
  // letting it fall through to the platform's default (which would close the Mini App).
  const openSheet = prestigeConfirmOpen
    ? 'prestigeConfirm'
    : missionsOpen
      ? 'missions'
      : dailyOpen
        ? 'daily'
        : settingsOpen
          ? 'settings'
          : profileOpen
            ? 'profile'
            : offlineOpen
              ? 'offline'
              : shipUnlock
                ? 'shipUnlock'
                : selectedCard
                  ? objectViewerOpen
                    ? 'objectViewer'
                    : 'cardDetail'
                  : packSheetOpen
                    ? 'packOpen'
                    : null

  useEffect(() => {
    const closers: Record<string, () => void> = {
      prestigeConfirm: () => setPrestigeConfirmOpen(false),
      missions: () => setMissionsOpen(false),
      daily: () => setDailyOpen(false),
      settings: () => setSettingsOpen(false),
      profile: () => {
        setProfileOpen(false)
        setVisitorProfile(null)
      },
      offline: () => setOfflineOpen(false),
      shipUnlock: () => setShipUnlock(null),
      cardDetail: () => setSelectedCard(null),
      objectViewer: () => setObjectViewerOpen(false),
      packOpen: () => setPackSheetOpen(false),
    }
    return bindTelegramBackButton(openSheet !== null, () => openSheet && closers[openSheet]())
  }, [openSheet])

  // Card packs + collection: fetched on mount and whenever the app regains foreground (a boss
  // kill's pack grant happens server-side during the next cloud-save sync, which may complete
  // while this tab is backgrounded).
  const refreshCards = () => {
    const apiUrl = import.meta.env.VITE_API_URL
    fetchCollection(apiUrl).then(({ cards, dust: dustBalance }) => {
      setOwnedCards(cards)
      setDust(dustBalance)
    })
    fetchPendingPacks(apiUrl).then(setPendingPacks)
  }
  useEffect(() => {
    refreshCards()
    // The player's own showcase lives server-side (visitors read it from the same profile).
    const ownId = getTelegramUser()?.id
    if (ownId) fetchPublicProfile(import.meta.env.VITE_API_URL, ownId).then((p) => setMyShowcase(p?.showcase ?? []))
    const onVisibilityChange = () => {
      if (!document.hidden) refreshCards()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Packs granted by a mid-session save sync were invisible until the app was reopened -
  // opening the Cards tab is the moment the player looks for them, so refetch right there.
  useEffect(() => {
    if (tab === 'cards') refreshCards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const handlePackOpened = (packId: number, result: OpenPackResult) => {
    setPendingPacks((prev) => prev.filter((p) => p.id !== packId))
    // instanceId -1 marks optimistic rows; the next refreshCards() replaces them with server truth.
    setOwnedCards((prev) => [...prev, ...result.cards.map((c) => ({ instanceId: -1, cardId: c.cardId, variant: c.variant, serial: c.serial, mintedAtMs: Date.now() }))])
  }

  // Profile deep link ("u_<id>" start param): open that player's profile on launch.
  // Falls back silently if the profile doesn't exist or the API is unreachable.
  useEffect(() => {
    const param = getStartParam()
    const match = param?.match(/^u_(\d+)$/)
    if (!match) return
    const userId = Number(match[1])
    if (userId === getTelegramUser()?.id) return // own profile via link: nothing special to fetch
    fetchPublicProfile(import.meta.env.VITE_API_URL, userId).then((p) => {
      if (p) {
        setVisitorProfile(p)
        setProfileOpen(true)
      }
    })
  }, [])

  // Boss Planet Takes Over the Screen: dim/recede the surrounding chrome while a boss fight is
  // live and the player is actually looking at it, so attention stays on the encounter.
  const bossTakeover = vm.bossActive && tab === 'combat'

  // Progressive disclosure, matching Fleet/Artifacts/Prestige: hidden until there's something
  // to look at (an owned card or a pack waiting), not from the very first launch.
  // Always visible: hiding a whole feature behind a network fetch meant one slow/failed
  // /api/collection call made the tab vanish. CardsScreen's empty state covers new players.
  const showCards = true
  const cardOwnedSummary = useMemo(() => summarizeCollection(ownedCards), [ownedCards])

  return (
    <div ref={shellRef} className={`game-shell ${bossTakeover ? 'game-shell--boss-focus' : ''} ${returningBoost ? 'game-shell--returning' : ''}`}>
      <TopBar
        session={session}
        onSettingsClick={() => setSettingsOpen(true)}
        onProfileClick={() => setProfileOpen(true)}
        onNotificationClick={() => setMissionsOpen(true)}
        onDailyClick={() => setDailyOpen(true)}
      />
      <Toast text={toastText} />

      <div className={`game-shell-content ${tab === 'combat' ? 'combat-active' : ''}`}>
        {tab === 'combat' && (
          <>
            <CombatScreen session={session} onToast={showToast} onSkillActivated={handleSkillActivated} />
            <FloatingNumbers entries={floatingEntries} />
          </>
        )}
        {tab === 'fleet' && vm.showFleet && <FleetScreen session={session} onToast={showToast} />}
        {tab === 'artifacts' && vm.showArtifacts && <ArtifactsScreen session={session} onToast={showToast} />}
        {tab === 'prestige' && vm.showPrestige && <PrestigeScreen session={session} onPrestigeRequested={() => setPrestigeConfirmOpen(true)} />}
        {tab === 'cards' && showCards && (
          <CardsScreen
            ownedCards={ownedCards}
            dust={dust}
            pendingPackCount={pendingPacks.length}
            onSelectCard={(card, list) => {
              setSelectedCard(card)
              setSelectedCardList(list)
            }}
            onOpenPacks={() => setPackSheetOpen(true)}
          />
        )}
      </div>

      <BottomNav
        current={tab}
        onSelect={setTab}
        showFleet={vm.showFleet}
        showArtifacts={vm.showArtifacts}
        showPrestige={vm.showPrestige}
        prestigeReady={vm.canPrestige}
        showCards={showCards}
        cardsReady={pendingPacks.length > 0}
      />
      <ParticleLayer containerRef={rewardParticlesRef} className="fx-particle-layer--shell" />

      <PrestigeConfirmSheet session={session} open={prestigeConfirmOpen} onClose={() => setPrestigeConfirmOpen(false)} onPrestiged={handlePrestiged} />
      <MissionsSheet session={session} open={missionsOpen} onClose={() => setMissionsOpen(false)} onClaimed={() => showToast('MISSION COMPLETE')} />
      <DailyRewardSheet session={session} open={dailyOpen} onClose={() => setDailyOpen(false)} onClaimed={handleDailyClaimed} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ProfileSheet
        session={session}
        open={profileOpen}
        visitor={visitorProfile}
        apiBaseUrl={import.meta.env.VITE_API_URL}
        ownedCards={ownedCards}
        showcase={myShowcase}
        onShowcaseChange={setMyShowcase}
        onInspectCard={(card) => {
          setSelectedCard(card)
          setSelectedCardList([])
        }}
        onClose={() => {
          setProfileOpen(false)
          setVisitorProfile(null)
        }}
      />
      <OfflineRewardsSheet offline={offline} open={offlineOpen} onClose={() => setOfflineOpen(false)} onCollected={(gold) => showToast(`+${gold.toShortString()} Stardust collected`)} />
      <ShipUnlockToast unlock={shipUnlock} onClose={() => setShipUnlock(null)} onViewFleet={() => setTab('fleet')} />
      <CardDetailSheet
        card={selectedCard}
        owned={selectedCard ? (cardOwnedSummary.get(selectedCard.id) ?? null) : null}
        open={selectedCard !== null}
        onClose={() => setSelectedCard(null)}
        onExplore={() => setObjectViewerOpen(true)}
        hasNext={selectedCardList.length > 1}
        onNext={() => {
          if (!selectedCard) return
          const idx = selectedCardList.findIndex((c) => c.id === selectedCard.id)
          if (idx === -1) return
          setSelectedCard(selectedCardList[(idx + 1) % selectedCardList.length])
        }}
      />
      <ObjectViewer card={selectedCard} open={objectViewerOpen} onClose={() => setObjectViewerOpen(false)} />
      <PackOpeningOverlay apiBaseUrl={import.meta.env.VITE_API_URL} pendingPacks={pendingPacks} onOpened={handlePackOpened} open={packSheetOpen} onClose={() => setPackSheetOpen(false)} />
    </div>
  )
}
