import { describe, expect, it } from 'vitest'
import { createGameSession } from '../createGameSession'
import { buildMainViewModel } from '../ui/MainPresenter'
import type { PendingPack } from '../cards/cardsApi'
import { TUTORIAL_STEPS, type TutorialContext } from './TutorialSteps'

function makeCtx(session: ReturnType<typeof createGameSession>, overrides: Partial<TutorialContext> = {}): TutorialContext {
  return { session, vm: buildMainViewModel(session), tab: 'combat', pendingPacks: [] as PendingPack[], ...overrides }
}

function step(id: string) {
  const s = TUTORIAL_STEPS.find((t) => t.id === id)
  if (!s) throw new Error(`no such step: ${id}`)
  return s
}

describe('TUTORIAL_STEPS autoAdvanceOn - real completion, not just a tab visit', () => {
  it('fleet: does not advance on merely opening the Fleet tab without owning a ship', () => {
    const session = createGameSession()
    expect(step('fleet').autoAdvanceOn?.(makeCtx(session, { tab: 'fleet' }))).toBe(false)
  })

  it('fleet: advances once the first ship is actually recruited', () => {
    const session = createGameSession()
    session.wallet.add(session.ships.nextCost(0))
    expect(session.buyShip(0)).toBe(true)
    expect(step('fleet').autoAdvanceOn?.(makeCtx(session, { tab: 'fleet' }))).toBe(true)
  })

  it('first-pack: does not advance on merely opening the Cards tab while a pack is still pending', () => {
    const session = createGameSession()
    const pending: PendingPack[] = [{ id: 1, type: 'meteor', createdAtMs: Date.now() }]
    expect(step('first-pack').autoAdvanceOn?.(makeCtx(session, { tab: 'cards', pendingPacks: pending }))).toBe(false)
  })

  it('first-pack: advances once no packs are left pending', () => {
    const session = createGameSession()
    expect(step('first-pack').autoAdvanceOn?.(makeCtx(session, { tab: 'cards', pendingPacks: [] }))).toBe(true)
  })

  it('talents: does not advance on merely opening the Talents tab without spending a point', () => {
    const session = createGameSession()
    session.talents.grantXp(1_000_000)
    expect(step('talents').autoAdvanceOn?.(makeCtx(session, { tab: 'talents' }))).toBe(false)
  })

  it('talents: advances once at least one Talent node has been bought', () => {
    const session = createGameSession()
    session.talents.grantXp(1_000_000)
    expect(session.talents.buyNode(0)).toBe(true)
    expect(step('talents').autoAdvanceOn?.(makeCtx(session, { tab: 'talents' }))).toBe(true)
  })
})
