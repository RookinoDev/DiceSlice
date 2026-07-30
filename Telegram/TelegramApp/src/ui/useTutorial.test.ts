// @vitest-environment jsdom
// The gap-timing describe block below mounts the real hook via renderHook, which needs a DOM -
// everything else in this file is plain function calls and doesn't care about the environment.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { BigNumber } from '../game/core/BigNumber'
import { createGameSession } from '../game/createGameSession'
import { buildMainViewModel } from '../game/ui/MainPresenter'
import type { PendingPack } from '../game/cards/cardsApi'
import { needsRetroactiveSkip, selectActiveStep, useTutorial } from './useTutorial'
import { TUTORIAL_STEPS, type TutorialContext } from '../game/tutorial/TutorialSteps'
import type { NavTab } from './BottomNav'

function makeCtx(session: ReturnType<typeof createGameSession>, overrides: Partial<TutorialContext> = {}): TutorialContext {
  return { session, vm: buildMainViewModel(session), tab: 'combat', pendingPacks: [] as PendingPack[], ...overrides }
}

describe('selectActiveStep', () => {
  it('picks the welcome step for a brand-new session', () => {
    const session = createGameSession()
    const step = selectActiveStep(session.tutorialSeen, makeCtx(session))
    expect(step?.id).toBe('welcome-tap')
  })

  it('skips seen steps and picks the next eligible one', () => {
    const session = createGameSession()
    session.wallet.add(new BigNumber(100)) // first-stardust's trigger is now true
    const seen = new Set(['welcome-tap'])
    const step = selectActiveStep(seen, makeCtx(session))
    expect(step?.id).toBe('first-stardust')
  })

  it('returns undefined once every eligible step has been seen', () => {
    const session = createGameSession()
    const allSeen = new Set(TUTORIAL_STEPS.map((s) => s.id))
    const step = selectActiveStep(allSeen, makeCtx(session))
    expect(step).toBeUndefined()
  })

  it('never returns a step whose trigger is false, even if unseen', () => {
    const session = createGameSession() // wallet is empty, so first-stardust's trigger is false
    const seen = new Set(['welcome-tap'])
    const step = selectActiveStep(seen, makeCtx(session))
    expect(step).toBeUndefined()
  })

  it('picks the gem-socket step once any branch has unlocked a Gem Socket node (5 branch points)', () => {
    const session = createGameSession()
    session.talents.grantXp(1_000_000) // plenty of points
    const branch = session.talents.def(0).branch
    const branchIndices = Array.from({ length: session.talents.count }, (_, i) => i).filter((i) => session.talents.def(i).branch === branch)
    // Multiple passes: buying tier-1 nodes raises the branch's point total, which unlocks the
    // gem/tier-2 nodes bought in a later pass, and so on up the chain.
    for (let pass = 0; pass < 4; pass++) {
      for (const i of branchIndices) while (session.talents.buyNode(i)) {}
    }
    const seen = new Set(TUTORIAL_STEPS.map((s) => s.id).filter((id) => id !== 'gem-socket'))
    // gem-socket is screen-gated to 'talents' (it only makes sense while looking at the tree).
    const step = selectActiveStep(seen, makeCtx(session, { tab: 'talents' }))
    expect(step?.id).toBe('gem-socket')
  })

  it('does not pick a screen-gated step while the player is on a different tab', () => {
    const session = createGameSession()
    session.talents.grantXp(1_000_000)
    const branch = session.talents.def(0).branch
    const branchIndices = Array.from({ length: session.talents.count }, (_, i) => i).filter((i) => session.talents.def(i).branch === branch)
    for (let pass = 0; pass < 4; pass++) {
      for (const i of branchIndices) while (session.talents.buyNode(i)) {}
    }
    const seen = new Set(TUTORIAL_STEPS.map((s) => s.id).filter((id) => id !== 'gem-socket'))
    // Same eligible state as above, but the player is on Combat, not Talents - gem-socket's
    // trigger is true, but its `screen: 'talents'` gate must still block it from activating.
    const step = selectActiveStep(seen, makeCtx(session, { tab: 'combat' }))
    expect(step?.id).not.toBe('gem-socket')
  })
})

describe('needsRetroactiveSkip', () => {
  it('is false for a genuinely fresh session', () => {
    const session = createGameSession()
    expect(needsRetroactiveSkip(session)).toBe(false)
  })

  it('is true for existing progress with no tutorialSeen recorded yet (pre-feature save)', () => {
    const session = createGameSession()
    session.tapUpgrade.reset(5)
    expect(needsRetroactiveSkip(session)).toBe(true)
  })

  it('is also true when only highestStage shows progress', () => {
    const session = createGameSession()
    session.stage.restoreProgress(3, 3)
    expect(needsRetroactiveSkip(session)).toBe(true)
  })

  it('is false once tutorialSeen has any entry, even with real progress', () => {
    const session = createGameSession()
    session.tapUpgrade.reset(5)
    session.tutorialSeen.add('welcome-tap')
    expect(needsRetroactiveSkip(session)).toBe(false)
  })
})

describe('useTutorial: dismiss gap length depends on whether the player actually navigated', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function markAllSeenExcept(session: ReturnType<typeof createGameSession>, ...keepUnseen: string[]) {
    for (const s of TUTORIAL_STEPS) if (!keepUnseen.includes(s.id)) session.tutorialSeen.add(s.id)
  }

  it('a nav-teaser step (dismissed by the player switching tabs) waits the longer, different-screen gap before the next step', () => {
    const session = createGameSession()
    markAllSeenExcept(session, 'fleet-nav', 'fleet-buy')
    const vm = { ...buildMainViewModel(session), showFleet: true }
    const { result, rerender } = renderHook<ReturnType<typeof useTutorial>, { t: NavTab }>(({ t }) => useTutorial(session, vm, t, [] as PendingPack[]), {
      initialProps: { t: 'combat' },
    })
    expect(result.current.step?.id).toBe('fleet-nav')

    // The player taps the Fleet nav icon - fleet-nav's autoAdvanceOn (tab === 'fleet') fires and
    // dismisses it in the same render's effect.
    rerender({ t: 'fleet' })
    expect(result.current.step).toBeUndefined() // dismissed, and fleet-buy is still gap-gated

    act(() => vi.advanceTimersByTime(2500))
    rerender({ t: 'fleet' })
    expect(result.current.step).toBeUndefined() // still under the 3000ms different-screen gap

    act(() => vi.advanceTimersByTime(700))
    rerender({ t: 'fleet' })
    expect(result.current.step?.id).toBe('fleet-buy')
  })

  it('a step dismissed without changing tabs only waits the shorter, same-screen gap', () => {
    const session = createGameSession()
    session.stats.planetsDestroyed = 3 // missions-intro's trigger
    session.stats.bossesDefeated = 1 // extras' trigger - both true from the very first render
    markAllSeenExcept(session, 'missions-intro', 'extras')
    const vm = buildMainViewModel(session)
    const { result, rerender } = renderHook(() => useTutorial(session, vm, 'combat', [] as PendingPack[]))
    expect(result.current.step?.id).toBe('missions-intro') // lower index than extras

    act(() => result.current.dismiss('missions-intro')) // manual "GOT IT" - no tab change
    rerender()
    expect(result.current.step).toBeUndefined() // extras is eligible but still gap-gated

    act(() => vi.advanceTimersByTime(1400))
    rerender()
    expect(result.current.step).toBeUndefined() // still under the 1500ms same-screen gap

    act(() => vi.advanceTimersByTime(300))
    rerender()
    expect(result.current.step?.id).toBe('extras')
  })
})
