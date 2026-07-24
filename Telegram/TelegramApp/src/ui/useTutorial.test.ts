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
