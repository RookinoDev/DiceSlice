// Ported from GamePhone.dc.html's Main/Combat screen. Legendary variant intentionally
// omitted - our real StageManager only has Normal/Boss stages.
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Sheet } from '../Sheet'
import type { GameSession } from '../../game/gameplay/GameSession'
import { buildMainViewModel } from '../../game/ui/MainPresenter'
import { planetMaxScale } from '../../planet/planetProfiles'
import { realPlanetForStage, type RealPlanet } from '../../planet/realPlanets'
import type { PlanetImpulseApi } from '../../planet/PlanetCanvas'
import { audio } from '../../game/audio/AudioManager'
import { hapticAction, hapticSuccess, hapticTap } from '../../telegram'
import { SkillOverdriveIcon } from '../icons'
import { SKILL_ICONS } from '../skillIcons'
import { cooldownWipeStyle } from '../cooldownWipe'
import { usePlanetHitFlash } from '../usePlanetHitFlash'
import { useScreenShake } from '../useScreenShake'
import { useTapStreak } from '../useTapStreak'
import { useOverdriveJuice } from '../useOverdriveJuice'
import { useBestHit } from '../useBestHit'
import { SkillType } from '../../game/config/SkillDefinition'
import { BigNumber } from '../../game/core/BigNumber'
import { useParticles } from '../combatFx/useParticles'
import { ParticleLayer } from '../combatFx/ParticleLayer'
import { registerLandmark } from '../combatFx/landmarks'
import { impactMaterialFor } from '../planetImpactMaterial'
import { FleetSiegeOrbit } from '../fleetSiege/FleetSiegeOrbit'

// Three.js + the shader modules are ~600KB - split into their own chunk so the game shell
// (buttons, screens, sheets) is interactive before that finishes downloading.
const PlanetCanvas = lazy(() => import('../../planet/PlanetCanvas').then((m) => ({ default: m.PlanetCanvas })))

const NORMAL_TAP_IMPULSE = 0.045
const OVERDRIVE_TAP_IMPULSE = 0.075
const SKILL_DAMAGE_IMPULSE = 0.11
const COMBO_SOUND_STEP = 5
/** Multi-touch tapping: this many fingers can tap the planet at once, each landing its own hit. */
const MAX_CONCURRENT_TAP_POINTERS = 5
/** Rapid-upgrade taps within this gap count toward the escalation streak. */
const UPGRADE_ESCALATION_GAP_MS = 500
/** Boss hull fraction below which Planetary Instability jitter/core-pulse kicks in. */
const INSTABILITY_THRESHOLD = 0.25
/** A single hit removing more than this fraction of max HP shakes the living boss health bar. */
const HP_BAR_SHAKE_DROP = 0.04
/** Per-second exponential catch-up rate for the HP fill bar (see #5 fix, same idea as useCountUp's CATCH_UP_RATE). */
const HP_FILL_CATCH_UP_RATE = 10
/** Rare-roll odds for the Secret Rare Destruction variant - cosmetic lottery, not gameplay. */
const SECRET_DESTRUCTION_CHANCE = 1 / 300
/** User-requested: no hold at all - the next planet swaps in immediately (EnemyController has
 * already spawned it synchronously with zero delay; this used to add a display-only pause on
 * top of that, which is exactly what shouldn't happen anymore). */
const DESTRUCTION_PAUSE_MS = 0
/** #7 fix: the next planet's scale/fade/flash entrance duration. */
const PLANET_ENTRANCE_MS = 460

// Milestone Visual Evolution (#37) - the tap-damage icon's color tiers up with real tap level.
function tapIconTierColor(level: number): string {
  if (level >= 100) return '#F49CFF'
  if (level >= 50) return '#8FE3FF'
  if (level >= 25) return '#43DDEE'
  if (level >= 10) return '#FFC24D'
  return '#FFB238'
}

function comboTierClass(count: number): string {
  if (count >= 50) return 'combo-tier-3'
  if (count >= 20) return 'combo-tier-2'
  if (count >= 5) return 'combo-tier-1'
  return ''
}

