// Ported from GamePhone.dc.html's app shell + its real toast/celebration state machine.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { BigNumber } from '../game/core/BigNumber'
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
import { PackEarnedBanner } from './PackEarnedBanner'
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
import { AchievementsSheet } from './sheets/AchievementsSheet'
import { LeaderboardSheet } from './sheets/LeaderboardSheet'
import { ShopSheet } from './sheets/ShopSheet'
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
  /** Force an immediate cloud-save push instead of waiting for the periodic timer - used right
   *  after a boss kill so the server-side pack grant isn't stuck behind a minute-long wait. */
  syncNow: (keepalive?: boolean) => Promise<void>
  /** Claims any Stars purchases the server has recorded but this device hasn't credited yet -
   *  the Shop sheet calls this right after openInvoice() resolves 'paid'. */
  refreshPurchases: () => Promise<void>
}

// Human-readable label for a purchase grant's toast announcement, keyed by the same
// item id used in TelegramBot/index.mjs's replyWithInvoice and
// src/game/monetization/purchases.ts's GRANT_EFFECTS.
const GRANT_LABELS: Record<string, string> = {
  starter_pack: '+2,000 Stardust + 1 Stellar Pack',
  stardust_pack_500: '+500 Stardust',
  stardust_pack_1500: '+1,500 Stardust',
  stardust_pack_5000: '+5,000 Stardust',
  buy_pack_meteor: '+1 Meteor Pack',
  buy_pack_stellar: '+1 Stellar Pack',
  buy_pack_deepsky: '+1 Deep Sky Pack',
  buy_pack_singularity: '+1 Singularity Pack',
  offline_cap_boost: 'Offline cap raised to 24h',
  vip_pass_30d: 'VIP active: +25% Stardust for 30 days',
}

