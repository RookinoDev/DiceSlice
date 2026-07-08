// Cloud copy of the localStorage save, stored per Telegram user by TelegramBot/server.mjs
// (POST /api/load and /api/save, behind initData validation). localStorage remains the
// source of truth while playing; the cloud copy exists so a new device or a cleared
// WebView can restore progress. The client owns conflict resolution (pickBetterSave) -
// the server is a dumb per-user blob store.
import { BigNumber, type BigNumberData } from '../core/BigNumber'
import { getInitData } from '../../telegram'
import type { SaveState } from './SaveState'

export const CURRENT_SAVE_VERSION = 1
const FETCH_TIMEOUT_MS = 6000

export interface CloudLoadResult {
  /** True when the server answered (even with no save). False = offline/misconfigured: don't push over an unseen cloud save. */
  ok: boolean
  save: SaveState | null
}

export async function fetchCloudSave(apiBaseUrl: string | undefined): Promise<CloudLoadResult> {
  const initData = getInitData()
  if (!initData || !apiBaseUrl) return { ok: false, save: null }

  try {
    const res = await fetch(`${apiBaseUrl}/api/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return { ok: false, save: null }
    const data = await res.json()
    return { ok: true, save: sanitizeSave(data.save) }
  } catch (e) {
    console.warn('[cloud-save] load failed:', e)
    return { ok: false, save: null }
  }
}

/** `keepalive` lets the request survive a page hide/close (final sync on exit). */
export async function pushCloudSave(apiBaseUrl: string | undefined, save: SaveState, keepalive = false): Promise<boolean> {
  const initData = getInitData()
  if (!initData || !apiBaseUrl) return false

  try {
    const res = await fetch(`${apiBaseUrl}/api/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, save }),
      keepalive,
    })
    return res.ok
  } catch (e) {
    console.warn('[cloud-save] push failed:', e)
    return false
  }
}

/**
 * Which of two saves represents more progress? Relics first (they persist across
 * prestige, so they are the best lifetime proxy), then deepest stage of the current
 * run, then the newer timestamp. All ties keep `local`, so a same-device boot never
 * swaps the running session for an identical cloud copy.
 */
export function pickBetterSave(local: SaveState | null, cloud: SaveState | null): SaveState | null {
  if (!local) return cloud
  if (!cloud) return local

  const localRelics = toBig(local.relics)
  const cloudRelics = toBig(cloud.relics)
  if (cloudRelics.gt(localRelics)) return cloud
  if (localRelics.gt(cloudRelics)) return local

  if (cloud.highestStage !== local.highestStage) return cloud.highestStage > local.highestStage ? cloud : local
  return cloud.lastSaveUnixSeconds > local.lastSaveUnixSeconds ? cloud : local
}

/** Rejects anything that isn't a plausible current-version SaveState - the cloud copy is foreign input. */
export function sanitizeSave(raw: unknown): SaveState | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Partial<SaveState>
  if (s.version !== CURRENT_SAVE_VERSION) return null
  if (!isBigNumberData(s.stardust) || !isBigNumberData(s.relics)) return null
  if (!isFiniteNumber(s.tapLevel) || !isFiniteNumber(s.currentStage) || !isFiniteNumber(s.highestStage)) return null
  if (!isFiniteNumber(s.lastSaveUnixSeconds)) return null
  if (!Array.isArray(s.shipLevels) || !Array.isArray(s.artifactLevels)) return null
  return raw as SaveState
}

function toBig(d: BigNumberData): BigNumber {
  return new BigNumber(d.mantissa, d.exponent)
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isBigNumberData(v: unknown): v is BigNumberData {
  return !!v && typeof v === 'object' && isFiniteNumber((v as BigNumberData).mantissa) && isFiniteNumber((v as BigNumberData).exponent)
}
