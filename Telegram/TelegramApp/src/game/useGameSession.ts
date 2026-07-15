// React game loop + persistence, replacing StellarBreakerBootstrap's Update()/Start()
// (MonoBehaviour lifecycle, PlayerPrefs) with requestAnimationFrame + localStorage.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { BigNumber } from './core/BigNumber'
import { defaultBalanceConfig, type BalanceConfig } from './config/BalanceConfig'
import { createGameSession } from './createGameSession'
import type { GameSession } from './gameplay/GameSession'
import { offlineIncomePerSecond } from './economy/OfflineIncome'
import { offlineEarningsFromConfig } from './economy/OfflineEarnings'
import { applySave, captureSave } from './persistence/SaveBinder'
import { loadSave, nowUnixSeconds, writeSave } from './persistence/localStorageSave'
import { fetchCloudSave, pickBetterSave, pushCloudSave } from './persistence/cloudSave'
import { applyGrants, claimPendingPurchases, type PurchaseGrant } from './monetization/purchases'

const AUTOSAVE_SECONDS = 15
const CLOUD_PUSH_SECONDS = 60
/** Clamp a single frame's delta so a throttled/backgrounded tab can't apply one giant tick. */
const MAX_FRAME_DELTA = 0.25

export interface OfflineReport {
  seconds: number
  gold: BigNumber
}

interface Boot {
  session: GameSession
  offline: OfflineReport | null
}

function loadAndBegin(cfg: BalanceConfig): Boot {
  const session = createGameSession(cfg)
  let offline: OfflineReport | null = null

  const saved = loadSave()
  if (saved) {
    applySave(session, saved) // currency, tap level, ships, stage - before begin()

    const now = nowUnixSeconds()
    const last = saved.lastSaveUnixSeconds
    if (last > 0 && last <= now) {
      const stage = session.stage.currentStage
      const income = offlineIncomePerSecond(session.ships.fleetDps(), session.stage.hpFor(stage), session.stage.goldFor(stage))
      // Phoenix Cinders (see #13) - artifact levels are already restored by applySave above.
      const gold = offlineEarningsFromConfig(last, now, income, cfg).mul(session.artifacts.offlineRewardMultiplier())
      if (gold.gt(BigNumber.Zero)) {
        session.wallet.add(gold)
        offline = { seconds: Math.min(now - last, cfg.offlineCapHours * 3600), gold }
      }
    }
  }

  session.begin()
  return { session, offline }
}

/**
 * Boots (or resumes) a GameSession, runs its tick loop off requestAnimationFrame, and
 * autosaves to localStorage periodically plus on tab hide/unload. Triggers a React
 * re-render on every session event so components reading session state stay fresh.
 *
 * Cloud saves: shortly after boot the save is reconciled against the per-user copy on
 * the bot server. If the cloud copy shows more progress (new device, cleared WebView),
 * the session is rebooted from it - `cloudRestores` increments so the UI can announce
 * it. Otherwise the local save is pushed up, and re-pushed periodically while playing.
 * Pushes stay disabled until one load has succeeded, so a fresh install can never
 * overwrite an unseen cloud save.
 */
