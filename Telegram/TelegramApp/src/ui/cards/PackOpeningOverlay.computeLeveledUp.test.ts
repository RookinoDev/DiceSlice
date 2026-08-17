// @vitest-environment jsdom
// jsdom is only needed because importing PackOpeningOverlay.tsx pulls in AudioManager, which
// reads localStorage at module-load time - the actual test logic below is pure, no DOM used.
// Pure-logic tests for computeLeveledUp (see PackOpeningOverlay.tsx) - kept separate from the
// full ceremony DOM test (PackOpeningOverlay.test.tsx) since this needs no jsdom/timers/audio
// stubbing, just deterministic input/output on the exact rule that answers "did this pull level
// the card up": user-requested feedback so a level-up is visible right at the pack-opening
// moment, not only discoverable later in the collection grid/card detail sheet.
import { describe, expect, it } from 'vitest'
import { computeLeveledUp } from './PackOpeningOverlay'
import type { MintedCard, OwnedCard } from '../../game/cards/cardsApi'

function owned(cardId: string, count: number): OwnedCard[] {
  return Array.from({ length: count }, (_, i) => ({ instanceId: i, cardId, variant: 'standard' as const, serial: i + 1, mintedAtMs: 0 }))
}
function minted(cardId: string, isNew: boolean, serial = 99): MintedCard {
  return { cardId, rarity: 'common', variant: 'standard', serial, isNew }
}

describe('computeLeveledUp', () => {
  it('a fresh (isNew) pull never counts as a level-up - that is the NEW badge\'s job', () => {
    const result = computeLeveledUp([minted('earth', true)], owned('earth', 0))
    expect(result.size).toBe(0)
  })

  it('the 2nd copy of an already-owned card (1 -> 2) crosses the first level threshold', () => {
    const card = minted('earth', false)
    const result = computeLeveledUp([card], owned('earth', 1))
    expect(result.has(`${card.cardId}-${card.serial}`)).toBe(true)
  })

  it('the 3rd copy (2 -> 3) does NOT cross a threshold - next one is at 4', () => {
    const card = minted('earth', false)
    const result = computeLeveledUp([card], owned('earth', 2))
    expect(result.size).toBe(0)
  })

  it('the 4th copy (3 -> 4) crosses the next threshold', () => {
    const card = minted('earth', false)
    const result = computeLeveledUp([card], owned('earth', 3))
    expect(result.has(`${card.cardId}-${card.serial}`)).toBe(true)
  })

  it('two copies of the same card in one pack are counted against EACH OTHER, in order', () => {
    // Owns 1 already. Pack pulls 2 more of the same card (serials 10 then 11): the pack's
    // OWN order must be respected - 1->2 (the first pulled copy) levels up, 2->3 (the second
    // pulled copy) does not, even though neither call knows about the other's serial directly.
    const first = minted('earth', false, 10)
    const second = minted('earth', false, 11)
    const result = computeLeveledUp([first, second], owned('earth', 1))
    expect(result.has('earth-10')).toBe(true)
    expect(result.has('earth-11')).toBe(false)
  })

  it('unrelated cards in the same pack do not affect each other\'s count', () => {
    const earth = minted('earth', false) // owns 1 -> 2: levels up
    const mars = minted('mars', false, 55) // owns 2 -> 3: does not (next threshold is 4)
    const result = computeLeveledUp([earth, mars], [...owned('earth', 1), ...owned('mars', 2)])
    expect(result.has(`earth-${earth.serial}`)).toBe(true)
    expect(result.has('mars-55')).toBe(false)
  })
})
