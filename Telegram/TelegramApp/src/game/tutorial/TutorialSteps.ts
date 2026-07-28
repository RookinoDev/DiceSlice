// First-time-player tutorial catalog (data only, see src/ui/useTutorial.ts for the hook that
// selects the active step and src/ui/TutorialOverlay.tsx for the presentation). Each trigger
// reuses signals the game already computes - MainPresenter.ts's own progressive-disclosure
// flags (showFleet/showArtifacts/showPrestige) plus a handful of equally simple checks - so
// this file adds zero new game logic, only decides when to explain what's already there.
import { BigNumber } from '../core/BigNumber'
import type { GameSession } from '../gameplay/GameSession'
import type { MainViewModel } from '../ui/MainPresenter'
import type { NavTab } from '../../ui/BottomNav'
import type { PendingPack } from '../cards/cardsApi'
import { TalentEffect } from '../config/TalentDefinition'

export interface TutorialContext {
  session: GameSession
  vm: MainViewModel
  tab: NavTab
  pendingPacks: PendingPack[]
}

export interface TutorialStep {
  id: string
  /** registerLandmark key to spotlight, or null for a centered informational card. */
  landmark: string | null
  title: string
  body: string
  trigger: (ctx: TutorialContext) => boolean
  /** Dismiss automatically once the taught action happens - the real interaction, not a
   *  separate "got it" tap. Omit for purely informational steps with no single target action. */
  autoAdvanceOn?: (ctx: TutorialContext) => boolean
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome-tap',
    landmark: 'planet',
    title: 'Welcome, Commander!',
    body: 'Tap the planet to attack it and start earning Stardust.',
    trigger: (ctx) => ctx.session.stats.planetsDestroyed === 0 && ctx.session.tapUpgrade.level === 1,
    // HP drops the instant the first tap lands - far more responsive than waiting for a full kill.
    autoAdvanceOn: (ctx) => {
      const p = ctx.session.enemy.current
      return !!p && p.currentHp.lt(p.maxHp)
    },
  },
  {
    id: 'first-stardust',
    landmark: 'gold-pill',
    title: 'Stardust',
    body: "Nice hit! That's Stardust - your main currency. Spend it to grow stronger.",
    trigger: (ctx) => ctx.session.wallet.balance.gt(BigNumber.Zero),
  },
  {
    id: 'tap-upgrade',
    landmark: 'tap-upgrade',
    title: 'Tap Damage',
    body: 'Upgrade your Tap Damage here to hit harder with every tap.',
    trigger: (ctx) => ctx.vm.showUpgradeTap,
    autoAdvanceOn: (ctx) => ctx.session.tapUpgrade.level > 1,
  },
  // Fleet is taught in two steps, not one: 'fleet-nav' points at the bottom-nav icon until the
  // player opens the tab, then 'fleet-buy' points at the actual BUY button inside FleetScreen
  // until they actually recruit ship 0. A single step can't do both - its landmark would either
  // stay stuck on the (now pointless) nav icon after they've already navigated in, or vanish
  // outright once the player leaves the screen the button lives on. See GameSession's kill
  // reward floor for why the wallet is guaranteed to cover ships.nextCost(0) by the time
  // 'fleet-buy' can trigger.
  {
    id: 'fleet-nav',
    landmark: 'nav-fleet',
    title: 'Your Fleet',
    body: "Your Fleet fights for you automatically, even when you're not tapping. Open the Fleet tab to recruit your first ship!",
    trigger: (ctx) => ctx.vm.showFleet,
    autoAdvanceOn: (ctx) => ctx.tab === 'fleet',
  },
  {
    id: 'fleet-buy',
    landmark: 'fleet-buy-0',
    title: 'Recruit Your Fleet',
    body: "Tap BUY to recruit your first ship - it'll keep fighting for you, even while you're away.",
    trigger: (ctx) => ctx.vm.showFleet && ctx.tab === 'fleet',
    autoAdvanceOn: (ctx) => ctx.session.ships.isOwned(0),
  },
  {
    id: 'first-boss',
    landmark: null,
    title: 'Boss Incoming!',
    body: "Deal enough damage before the timer runs out, or you'll be sent back a sector.",
    trigger: (ctx) => ctx.vm.isBoss && ctx.vm.bossActive,
  },
  {
    id: 'first-skill',
    landmark: 'skill-0',
    title: 'New Ability!',
    body: 'Activate it for a temporary combat boost.',
    trigger: (ctx) => ctx.vm.skills[0]?.unlocked === true,
    autoAdvanceOn: (ctx) => ctx.vm.skills[0]?.active === true,
  },
  // Same nav+action split as Fleet above - 'first-pack-nav' points at the Cards tab icon,
  // 'first-pack-open' points at the actual OPEN PACKS button once they're on that screen.
  {
    id: 'first-pack-nav',
    landmark: 'nav-cards',
    title: 'Card Pack Earned!',
    body: 'Open the Cards tab to collect it.',
    trigger: (ctx) => ctx.pendingPacks.length > 0,
    autoAdvanceOn: (ctx) => ctx.tab === 'cards',
  },
  {
    id: 'first-pack-open',
    landmark: 'cards-open-packs',
    title: 'Open Your Pack',
    body: 'Tap OPEN PACKS to reveal your cards - real planets, moons, and stars!',
    trigger: (ctx) => ctx.pendingPacks.length > 0 && ctx.tab === 'cards',
    autoAdvanceOn: (ctx) => ctx.pendingPacks.length === 0,
  },
  {
    id: 'artifacts-prestige',
    landmark: 'nav-artifacts',
    title: 'Artifacts & Ascension',
    body: 'Ascend here for permanent Relics, then spend them on Artifacts that boost your whole fleet forever - both live in this tab.',
    trigger: (ctx) => ctx.vm.showArtifacts || ctx.vm.showPrestige,
    autoAdvanceOn: (ctx) => ctx.tab === 'artifacts',
  },
  {
    id: 'extras',
    landmark: 'nav-shop',
    title: "Don't Miss Out",
    body: 'Check Missions up top, and open the Shop down here for your free Daily Reward and other bonuses!',
    trigger: (ctx) => ctx.session.stats.bossesDefeated >= 1,
  },
  // Same nav+action split again - 'talents-nav' points at the Talents tab icon, 'talents-spend'
  // points at the points-available summary strip once they're on that screen (not any specific
  // node - which branch to spend on first is the player's own call, not the tutorial's).
  {
    id: 'talents-nav',
    landmark: 'nav-talents',
    title: 'Talent Tree',
    body: 'Leveling up grants Talent Points! Open the Talent Tree to spend them.',
    trigger: (ctx) => ctx.session.talents.level >= 2,
    autoAdvanceOn: (ctx) => ctx.tab === 'talents',
  },
  {
    id: 'talents-spend',
    landmark: 'talents-summary',
    title: 'Spend Your Points',
    body: 'Tap any glowing node below to spend a Talent Point on a permanent bonus.',
    trigger: (ctx) => ctx.session.talents.level >= 2 && ctx.tab === 'talents',
    autoAdvanceOn: (ctx) => anyTalentNodeBought(ctx.session),
  },
  {
    id: 'gem-socket',
    landmark: null,
    title: 'Gem Sockets',
    body: 'Some Talent nodes are Gem Sockets - tap one to unlock it, then tap again to slot in an owned card for a bonus based on its rarity!',
    trigger: (ctx) => anyGemSocketUnlocked(ctx.session),
  },
]

/** Whether the player has spent at least one Talent Point (any node above level 0) - the real
 *  completion of the 'talents-spend' step's instruction. */
function anyTalentNodeBought(session: GameSession): boolean {
  const t = session.talents
  for (let i = 0; i < t.count; i++) {
    if (t.levelOf(i) > 0) return true
  }
  return false
}

/** Whether the player has unlocked at least one Gem Socket node in any branch - the moment
 *  Gem Sockets first become relevant (see gameplay/GemSocketService.ts for what socketing a
 *  card actually does; this file only decides when to explain the concept exists). */
function anyGemSocketUnlocked(session: GameSession): boolean {
  const t = session.talents
  for (let i = 0; i < t.count; i++) {
    if (t.def(i).effect === TalentEffect.GemSocket && t.isUnlocked(i)) return true
  }
  return false
}
