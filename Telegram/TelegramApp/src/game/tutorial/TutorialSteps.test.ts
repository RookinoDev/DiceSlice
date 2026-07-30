import { describe, expect, it } from 'vitest'
import { BigNumber } from '../core/BigNumber'
import { createGameSession } from '../createGameSession'
import { buildMainViewModel } from '../ui/MainPresenter'
import type { PendingPack } from '../cards/cardsApi'
import { selectActiveStep } from '../../ui/useTutorial'
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

describe('every step whose content only makes sense on one screen sets `screen`, so it can never spotlight nothing on the wrong tab', () => {
  it.each(['welcome-tap', 'tap-upgrade', 'first-boss', 'first-skill'])('%s is gated to the combat screen', (id) => {
    expect(step(id).screen).toBe('combat')
  })
  it('fleet-buy is gated to the fleet screen', () => {
    expect(step('fleet-buy').screen).toBe('fleet')
  })
  it('first-pack-open is gated to the cards screen', () => {
    expect(step('first-pack-open').screen).toBe('cards')
  })
  it.each(['talents-spend', 'gem-socket'])('%s is gated to the talents screen', (id) => {
    expect(step(id).screen).toBe('talents')
  })
  it.each(['prestige-explain', 'artifact-spend'])('%s is gated to the artifacts screen', (id) => {
    expect(step(id).screen).toBe('artifacts')
  })
  it.each(['fleet-nav', 'first-pack-nav', 'talents-nav', 'artifacts-nav', 'extras', 'first-stardust', 'missions-intro', 'achievements-intro', 'leaderboard-intro'])(
    '%s has no screen gate (its landmark - a nav icon or Top Bar button - is always mounted)',
    (id) => {
      expect(step(id).screen).toBeUndefined()
    },
  )

  it('a screen-gated step never activates while the player is on a different tab, even with its trigger true', () => {
    const session = createGameSession()
    session.wallet.add(new BigNumber(50)) // tap-upgrade's trigger (showUpgradeTap) is now true
    const seen = new Set(TUTORIAL_STEPS.map((s) => s.id).filter((id) => id !== 'tap-upgrade'))
    const onCombat = selectActiveStep(seen, makeCtx(session, { tab: 'combat' }))
    const onCards = selectActiveStep(seen, makeCtx(session, { tab: 'cards' }))
    expect(onCombat?.id).toBe('tap-upgrade')
    expect(onCards?.id).not.toBe('tap-upgrade')
  })
})

describe('noTapHint is set on every step whose landmark is not itself a single tap target', () => {
  it.each(['first-stardust', 'artifact-spend', 'talents-spend'])('%s sets noTapHint (a status pill or a container, not a button)', (id) => {
    expect(step(id).noTapHint).toBe(true)
  })
  it.each(['welcome-tap', 'tap-upgrade', 'fleet-nav', 'fleet-buy', 'first-pack-nav', 'first-pack-open', 'talents-nav', 'artifacts-nav', 'prestige-explain'])(
    '%s leaves noTapHint unset (its landmark is a real, single tap target)',
    (id) => {
      expect(step(id).noTapHint).toBeUndefined()
    },
  )
})

describe('Missions, Achievements, and Leaderboard get a lightweight Top Bar introduction', () => {
  it('missions-intro triggers once the player has destroyed a few planets', () => {
    const session = createGameSession()
    expect(step('missions-intro').trigger(makeCtx(session))).toBe(false)
    session.stats.planetsDestroyed = 3
    expect(step('missions-intro').trigger(makeCtx(session))).toBe(true)
  })

  it('achievements-intro and leaderboard-intro trigger at their own boss-defeated milestones', () => {
    const session = createGameSession()
    expect(step('achievements-intro').trigger(makeCtx(session))).toBe(false)
    expect(step('leaderboard-intro').trigger(makeCtx(session))).toBe(false)
    session.stats.bossesDefeated = 2
    expect(step('achievements-intro').trigger(makeCtx(session))).toBe(true)
    expect(step('leaderboard-intro').trigger(makeCtx(session))).toBe(false)
    session.stats.bossesDefeated = 3
    expect(step('leaderboard-intro').trigger(makeCtx(session))).toBe(true)
  })
})

describe('Artifacts & Prestige: a teaser, a real Prestige preview, then real Artifact spending once Relics exist', () => {
  it('prestige-explain only triggers once actually able to prestige, and only on the artifacts tab', () => {
    const session = createGameSession()
    expect(step('prestige-explain').trigger(makeCtx(session, { tab: 'artifacts' }))).toBe(false)
    const readyVm = { ...buildMainViewModel(session), canPrestige: true }
    expect(step('prestige-explain').trigger(makeCtx(session, { tab: 'combat', vm: readyVm }))).toBe(false)
    expect(step('prestige-explain').trigger(makeCtx(session, { tab: 'artifacts', vm: readyVm }))).toBe(true)
  })

  it('artifact-spend only triggers once Relics are actually owned, and does not advance before spending any', () => {
    const session = createGameSession()
    expect(step('artifact-spend').trigger(makeCtx(session, { tab: 'artifacts' }))).toBe(false)
    session.prestige.relics.add(new BigNumber(1000))
    expect(step('artifact-spend').trigger(makeCtx(session, { tab: 'artifacts' }))).toBe(true)
    expect(step('artifact-spend').autoAdvanceOn?.(makeCtx(session, { tab: 'artifacts' }))).toBe(false)
  })

  it('artifact-spend advances once an artifact is actually bought', () => {
    const session = createGameSession()
    session.prestige.relics.add(new BigNumber(1_000_000))
    expect(session.buyArtifact(0)).toBe(true)
    expect(step('artifact-spend').autoAdvanceOn?.(makeCtx(session, { tab: 'artifacts' }))).toBe(true)
  })
})
