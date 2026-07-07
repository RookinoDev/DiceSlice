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
import { applyGrants, claimPendingPurchases, type PurchaseGrant } from './monetization/purchases'

const AUTOSAVE_SECONDS = 15
/** Clamp a single frame's delta so a throttled/backgrounded tab can't apply one giant tick. */
const MAX_FRAME_DELTA = 0.25

export interface OfflineReport {
  seconds: number
  gold: BigNumber
}

function loadAndBegin(cfg: BalanceConfig): { session: GameSession; offline: OfflineReport | null } {
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
      const gold = offlineEarningsFromConfig(last, now, income, cfg)
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
 */
export function useGameSession(cfg: BalanceConfig = defaultBalanceConfig) {
  const bootRef = useRef<{ session: GameSession; offline: OfflineReport | null } | null>(null)
  if (!bootRef.current) bootRef.current = loadAndBegin(cfg)
  const { session, offline } = bootRef.current

  const listenersRef = useRef(new Set<() => void>())
  const versionRef = useRef(0)
  const [claimedGrants, setClaimedGrants] = useState<PurchaseGrant[]>([])

  useEffect(() => {
    const checkPurchases = async () => {
      const grants = await claimPendingPurchases(import.meta.env.VITE_API_URL)
      if (grants.length > 0) {
        applyGrants(session, grants)
        setClaimedGrants((prev) => [...prev, ...grants])
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

    const persist = () => writeSave(captureSave(session))

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

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onVisibilityChange = () => {
      if (document.hidden) persist()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', persist)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', persist)
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

  return { session, offline, claimedGrants }
}