export function useGameSession(cfg: BalanceConfig = defaultBalanceConfig) {
  const [boot, setBoot] = useState<Boot>(() => loadAndBegin(cfg))
  const { session, offline } = boot

  // The live session; loop/persist closures over an older session check against this
  // after a cloud-restore swap so they can't clobber the restored save on cleanup.
  const activeSessionRef = useRef(session)
  activeSessionRef.current = session

  const cloudReadyRef = useRef(false)
  const reconcileInFlightRef = useRef(false)
  const [cloudRestores, setCloudRestores] = useState(0)

  const listenersRef = useRef(new Set<() => void>())
  const versionRef = useRef(0)
  const [claimedGrants, setClaimedGrants] = useState<PurchaseGrant[]>([])
  // The server marks each purchase claimed exactly once, so grants applied to a session
  // that a cloud restore then discards would be paid-for and gone. This ref lets the
  // restore path re-apply them to the new session (they can never be in the cloud copy -
  // it was written before this device claimed them).
  const claimedGrantsRef = useRef<PurchaseGrant[]>([])

  /** Write localStorage now and, once cloud sync is up, mirror the same snapshot there. */
  const syncNow = (keepalive = false) => {
    const state = captureSave(activeSessionRef.current)
    writeSave(state)
    if (cloudReadyRef.current) pushCloudSave(import.meta.env.VITE_API_URL, state, keepalive)
  }

  useEffect(() => {
    let cancelled = false

    const reconcile = async () => {
      if (cloudReadyRef.current || reconcileInFlightRef.current) return
      reconcileInFlightRef.current = true
      try {
        const res = await fetchCloudSave(import.meta.env.VITE_API_URL)
        if (cancelled || !res.ok) return // failed/offline: retry on next foreground, keep pushes disabled
        cloudReadyRef.current = true

        const local = captureSave(activeSessionRef.current)
        const winner = pickBetterSave(local, res.save)
        if (res.save && winner === res.save) {
          // Cloud has more progress: reboot from it through the normal load path so
          // offline earnings since its timestamp are granted like any other launch.
          writeSave(res.save)
          const newBoot = loadAndBegin(cfg)
          if (claimedGrantsRef.current.length > 0) applyGrants(newBoot.session, claimedGrantsRef.current)
          setBoot(newBoot)
          setCloudRestores((n) => n + 1)
        } else {
          pushCloudSave(import.meta.env.VITE_API_URL, local)
        }
      } finally {
        reconcileInFlightRef.current = false
      }
    }

    reconcile()
    const onVisibilityChange = () => {
      if (!document.hidden) reconcile()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [cfg])

  useEffect(() => {
    const checkPurchases = async () => {
      const grants = await claimPendingPurchases(import.meta.env.VITE_API_URL)
      if (grants.length > 0) {
        // Always credit the live session - `session` in this closure may be a stale
        // pre-restore one if a cloud restore raced this claim.
        applyGrants(activeSessionRef.current, grants)
        claimedGrantsRef.current = [...claimedGrantsRef.current, ...grants]
        setClaimedGrants((prev) => [...prev, ...grants])
        syncNow() // paid progress: persist immediately, don't wait for the autosave tick
      }
    }
    checkPurchases()

    // Re-check when the Mini App regains foreground - a purchase may have completed
    // in the bot chat while this tab was backgrounded.
    const onVisibilityChange = () => {
      if (!document.hidden) checkPurchases()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [session])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let saveAccum = 0
    let cloudAccum = 0

    const persist = () => {
      if (session !== activeSessionRef.current) return // stale loop after a cloud-restore swap
      writeSave(captureSave(session))
    }

    const loop = (now: number) => {
      const dt = Math.min(MAX_FRAME_DELTA, (now - last) / 1000)
      last = now

      session.tick(dt)
      versionRef.current++
      for (const fn of listenersRef.current) fn()

      saveAccum += dt
      if (saveAccum >= AUTOSAVE_SECONDS) {
        saveAccum = 0
        persist()
      }

      cloudAccum += dt
      if (cloudAccum >= CLOUD_PUSH_SECONDS) {
        cloudAccum = 0
        if (cloudReadyRef.current && session === activeSessionRef.current) {
          pushCloudSave(import.meta.env.VITE_API_URL, captureSave(session), false)
        }
      }

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const fullSync = () => {
      if (session !== activeSessionRef.current) return
      syncNow(true)
    }
    const onVisibilityChange = () => {
      if (document.hidden) fullSync()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', fullSync)

    // Prestige is the moment a save must not be lost - sync both stores right away.
    const offPrestiged = session.prestige.onPrestiged.on(() => {
      if (session === activeSessionRef.current) syncNow()
    })

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', fullSync)
      offPrestiged()
      persist()
    }
  }, [session])

  useSyncExternalStore(
    (onStoreChange) => {
      listenersRef.current.add(onStoreChange)
      return () => listenersRef.current.delete(onStoreChange)
    },
    () => versionRef.current,
  )

  return { session, offline, claimedGrants, cloudRestores }
}
