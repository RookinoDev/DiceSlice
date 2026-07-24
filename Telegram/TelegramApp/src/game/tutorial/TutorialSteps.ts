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
  {
    id: 'fleet',
    landmark: 'nav-fleet',
    title: 'Your Fleet',
    body: "Your Fleet fights for you automatically, even when you're not tapping. Recruit your first ship!",
    trigger: (ctx) => ctx.vm.showFleet,
    autoAdvanceOn: (ctx) => ctx.tab === 'fleet',
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
  {
    id: 'first-pack',
    landmark: 'nav-cards',
    title: 'Card Pack Earned!',
    body: 'Open it in the Cards tab to collect real planets, moons, and stars.',
    trigger: (ctx) => ctx.pendingPacks.length > 0,
    autoAdvanceOn: (ctx) => ctx.tab === 'cards',
  },
  {
    id: 'prestige',
    landmark: 'nav-prestige',
    title: 'Almost There!',
    body: 'Ascending resets your run for permanent Relics - a fresh start that makes you stronger long-term.',
    trigger: (ctx) => ctx.vm.showPrestige,
    autoAdvanceOn: (ctx) => ctx.tab === 'prestige',
  },
  {
    id: 'artifacts',
    landmark: 'nav-artifacts',
    title: 'Artifacts',
    body: 'Spend Relics here on permanent Artifacts that boost your whole fleet forever.',
    trigger: (ctx) => ctx.vm.showArtifacts,
    autoAdvanceOn: (ctx) => ctx.tab === 'artifacts',
  },
  {
    id: 'extras',
    landmark: 'topbar-daily',
    title: "Don't Miss Out",
    body: 'Check Daily Reward, Missions, and the Shop up top for free bonuses along the way!',
    trigger: (ctx) => ctx.session.stats.bossesDefeated >= 1,
  },
]
