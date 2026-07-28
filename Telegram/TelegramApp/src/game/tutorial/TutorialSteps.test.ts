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

describe('Fleet, Cards, and Talents are each taught in a nav step + an in-screen action step', () => {
  it('fleet-nav: advances the instant the Fleet tab is opened (it only points at the nav icon)', () => {
    const session = createGameSession()
    expect(step('fleet-nav').autoAdvanceOn?.(makeCtx(session, { tab: 'fleet' }))).toBe(true)
  })

  it('fleet-buy: only triggers once actually on the Fleet tab, and does not advance without owning a ship', () => {
    const session = createGameSession()
    expect(step('fleet-buy').trigger(makeCtx(session, { tab: 'combat', vm: { ...buildMainViewModel(session), showFleet: true } }))).toBe(false)
    expect(step('fleet-buy').trigger(makeCtx(session, { tab: 'fleet', vm: { ...buildMainViewModel(session), showFleet: true } }))).toBe(true)
    expect(step('fleet-buy').autoAdvanceOn?.(makeCtx(session, { tab: 'fleet' }))).toBe(false)
  })

  it('fleet-buy: advances once the first ship is actually recruited', () => {
    const session = createGameSession()
    session.wallet.add(session.ships.nextCost(0))
    expect(session.buyShip(0)).toBe(true)
    expect(step('fleet-buy').autoAdvanceOn?.(makeCtx(session, { tab: 'fleet' }))).toBe(true)
  })

  it('first-pack-nav: advances the instant the Cards tab is opened', () => {
    const session = createGameSession()
    expect(step('first-pack-nav').autoAdvanceOn?.(makeCtx(session, { tab: 'cards' }))).toBe(true)
  })

  it('first-pack-open: only triggers once on the Cards tab with a pack pending, does not advance while one is still pending', () => {
    const session = createGameSession()
    const pending: PendingPack[] = [{ id: 1, type: 'meteor', createdAtMs: Date.now() }]
    expect(step('first-pack-open').trigger(makeCtx(session, { tab: 'combat', pendingPacks: pending }))).toBe(false)
    expect(step('first-pack-open').trigger(makeCtx(session, { tab: 'cards', pendingPacks: pending }))).toBe(true)
    expect(step('first-pack-open').autoAdvanceOn?.(makeCtx(session, { tab: 'cards', pendingPacks: pending }))).toBe(false)
  })

  it('first-pack-open: advances once no packs are left pending', () => {
    const session = createGameSession()
    expect(step('first-pack-open').autoAdvanceOn?.(makeCtx(session, { tab: 'cards', pendingPacks: [] }))).toBe(true)
  })

  it('talents-nav: advances the instant the Talents tab is opened', () => {
    const session = createGameSession()
    expect(step('talents-nav').autoAdvanceOn?.(makeCtx(session, { tab: 'talents' }))).toBe(true)
  })

  it('talents-spend: only triggers once on the Talents tab, does not advance without spending a point', () => {
    const session = createGameSession()
    session.talents.grantXp(1_000_000)
    expect(step('talents-spend').trigger(makeCtx(session, { tab: 'combat' }))).toBe(false)
    expect(step('talents-spend').trigger(makeCtx(session, { tab: 'talents' }))).toBe(true)
    expect(step('talents-spend').autoAdvanceOn?.(makeCtx(session, { tab: 'talents' }))).toBe(false)
  })

  it('talents-spend: advances once at least one Talent node has been bought', () => {
    const session = createGameSession()
    session.talents.grantXp(1_000_000)
    expect(session.talents.buyNode(0)).toBe(true)
    expect(step('talents-spend').autoAdvanceOn?.(makeCtx(session, { tab: 'talents' }))).toBe(true)
  })
})