export function GameShell({ session, offline, claimedGrants, cloudRestores, syncNow, refreshPurchases }: GameShellProps) {
  const [tab, setTab] = useState<NavTab>('combat')
  const [prestigeConfirmOpen, setPrestigeConfirmOpen] = useState(false)
  const [missionsOpen, setMissionsOpen] = useState(false)
  const [dailyOpen, setDailyOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  // Both open directly from TopBar buttons, independent of profileOpen.
  const [achievementsOpen, setAchievementsOpen] = useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [shopOpen, setShopOpen] = useState(false)
  // A visited player's profile, opened via a "u_<id>" deep-link start param.
  const [visitorProfile, setVisitorProfile] = useState<PublicProfile | null>(null)
  const [offlineOpen, setOfflineOpen] = useState(false)
  const [shipUnlock, setShipUnlock] = useState<ShipUnlockInfo | null>(null)
  const [ownedCards, setOwnedCards] = useState<OwnedCard[]>([])
  const [dust, setDust] = useState(0)
  const [myShowcase, setMyShowcase] = useState<ShowcaseEntry[]>([])
  const [pendingPacks, setPendingPacks] = useState<PendingPack[]>([])
  // Live mirror of pendingPacks.length for the boss-kill handler below: that handler is
  // registered once per session (not re-registered on every pendingPacks change), so reading
  // the state directly there would see whatever count was current when the effect last ran,
  // not the count at the moment of THIS kill.
  const pendingPacksRef = useRef<PendingPack[]>([])
  useEffect(() => {
    pendingPacksRef.current = pendingPacks
  }, [pendingPacks])
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null)
  // The filtered/sorted list CardsScreen was showing when the card was opened - lets the
  // detail sheet's NEXT button browse without needing to re-derive filters up here.
  const [selectedCardList, setSelectedCardList] = useState<CardDefinition[]>([])
  // Bumped when the card detail sheet closes - the only moment favorites/recent-views can
  // have changed; CardsScreen (memo'd, see its perf notes) refreshes its prefs off this.
  const [prefsVersion, setPrefsVersion] = useState(0)
  const [objectViewerOpen, setObjectViewerOpen] = useState(false)
  const [packSheetOpen, setPackSheetOpen] = useState(false)
  const [toastText, setToastText] = useState<string | null>(null)
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // "New Card Pack" banner (boss kill) - a key bump forces a remount so back-to-back boss kills
  // each replay the full drop-down animation instead of the second one being a no-op state set.
  const [packBannerKey, setPackBannerKey] = useState(0)
  const [packBannerVisible, setPackBannerVisible] = useState(false)
  const packBannerTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const showPackBanner = () => {
    setPackBannerKey((k) => k + 1)
    setPackBannerVisible(true)
    clearTimeout(packBannerTimeout.current)
    packBannerTimeout.current = setTimeout(() => setPackBannerVisible(false), 1800)
  }
  const { ref: shellRef, triggerShake } = useScreenShake<HTMLDivElement>()
  const { containerRef: rewardParticlesRef, spawn: spawnRewardParticle } = useParticles()

  // Reward-magnitude baseline for the coin-spill FX below - an exponential moving average of
  // recent rewards, so "this kill's coin burst" always reads as big/small relative to what's
  // typical *right now*, at any point in the game's exponential economy (a flat coin count
  // would look identical for a 10-gold kill and a 10-billion-gold one).
  const rewardBaselineRef = useRef<BigNumber | null>(null)

  // Resource Vacuum / Multi-Wave Collection / Final Resource Impact (#27-30): reward "coins"
  // fly from the planet to the gold pill (cross-component landmarks, see combatFx/landmarks.ts).
  // No-ops gracefully if either landmark isn't mounted (e.g. a kill happens while off the
  // Combat tab, or before TopBar has laid out) - purely decorative, never blocks the real reward.
  const spawnResourceVacuum = (intensity: number) => {
    const origin = getLandmarkRect('planet')
    const dest = getLandmarkRect('gold-pill')
    const shellRect = shellRef.current?.getBoundingClientRect()
    if (!origin || !dest || !shellRect) return

    const originX = origin.left + origin.width / 2 - shellRect.left
    const originY = origin.top + origin.height / 2 - shellRect.top
    const destX = dest.left + dest.width / 2 - shellRect.left
    const destY = dest.top + dest.height / 2 - shellRect.top
    // Must match .fx-coin's animation-duration in ui.css (pop phase + collect phase).
    const travelMs = 680
    // User-requested: the coin count AND size now scale with how big this reward is relative
    // to recent rewards (intensity, computed by the caller), instead of a flat 8-12 regardless
    // of the actual amount. Sizes bumped up again (was 8-24px) - too subtle to read against the
    // much bigger destruction burst added alongside it, especially starting on the same frame
    // as that burst's flash. START_DELAY_MS lets the coins begin their own beat just after the
    // flash instead of launching into the same instant as the explosion.
    const waveCount = Math.round(10 + intensity * 6)
    const coinPx = Math.round(14 + intensity * 6)
    const START_DELAY_MS = 160

    for (let i = 0; i < waveCount; i++) {
      setTimeout(() => {
        const jitterX = (Math.random() - 0.5) * 26
        const jitterY = (Math.random() - 0.5) * 26
        // Pop phase target: biased UPWARD (reference-GIF motion) - straight up +-55deg spread,
        // each coin its own distance, before the collect phase bends it toward the gold pill.
        const popAngle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9
        const popDist = 30 + Math.random() * 34
        // Slight per-coin timing variation: travel duration and vertical-flip speed both vary
        // a touch so a burst reads organic, not a lockstep formation (see fx-coin-flip).
        const coinTravelMs = Math.round(travelMs * (0.9 + Math.random() * 0.25))
        const flipMs = Math.round(240 + Math.random() * 140)
        spawnRewardParticle({
          className: 'fx-coin',
          x: originX + jitterX,
          y: originY + jitterY,
          durationMs: coinTravelMs,
          style: {
            width: `${coinPx}px`,
            height: `${coinPx}px`,
            animationDuration: `${coinTravelMs}ms`,
            '--px': `${Math.cos(popAngle) * popDist}px`,
            '--py': `${Math.sin(popAngle) * popDist}px`,
            '--tx': `${destX - originX - jitterX}px`,
            '--ty': `${destY - originY - jitterY}px`,
            '--flip-dur': `${flipMs}ms`,
          } as CSSProperties,
        })
        setTimeout(() => {
          spawnRewardParticle({ className: 'fx-coin-sparkle', x: destX, y: destY, durationMs: 260 })
          // Payout ticker: pitch steps up through the batch, slot-machine style.
          audio.coinTick(i + 1)
          const el = getLandmarkElement('gold-pill')
          if (!el) return
          el.classList.remove('fx-gold-punch')
          void el.offsetWidth
          el.classList.add('fx-gold-punch')
        }, coinTravelMs)
      }, START_DELAY_MS + i * 70)
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
        const baseline = rewardBaselineRef.current
        const rawRatio = baseline && baseline.gt(BigNumber.Zero) ? gold.div(baseline).toNumber() : 1
        const intensity = Math.max(0.4, Math.min(4, Number.isFinite(rawRatio) ? rawRatio : 1))
        rewardBaselineRef.current = baseline ? baseline.mul(BigNumber.from(0.85)).add(gold.mul(BigNumber.from(0.15))) : gold
        spawnResourceVacuum(intensity)
        if (planet.isBoss) {
          showToast(`BOSS DEFEATED · +${gold.toShortString()} Stardust`)
          // Death Silence (#46): a beat of hush before the boom lands, so it reads as an impact.
          audio.silence(120)
          audio.bossDown()
          hapticSuccess()
          triggerShake('big')
          // Pack grants are server-side, keyed off save.stats.deepestBossCleared - a boss stage
          // already cleared before (e.g. replayed after a Prestige reset) genuinely earns
          // nothing (see db.mjs's grantPacksFromSave and the one-pack-per-boss fix). The
          // pack-drop flight + banner used to fire unconditionally on every boss kill, so a
          // re-cleared boss showed the "new pack!" celebration for a pack that never arrived.
          // Forcing the push right here (rather than waiting for the periodic CLOUD_PUSH_SECONDS
          // timer) lets a REAL grant show up immediately instead of up to CLOUD_PUSH_SECONDS
          // later; comparing the pack count before/after is what confirms this kill actually
          // earned one before celebrating it.
          //
          // Bug fix: this event (onReward) fires from inside EnemyController.handleDestroyed,
          // which emits onPlanetKilled (-> onReward, this handler) BEFORE it calls
          // stageManager.notifyPlanetKilled() (-> onBossCleared -> stats.deepestBossCleared
          // bump, see GameSession's constructor). Calling syncNow() directly here captured the
          // save BEFORE that update landed, so the very sync meant to reveal this boss's pack
          // always uploaded the OLD count - the server granted 0 packs, and a real pack only
          // ever showed up on a LATER sync (the next boss kill, or the timer catching up).
          // queueMicrotask defers just past the current synchronous call stack - by the time it
          // runs, notifyPlanetKilled() (still part of that same stack) has always already
          // finished, so the capture below sees the correct, just-updated count.
          const pendingPacksBefore = pendingPacksRef.current.length
          queueMicrotask(() => {
            syncNow()
              .then(refreshCards)
              .then((packs) => {
                if (packs.length > pendingPacksBefore) {
                  spawnPackDrop()
                  showPackBanner()
                }
              })
              .catch(() => {}) // offline/unreachable: the periodic sync will pick it up later
          })
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

  // Prestige supernova: the biggest decision in the game gets a real ceremony - white core
  // flash + expanding ring + magenta starburst + relic text slam, all overlay-only (the reset
  // itself already happened in PrestigeConfirmSheet before this fires).
  const [supernova, setSupernova] = useState<{ key: number; relicsText: string } | null>(null)
  const supernovaTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(supernovaTimeout.current), [])
  const handlePrestiged = (relicsGained: BigNumber) => {
    audio.silence(150)
    audio.prestige()
    hapticSuccess()
    triggerShake('big')
    setSupernova((prev) => ({ key: (prev?.key ?? 0) + 1, relicsText: `+${relicsGained.toShortString()} RELICS` }))
    clearTimeout(supernovaTimeout.current)
    supernovaTimeout.current = setTimeout(() => setSupernova(null), 2000)
    const shellRect = shellRef.current?.getBoundingClientRect()
    if (shellRect) {
      const cx = shellRect.width / 2
      const cy = shellRect.height / 2
      for (let i = 0; i < 22; i++) {
        const angle = (i / 22) * Math.PI * 2
        const dist = 120 + Math.random() * 140
        spawnRewardParticle({
          className: 'fx-debris',
          x: cx,
          y: cy,
          durationMs: 900,
          style: {
            width: '7px',
            height: '7px',
            background: i % 3 === 0 ? '#FFFFFF' : 'var(--palette-magenta)',
            animationDuration: '900ms',
            '--tx': `${Math.cos(angle) * dist}px`,
            '--ty': `${Math.sin(angle) * dist}px`,
            '--rot': `${(Math.random() - 0.5) * 540}deg`,
          } as CSSProperties,
        })
      }
    }
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
        : achievementsOpen
          ? 'achievements'
          : leaderboardOpen
            ? 'leaderboard'
            : shopOpen
              ? 'shop'
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
      achievements: () => setAchievementsOpen(false),
      leaderboard: () => setLeaderboardOpen(false),
      shop: () => setShopOpen(false),
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
  // while this tab is backgrounded). Returns the freshly-fetched pack list (not just void) so
  // the boss-kill handler below can tell whether THIS sync actually revealed a new one.
  const refreshCards = async (): Promise<PendingPack[]> => {
    const apiUrl = import.meta.env.VITE_API_URL
    fetchCollection(apiUrl).then(({ cards, dust: dustBalance }) => {
      setOwnedCards(cards)
      setDust(dustBalance)
    })
    const packs = await fetchPendingPacks(apiUrl)
    setPendingPacks(packs)
    return packs
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

  // Stable identities (useCallback): CardsScreen and PackOpeningOverlay are memo()d so the
  // 60fps game-loop re-render of this shell skips them - inline closures here would undo that.
  const handlePackOpened = useCallback((packId: number, result: OpenPackResult) => {
    setPendingPacks((prev) => prev.filter((p) => p.id !== packId))
    // instanceId -1 marks optimistic rows; the next refreshCards() replaces them with server truth.
    setOwnedCards((prev) => [...prev, ...result.cards.map((c) => ({ instanceId: -1, cardId: c.cardId, variant: c.variant, serial: c.serial, mintedAtMs: Date.now() }))])
  }, [])
  const handleSelectCard = useCallback((card: CardDefinition, list: CardDefinition[]) => {
    setSelectedCard(card)
    setSelectedCardList(list)
  }, [])
  const handleOpenPacks = useCallback(() => setPackSheetOpen(true), [])
  const handleClosePackSheet = useCallback(() => setPackSheetOpen(false), [])

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
        onAchievementsClick={() => setAchievementsOpen(true)}
        onLeaderboardClick={() => setLeaderboardOpen(true)}
        onShopClick={() => setShopOpen(true)}
      />
      <Toast text={toastText} />
      <PackEarnedBanner key={packBannerKey} visible={packBannerVisible} />
      {supernova && (
        <div key={supernova.key} className="supernova-overlay">
          <div className="supernova-flash" />
          <div className="supernova-ring" />
          <div className="supernova-text">SUPERNOVA</div>
          <div className="supernova-relics">{supernova.relicsText}</div>
        </div>
      )}

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
            prefsVersion={prefsVersion}
            onSelectCard={handleSelectCard}
            onOpenPacks={handleOpenPacks}
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

      <PrestigeConfirmSheet session={session} open={prestigeConfirmOpen} onClose={() => setPrestigeConfirmOpen(false)} onPrestiged={handlePrestiged} onToast={showToast} />
      <MissionsSheet session={session} open={missionsOpen} onClose={() => setMissionsOpen(false)} onClaimed={() => showToast('MISSION COMPLETE')} />
      <DailyRewardSheet session={session} open={dailyOpen} onClose={() => setDailyOpen(false)} onClaimed={handleDailyClaimed} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} apiBaseUrl={import.meta.env.VITE_API_URL} />
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
      <AchievementsSheet session={session} ownedCards={ownedCards} open={achievementsOpen} onClose={() => setAchievementsOpen(false)} />
      <LeaderboardSheet open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} apiBaseUrl={import.meta.env.VITE_API_URL} />
      <ShopSheet
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        apiBaseUrl={import.meta.env.VITE_API_URL}
        refreshPurchases={refreshPurchases}
        refreshCards={refreshCards}
      />
      <OfflineRewardsSheet offline={offline} open={offlineOpen} onClose={() => setOfflineOpen(false)} onCollected={(gold) => showToast(`+${gold.toShortString()} Stardust collected`)} />
      <ShipUnlockToast unlock={shipUnlock} onClose={() => setShipUnlock(null)} onViewFleet={() => setTab('fleet')} />
      <CardDetailSheet
        card={selectedCard}
        owned={selectedCard ? (cardOwnedSummary.get(selectedCard.id) ?? null) : null}
        open={selectedCard !== null}
        onClose={() => {
          setSelectedCard(null)
          setPrefsVersion((v) => v + 1)
        }}
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
      <PackOpeningOverlay apiBaseUrl={import.meta.env.VITE_API_URL} pendingPacks={pendingPacks} onOpened={handlePackOpened} open={packSheetOpen} onClose={handleClosePackSheet} />
    </div>
  )
}