function spawnDebris(spawn: ReturnType<typeof useParticles>['spawn'], x: number, y: number, color: string) {
  const count = 2 + Math.floor(Math.random() * 3)
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = 18 + Math.random() * 26
    spawn({
      className: 'fx-debris',
      x,
      y,
      durationMs: 420,
      style: {
        '--tx': `${Math.cos(angle) * dist}px`,
        '--ty': `${Math.sin(angle) * dist}px`,
        '--rot': `${(Math.random() - 0.5) * 240}deg`,
        background: color,
        animationDuration: '420ms',
      } as CSSProperties,
    })
  }
}

// Overkill Destruction / Secret Rare Destruction (#23, #63) - classified from the real,
// already-computed overkill remainder (see Planet.applyDamage), not a fake mechanic. "secret"
// is a pure cosmetic lottery roll, independent of gameplay.
type DestructionPreset = 'normal' | 'fragmentation' | 'split' | 'implosion' | 'secret'

function destructionPreset(overkillRatio: number, secret: boolean): DestructionPreset {
  if (secret) return 'secret'
  if (overkillRatio > 1.5) return 'implosion'
  if (overkillRatio > 0.5) return 'split'
  if (overkillRatio > 0.1) return 'fragmentation'
  return 'normal'
}

// User-requested: juicier bursts now that the next planet swaps in immediately (no more 1.5s
// hold for the explosion to read against) - counts/spread bumped up a tier across the board.
const DESTRUCTION_CONFIG: Record<DestructionPreset, { count: number; distMin: number; distMax: number; duration: number }> = {
  normal: { count: 10, distMin: 26, distMax: 56, duration: 500 },
  fragmentation: { count: 18, distMin: 34, distMax: 84, duration: 580 },
  split: { count: 20, distMin: 44, distMax: 104, duration: 640 },
  implosion: { count: 26, distMin: 56, distMax: 128, duration: 780 },
  secret: { count: 34, distMin: 46, distMax: 140, duration: 820 },
}

function spawnDestructionBurst(spawn: ReturnType<typeof useParticles>['spawn'], x: number, y: number, color: string, preset: DestructionPreset) {
  const cfg = DESTRUCTION_CONFIG[preset]
  for (let i = 0; i < cfg.count; i++) {
    let angle = Math.random() * Math.PI * 2
    if (preset === 'split') {
      // Two opposite arcs instead of a full radial spray - reads as a planet cleaving in half.
      angle = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.9
    }
    const dist = cfg.distMin + Math.random() * (cfg.distMax - cfg.distMin)
    spawn({
      className: `fx-debris ${preset === 'implosion' ? 'fx-debris--implode' : ''} ${preset === 'secret' ? 'fx-debris--secret' : ''}`,
      x,
      y,
      durationMs: cfg.duration,
      style: {
        '--tx': `${Math.cos(angle) * dist}px`,
        '--ty': `${Math.sin(angle) * dist}px`,
        '--rot': `${(Math.random() - 0.5) * 480}deg`,
        ...(preset === 'secret' ? {} : { background: color }),
        animationDuration: `${cfg.duration}ms`,
      } as CSSProperties,
    })
  }
}

interface CombatScreenProps {
  session: GameSession
  onToast: (text: string) => void
  onSkillActivated: (label: string) => void
}

