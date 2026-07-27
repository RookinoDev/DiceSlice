import { describe, expect, it } from 'vitest'
import { BigNumber } from '../game/core/BigNumber'
import { createGameSession } from '../game/createGameSession'
import { buildMainViewModel } from '../game/ui/MainPresenter'
import type { PendingPack } from '../game/cards/cardsApi'
import { needsRetroactiveSkip, selectActiveStep } from './useTutorial'
import { TUTORIAL_STEPS, type TutorialContext } from '../game/tutorial/TutorialSteps'

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
    const step = selectActiveStep(seen, makeCtx(session))
    expect(step?.id).toBe('gem-socket')
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
