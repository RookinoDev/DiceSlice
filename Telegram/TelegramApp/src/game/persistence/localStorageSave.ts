// Web equivalent of Assets/PixelPlanets/StellarBreaker/Scripts/Persistence/SaveService.cs,
// swapping the FileSaveStore/PlayerPrefs-style store for localStorage.
import type { SaveState } from './SaveState'

const KEY = 'stellarbreaker.save.v1'

/**
 * Load the save. Returns null (and leaves storage intact) on a missing, empty, or
 * malformed save rather than throwing - a corrupt entry must not crash startup.
 */
export function loadSave(): SaveState | null {
  try {
    const json = localStorage.getItem(KEY)
    if (!json) return null
    return JSON.parse(json) as SaveState
  } catch (e) {
    console.warn('[save] Ignoring corrupt save:', e)
    return null
  }
}

export function writeSave(state: SaveState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function deleteSave(): void {
  localStorage.removeItem(KEY)
}

export function nowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000)
}