export function CombatScreen({ session: s, onToast, onSkillActivated }: CombatScreenProps) {
  const vm = buildMainViewModel(s)
  // Deterministic real-world body for this sector; recomputed only when the actual planet
  // instance changes (new spawn), not every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const target = useMemo(() => realPlanetForStage(s.enemy.current?.stage ?? s.stage.currentStage, s.bossStageInterval), [s.enemy.current])
  const { ref: planetRef, pulse: pulsePlanet } = usePlanetHitFlash(s)
  const { ref: screenRef, triggerShake } = useScreenShake<HTMLDivElement>()
  const { count: tapStreak, fading: comboFading, inRhythm, registerTap } = useTapStreak()
  const { phase: overdrivePhase, countdownText: overdriveCountdown } = useOverdriveJuice(s)
  const { containerRef: particlesRef, spawn: spawnParticle } = useParticles()
  const impulseApiRef = useRef<PlanetImpulseApi | null>(null)
  const overdriveActive = s.skills.isActive(SkillType.Overdrive)
  const overdriveSecondsLeft = overdriveActive ? Math.ceil(s.skills.activeTimeLeft(SkillType.Overdrive)) : 0
  const overdrivePanic = overdriveActive && overdriveSecondsLeft <= 2
  const { checkRecord } = useBestHit()
  const [recordText, setRecordText] = useState<string | null>(null)
  const recordTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [prevDamageText, setPrevDamageText] = useState<string | null>(null)
  const damageTextRef = useRef(vm.tapDamageText)
  const [upgradePulse, setUpgradePulse] = useState(0)
  const lastUpgradeAt = useRef(0)
  const upgradeStreak = useRef(0)
  const lastImpactRef = useRef({ x: 0, y: 0 })
  /** Multi-touch tapping: each finger that lands on the planet independently taps, up to
   * MAX_CONCURRENT_TAP_POINTERS at once - tracked so extra fingers beyond that don't tap twice
   * on their own pointerup/down noise, and so we know when to release the capped slot. */
  const activeTapPointers = useRef<Set<number>>(new Set())
  // #6/#7 fix: the destroyed planet's visual (mesh + name) holds for a beat instead of
  // snapping straight to the next target the instant EnemyController spawns it - purely a
  // display decoupling, targetRef always tracks the real live target so the pause can read
  // "whatever's current" once it's over, without re-subscribing to anything.
  const targetRef = useRef(target)
  targetRef.current = target
  const [displayTarget, setDisplayTarget] = useState<RealPlanet>(target)
  const [destructionPhase, setDestructionPhase] = useState<'idle' | 'destroying' | 'entering'>('idle')
  const destructionTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    if (destructionPhase === 'idle') setDisplayTarget(target)
  }, [target, destructionPhase])
  useEffect(() => () => destructionTimers.current.forEach(clearTimeout), [])
  // The rendered mesh/scale/material track displayTarget (frozen during the destruction pause),
  // not the live target - see the effect above.
  const profile = displayTarget.profile
  const planetScale = planetMaxScale(profile)
  const material = useMemo(() => impactMaterialFor(profile), [profile])
  const materialRef = useRef(material)
  materialRef.current = material
  const [hpBarShake, setHpBarShake] = useState(0)
  // Boss intro slam + sector milestone stamp: pure overlays keyed to force a fresh animation
  // per occurrence; neither pauses gameplay (per the no-delay rule for planet swaps).
  const [bossIntroKey, setBossIntroKey] = useState(0)
  const [bossIntroName, setBossIntroName] = useState<string | null>(null)
  const bossIntroTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [sectorStamp, setSectorStamp] = useState<number | null>(null)
  const sectorStampTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // #3 fix: skill icons had no visible name and no touch-friendly way to read their
  // description (only a `title` tooltip, which mobile/touch never shows) - a small "?" opens
  // a sheet listing every skill's name+description instead.
  const [skillInfoOpen, setSkillInfoOpen] = useState(false)
  const prevHpFractionRef = useRef(vm.hpFraction)
  // #5 fix: Drone Swarm applies damage every single tick (GameSession.tick() -> applyDamage()
  // runs every rAF frame while active), so vm.hpFraction changes ~60x/sec during its uptime.
  // The bar's width used to be React-driven straight from vm.hpFraction with a CSS
  // `transition: width 0.15s linear` for the nice slide-on-hit feel - fine for a single discrete
  // tap hit, but a 150ms transition retargeted every ~16ms never gets anywhere near where it's
  // chasing, so the fill visibly lagged/stalled behind the real (correctly-updating) HP number.
  // Same fix as useCountUp.ts: own the smoothing with a persistent rAF exponential chase and
  // write width directly to the DOM, instead of fighting a CSS transition with a moving target.
  const hpFillRef = useRef<HTMLDivElement>(null)
  const hpTargetRef = useRef(vm.hpFraction)
  const hpDisplayedRef = useRef(vm.hpFraction)
  hpTargetRef.current = vm.hpFraction
  // Planetary Instability (#16, #45, #70): a boss below the hull threshold gets small
  // periodic jitter + a core-pulse glow, driven off the real hpFraction01() - no fake danger.
  const unstable = vm.isBoss && vm.hpFraction > 0 && vm.hpFraction < INSTABILITY_THRESHOLD

  // Record-Breaking Hit Celebration (#60) - a deterministic personal-best check (see
  // useBestHit.ts), not a fake crit roll. Any damage source (tap/skill/drone) can set it.
  useEffect(() => {
    return s.taps.onDamageDealt.on((e) => {
      if (checkRecord(e.amount)) {
        clearTimeout(recordTimeout.current)
        setRecordText(`NEW RECORD · ${e.amount.toShortString()}`)
        audio.purchase()
        hapticSuccess()
        recordTimeout.current = setTimeout(() => setRecordText(null), 1300)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s])

  // Show the Power Difference (#34) - remember the previous tap-damage text briefly so the
  // old value can visibly get pushed out by the new one instead of just silently changing.
  useEffect(() => {
    if (damageTextRef.current !== vm.tapDamageText) {
      setPrevDamageText(damageTextRef.current)
      damageTextRef.current = vm.tapDamageText
      const t = setTimeout(() => setPrevDamageText(null), 500)
      return () => clearTimeout(t)
    }
  }, [vm.tapDamageText])

  // Registers the planet's on-screen position so GameShell's Resource Vacuum particles know
  // where to fly from, without prop-drilling a ref up through the whole shell.
  useEffect(() => {
    registerLandmark('planet', planetRef.current)
    return () => registerLandmark('planet', null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return s.onReward.on(({ planet, overkill }) => {
      triggerShake('small')
      if (planet.maxHp.lte(BigNumber.Zero)) return
      const ratio = overkill.div(planet.maxHp).toNumber()
      const secret = Math.random() < SECRET_DESTRUCTION_CHANCE
      const preset = destructionPreset(ratio, secret)
      const { x, y } = lastImpactRef.current
      // #6 fix: flash + shockwave ring ahead of the existing colored debris burst.
      spawnParticle({ className: 'fx-destruct-flash', x, y, durationMs: 260 })
      spawnParticle({ className: 'fx-destruct-shock', x, y, durationMs: 520 })
      spawnDestructionBurst(spawnParticle, x, y, materialRef.current.debrisColor, preset)
      // Second explosion layer, slightly offset in time: a follow-up ring plus a small gold
      // spark burst so the destruction reads as staged (boom... BOOM) rather than one frame of
      // everything at once. spawn() no-ops safely if the screen unmounted mid-delay.
      const debrisColor = materialRef.current.debrisColor
      setTimeout(() => {
        spawnParticle({ className: 'fx-destruct-shock', x, y, durationMs: 460 })
        spawnDestructionBurst(spawnParticle, x, y, '#FFD873', 'normal')
        spawnDebris(spawnParticle, x, y, debrisColor)
      }, 130)
      if (secret) {
        clearTimeout(recordTimeout.current)
        setRecordText('★ RARE DESTRUCTION ★')
        audio.prestige()
        hapticSuccess()
        recordTimeout.current = setTimeout(() => setRecordText(null), 1600)
      }

      // #6/#7 fix: hold on the destroyed planet's (fading) visual for a beat, then swap the
      // display to whatever's live now and play its entrance. EnemyController already spawned
      // the next planet synchronously above, with zero delay - reward/stage/economy don't wait
      // on any of this, only the mesh/name shown here does.
      setDestructionPhase('destroying')
      const holdTimer = setTimeout(() => {
        setDisplayTarget(targetRef.current)
        setDestructionPhase('entering')
        const enterTimer = setTimeout(() => setDestructionPhase('idle'), PLANET_ENTRANCE_MS)
        destructionTimers.current.push(enterTimer)
      }, DESTRUCTION_PAUSE_MS)
      destructionTimers.current.push(holdTimer)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s])

  // Living Boss Health Bar (#43): a single hit that removes a big chunk of max HP shakes the
  // bar itself, distinct from the constant small-tap drain.
  useEffect(() => {
    const drop = prevHpFractionRef.current - vm.hpFraction
    if (vm.isBoss && drop > HP_BAR_SHAKE_DROP) setHpBarShake((n) => n + 1)
    prevHpFractionRef.current = vm.hpFraction
  }, [vm.hpFraction, vm.isBoss])

  // HP bar fill: persistent rAF chase (see #5 fix comment above) instead of a CSS transition -
  // one loop for the life of the screen, not restarted per render/target change.
  useEffect(() => {
    let raf = 0
    let last = 0
    const step = (now: number) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
      last = now
      const from = hpDisplayedRef.current
      const to = hpTargetRef.current
      const diff = to - from
      if (dt > 0 && diff !== 0) {
        const closeEnough = Math.abs(diff) < 0.001
        hpDisplayedRef.current = closeEnough ? to : from + diff * (1 - Math.exp(-HP_FILL_CATCH_UP_RATE * dt))
      }
      if (hpFillRef.current) hpFillRef.current.style.width = `${hpDisplayedRef.current * 100}%`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (!unstable) return
    const id = setInterval(() => {
      const rect = planetRef.current?.getBoundingClientRect()
      if (!rect) return
      const angle = Math.random() * Math.PI * 2
      impulseApiRef.current?.impulse(rect.width / 2 + Math.cos(angle) * rect.width * 0.3, rect.height / 2 + Math.sin(angle) * rect.height * 0.3, 0.03)
    }, 450)
    return () => clearInterval(id)
  }, [unstable])

  // Skill instant-damage (Meteor Strike) also physically kicks the planet, from a
  // pseudo-random point near center since it has no real tap position of its own.
  useEffect(() => {
    return s.onSkillDamage.on(() => {
      const rect = planetRef.current?.getBoundingClientRect()
      if (!rect) return
      const angle = Math.random() * Math.PI * 2
      const x = rect.width / 2 + Math.cos(angle) * rect.width * 0.15
      const y = rect.height / 2 + Math.sin(angle) * rect.height * 0.15
      lastImpactRef.current = { x, y }
      impulseApiRef.current?.impulse(x, y, SKILL_DAMAGE_IMPULSE)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s])

  // bossSecondsLeft is Math.ceil'd in MainPresenter, so it only changes once per second -
  // this effect naturally fires once per final countdown second, no dedup ref needed.
  useEffect(() => {
    if (vm.bossActive && vm.bossSecondsLeft > 0 && vm.bossSecondsLeft <= 5) {
      audio.bossTick()
      // Timer-panic heartbeat under the tick: a low thump so the countdown is felt, not
      // just heard, and losing to the timer reads as a near-miss instead of a surprise.
      audio.heartbeat()
      hapticTap()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.bossActive, vm.bossSecondsLeft])

  // Boss intro slam: the boss already existed the frame it spawned, but nothing announced it -
  // a short dim + name slam-in overlay (gameplay keeps running underneath).
  useEffect(() => {
    return s.stage.onBossStarted.on(() => {
      setBossIntroKey((k) => k + 1)
      setBossIntroName(realPlanetForStage(s.stage.currentStage, s.bossStageInterval).name)
      triggerShake('big')
      hapticAction()
      clearTimeout(bossIntroTimeout.current)
      bossIntroTimeout.current = setTimeout(() => setBossIntroName(null), 1400)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s])

  // Sector milestone stamp every 10th sector - visible chapter breaks in the endless climb.
  useEffect(() => {
    return s.stage.onStageEntered.on((stage) => {
      if (stage % 10 !== 0) return
      setSectorStamp(stage)
      audio.prestige()
      clearTimeout(sectorStampTimeout.current)
      sectorStampTimeout.current = setTimeout(() => setSectorStamp(null), 1500)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s])
  useEffect(() => () => {
    clearTimeout(bossIntroTimeout.current)
    clearTimeout(sectorStampTimeout.current)
  }, [])

  // #2 fix: tightened from <=15 to <=5 - the pill redesign's ring is legible enough at a
  // glance that flagging urgency 15s out (a third of most boss timers) read as alarmist.
  const bossUrgent = vm.bossSecondsLeft <= 5
  const bossTimePct = Math.max(0, Math.min(100, (vm.bossSecondsLeft / s.bossTimerSeconds) * 100))
  const hpColor = vm.isBoss ? 'var(--palette-danger)' : 'var(--palette-cyan)'

  return (
    <div
      ref={screenRef}
      className={`screen combat-screen ${comboTierClass(tapStreak)} ${overdriveActive ? 'combat-screen--overdrive' : ''} ${overdrivePanic ? 'combat-screen--overdrive-panic' : ''} ${vm.bossActive && bossUrgent ? 'combat-screen--boss-panic' : ''}`}
    >
      <div className="combat-combo-backdrop" />
      {bossIntroName && (
        <div key={bossIntroKey} className="boss-intro">
          <div className="boss-intro-label">⚠ BOSS ENCOUNTER ⚠</div>
          <div className="boss-intro-name">{bossIntroName}</div>
        </div>
      )}
      {sectorStamp !== null && (
        <div key={sectorStamp} className="sector-stamp">
          SECTOR {sectorStamp}
        </div>
      )}
      {overdrivePhase === 'countdown' && (
        <div key={overdriveCountdown} className={`overdrive-countdown ${overdriveCountdown === 'OVERDRIVE' ? 'overdrive-countdown--go' : ''}`}>
          {overdriveCountdown}
        </div>
      )}
      <div className="combat-eyebrow">
        {vm.bossActive ? (
          <div className="combat-boss-badge">
            <div className="combat-boss-label">BOSS ENCOUNTER</div>
            <div className="combat-boss-name-row">
              <div className="combat-boss-name">{displayTarget.name}</div>
              {/* #2 fix: a glass pill with a conic-gradient ring for "time left at a glance"
                  replaces the old bar+bold-number row, and sits beside the name instead of
                  stacked under it. */}
              {/* key on the urgent pill: each final-5 second remounts it so the digit-pop
                  animation replays per second, escalating with the heartbeat/tick. */}
              <div
                key={bossUrgent ? vm.bossSecondsLeft : 'calm'}
                className={`combat-boss-timer-pill ${bossUrgent ? 'combat-boss-timer-pill--urgent' : ''}`}
                style={{ '--boss-pct': `${bossTimePct}%` } as CSSProperties}
              >
                0:{String(vm.bossSecondsLeft).padStart(2, '0')}
              </div>
            </div>
          </div>
        ) : (
          <div className="combat-sector-caption">SECTOR {s.stage.currentStage} TARGET</div>
        )}
      </div>

      {/* Boss encounters already show the name once, beside the timer, in .combat-boss-name
          above - repeating it here would print it twice on screen. */}
      {!vm.bossActive && <div className="combat-target-name">{displayTarget.name}</div>}

      {/* #1 fix: HP bar now sits right under the planet's name, not below the planet art. */}
      <div key={hpBarShake} className={`combat-hp-bar ${hpBarShake > 0 ? 'combat-hp-bar--shake' : ''}`}>
        <div className="combat-hp-track">
          <div
            ref={(el) => {
              hpFillRef.current = el
              // Correct width on first paint - the rAF loop only starts writing from its
              // next frame, and by then hpDisplayedRef already matches (both init to
              // vm.hpFraction at mount), so this is just avoiding a one-frame flash to 0%.
              if (el) el.style.width = `${hpDisplayedRef.current * 100}%`
            }}
            className="combat-hp-fill"
            style={{ background: hpColor }}
          />
        </div>
        <div className="combat-hp-caption-row">
          <span className="combat-hp-caption">HULL INTEGRITY</span>
          <span className="combat-hp-label">{vm.hpText}</span>
        </div>
      </div>

      <div className={`combat-planet-wrap ${unstable ? 'combat-planet-wrap--unstable' : ''}`}>
        {tapStreak >= 5 && (
          <div key={tapStreak} className={`combo-chip ${comboFading ? 'combo-chip--fading' : ''} ${inRhythm ? 'combo-chip--rhythm' : ''}`}>
            ×{tapStreak} COMBO
          </div>
        )}
        <FleetSiegeOrbit
          session={s}
          planetRef={planetRef}
          impulseApiRef={impulseApiRef}
          triggerShake={triggerShake}
          bossActive={vm.bossActive}
          bossSecondsLeft={vm.bossSecondsLeft}
          bossTimerSeconds={s.bossTimerSeconds}
        />
        <button
          ref={planetRef}
          className={`combat-planet ${destructionPhase !== 'idle' ? `combat-planet--${destructionPhase}` : ''}`}
          style={{ '--planet-scale': planetScale } as CSSProperties}
          onPointerDown={(e) => {
            // Multi-touch tapping (up to MAX_CONCURRENT_TAP_POINTERS fingers): pointerdown
            // fires once per finger independently, unlike click which the browser collapses
            // multiple simultaneous touches on one element down to a single event - each
            // tracked pointer lands its own full tap.
            if (activeTapPointers.current.size >= MAX_CONCURRENT_TAP_POINTERS) return
            if (activeTapPointers.current.has(e.pointerId)) return
            activeTapPointers.current.add(e.pointerId)
            try {
              e.currentTarget.setPointerCapture(e.pointerId)
            } catch {
              // Capture is a nicety for cleanup if a finger slides off-element; a missing
              // pointerup for it just leaves one slot stuck until pointercancel, never fatal.
            }

            s.tap()
            const { count: newStreak, isMilestone } = registerTap()
            if (isMilestone) hapticAction()
            else hapticTap()
            pulsePlanet()
            if (newStreak % COMBO_SOUND_STEP === 0) audio.combo(newStreak / COMBO_SOUND_STEP)

            // True impact position: where the player actually tapped, not always center.
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            lastImpactRef.current = { x, y }
            const impulseStrength = overdriveActive ? OVERDRIVE_TAP_IMPULSE : NORMAL_TAP_IMPULSE
            impulseApiRef.current?.impulse(x, y, impulseStrength)
            material.playImpactSound()
            spawnParticle({ className: 'fx-tap-ghost', x, y, durationMs: 500, style: { '--tx': '0px', '--ty': '0px' } as CSSProperties })
            if (Math.random() < (overdriveActive ? 0.7 : 0.35)) spawnDebris(spawnParticle, x, y, material.debrisColor)
            // Combo fever (x50+): every tap throws extra gold sparks on top of the planet's
            // golden rim glow (see .combo-tier-3 .combat-planet in ui.css) - a visible "on
            // fire" state worth protecting.
            if (newStreak >= 50) spawnDebris(spawnParticle, x, y, '#FFD873')
          }}
          onPointerUp={(e) => activeTapPointers.current.delete(e.pointerId)}
          onPointerCancel={(e) => activeTapPointers.current.delete(e.pointerId)}
          aria-label="Tap to attack"
        >
          {/* #7 fix: a soft flash behind the planet as the next one enters. */}
          {destructionPhase === 'entering' && <div className="combat-planet-entry-flash" />}
          <Suspense fallback={<div className="combat-planet-visual combat-planet-loading" />}>
            <PlanetCanvas profile={profile} className="combat-planet-visual" onReady={(api) => (impulseApiRef.current = api)} hpFraction={vm.hpFraction} />
          </Suspense>
          <ParticleLayer containerRef={particlesRef} />
        </button>
      </div>

      <div className="combat-skills">
        {vm.skills.map((sk, skillIndex) => {
          const Icon = SKILL_ICONS[sk.type] ?? SkillOverdriveIcon
          // #4 fix: secondsLeft/totalSeconds double as BOTH "buff time remaining" (while active)
          // and "time until usable again" (while on cooldown) - see MainPresenter.ts's ternary.
          // The dark cooldown-wipe + countdown number were rendering unconditionally whenever
          // !ready, which is true through the ENTIRE active+cooldown span, so an active buff
          // showed the same "mostly-dark circle with a number floating in the middle" chrome as
          // a recharging, unusable skill - reading as a stuck/frozen icon. Only show the
          // cooldown-style wipe/number during actual cooldown; active gets its own bright glow.
          const glyphColor = sk.ready || sk.active ? '#F4F6FB' : '#4A5170'
          return (
            <div key={sk.type} className="skill-slot-wrap">
              <button
                className={`skill-slot ${sk.ready ? 'ready' : ''} ${sk.active ? 'skill-slot--active' : ''}`}
                // Tutorial spotlight target for the first skill to unlock (see TutorialSteps.ts).
                ref={skillIndex === 0 ? (el) => registerLandmark('skill-0', el) : undefined}
                disabled={!sk.ready}
                onClick={() => {
                  if (s.activateSkill(sk.type)) {
                    audio.skill()
                    hapticAction()
                    onSkillActivated(sk.label)
                  }
                }}
                title={sk.description}
              >
                <Icon color={glyphColor} />
                {!sk.active && <div className="skill-cooldown-overlay" style={cooldownWipeStyle(sk.secondsLeft, sk.totalSeconds)} />}
                {!sk.active && sk.secondsLeft > 0 && !sk.ready && <div className="skill-cooldown-label">{sk.secondsLeft}</div>}
              </button>
              {/* #3 fix: a short name under each icon - previously only readable via a
                  hover `title`, which never shows on touch. */}
              <div className="skill-slot-name">{sk.label}</div>
            </div>
          )
        })}
        <button className="combat-skills-info-btn" onClick={() => setSkillInfoOpen(true)} aria-label="Powerup descriptions">
          ?
        </button>
      </div>

      <Sheet open={skillInfoOpen} onClose={() => setSkillInfoOpen(false)} title="POWERUPS">
        <div className="skill-info-list">
          {vm.skills.map((sk) => {
            const InfoIcon = SKILL_ICONS[sk.type] ?? SkillOverdriveIcon
            return (
              <div key={sk.type} className="skill-info-row">
                <div className="skill-info-icon">
                  <InfoIcon color="#F4F6FB" />
                </div>
                <div>
                  <div className="skill-info-name">{sk.label}</div>
                  <div className="skill-info-desc">{sk.description}</div>
                </div>
              </div>
            )
          })}
        </div>
      </Sheet>

      {recordText && (
        <div key={recordText} className="record-hit-banner">
          {recordText}
        </div>
      )}

      {vm.showUpgradeTap && (
        <div className="combat-tap-footer">
          <button
            className={`combat-tap-upgrade ${vm.canUpgradeTap ? 'affordable' : ''}`}
            ref={(el) => registerLandmark('tap-upgrade', el)}
            onClick={() => {
              if (s.upgradeTapDamage()) {
                // Rapid Upgrade Escalation (#36) - quick successive upgrades ramp the flourish:
                // past 3 in a row under the gap window, escalate to the stronger haptic/sound.
                const now = performance.now()
                upgradeStreak.current = now - lastUpgradeAt.current <= UPGRADE_ESCALATION_GAP_MS ? upgradeStreak.current + 1 : 1
                lastUpgradeAt.current = now
                if (upgradeStreak.current >= 3) {
                  hapticSuccess()
                  audio.combo(Math.min(8, upgradeStreak.current))
                } else {
                  hapticAction()
                  audio.purchase()
                }
                setUpgradePulse((n) => n + 1)
              } else onToast('NOT ENOUGH STARDUST')
            }}
          >
            <div className="combat-tap-info">
              <div
                key={upgradePulse}
                className={`combat-tap-icon-chip ${upgradePulse > 0 ? 'combat-tap-icon-chip--pulse' : ''} ${upgradeStreak.current >= 3 ? 'combat-tap-icon-chip--pulse-strong' : ''}`}
              >
                <SkillOverdriveIcon color={vm.canUpgradeTap ? tapIconTierColor(vm.tapLevel) : '#5C6480'} size={18} />
              </div>
              <div className="combat-tap-text">
                <div className="combat-tap-level">TAP DAMAGE · LV.{vm.tapLevel}</div>
                <div className="combat-tap-damage-wrap">
                  {prevDamageText && (
                    <span key={`${prevDamageText}-old`} className="combat-tap-damage-old">
                      {prevDamageText}
                    </span>
                  )}
                  <span key={vm.tapDamageText} className="combat-tap-damage">
                    {vm.tapDamageText} per tap
                  </span>
                </div>
              </div>
            </div>
            <div className="combat-tap-cost-block">
              <div className="combat-tap-cost-caption">UPGRADE</div>
              <div className="combat-tap-cost">{vm.tapUpgradeCostText}</div>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
