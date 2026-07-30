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
  /** If set, this step can only ever become active while `ctx.tab` equals this value - checked
   *  BEFORE `trigger`, centrally in useTutorial.ts's selectActiveStep, so it's structurally
   *  impossible for a step whose landmark (or subject matter) only makes sense on one screen to
   *  pop up spotlighting nothing while the player is looking at a different one. Omit for steps
   *  whose landmark is screen-independent (the always-mounted bottom nav / top bar) or that are
   *  meant to draw the player TOWARD a tab they haven't opened yet. */
  screen?: NavTab
  /** Set when `landmark` points at something that isn't itself a single tap target - a status
   *  pill (Stardust balance) or a container holding several real targets (the Artifact list, the
   *  Talent points-available strip: "tap one of the things below," not "tap this"). Suppresses
   *  TutorialOverlay's "tap here" ripple/cursor for this step so it never implies a click that
   *  wouldn't do anything - the cutout ring (a "look here" cue, not a "tap here" one) still shows. */
  noTapHint?: boolean
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  // -- Combat basics --
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
    screen: 'combat',
  },
  {
    id: 'first-stardust',
    landmark: 'gold-pill',
    title: 'Stardust',
    body: "Nice hit! That's Stardust - your main currency. Spend it to grow stronger.",
    trigger: (ctx) => ctx.session.wallet.balance.gt(BigNumber.Zero),
    noTapHint: true, // the balance pill is a status display, not a button
  },
  {
    id: 'tap-upgrade',
    landmark: 'tap-upgrade',
    title: 'Tap Damage',
    body: 'Upgrade your Tap Damage here to hit harder with every tap.',
    trigger: (ctx) => ctx.vm.showUpgradeTap,
    autoAdvanceOn: (ctx) => ctx.session.tapUpgrade.level > 1,
    screen: 'combat',
  },

  // -- Fleet: nav teaser, then the real in-screen action --
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
    screen: 'fleet',
  },

  // -- Boss / skills (combat-only, so they never pop up while the player's looking elsewhere) --
  {
    id: 'first-boss',
    landmark: null,
    title: 'Boss Incoming!',
    body: "Deal enough damage before the timer runs out, or you'll be sent back a sector.",
    trigger: (ctx) => ctx.vm.isBoss && ctx.vm.bossActive,
    screen: 'combat',
  },
  {
    id: 'first-skill',
    landmark: 'skill-0',
    title: 'New Ability!',
    body: 'Activate it for a temporary combat boost.',
    trigger: (ctx) => ctx.vm.skills[0]?.unlocked === true,
    autoAdvanceOn: (ctx) => ctx.vm.skills[0]?.active === true,
    screen: 'combat',
  },

  // -- Cards: nav teaser, then the real in-screen action --
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
    screen: 'cards',
  },

  // -- Missions (Top Bar, always mounted regardless of tab) --
  {
    id: 'missions-intro',
    landmark: 'topbar-missions',
    title: 'Missions',
    body: 'Missions track goals as you play and pay out Stardust when complete. Tap the bell to check and claim them.',
    trigger: (ctx) => ctx.session.stats.planetsDestroyed >= 3,
  },

  // -- Artifacts & Prestige: nav teaser, a Prestige preview, then real Artifact spending once
  //    relics actually exist (an actual prestige is a big, deliberate choice - never forced). --
  {
    id: 'artifacts-nav',
    landmark: 'nav-artifacts',
    title: 'Artifacts & Ascension',
    body: 'Ascend here for permanent Relics, then spend them on Artifacts that boost your whole fleet forever - both live in this tab.',
    trigger: (ctx) => ctx.vm.showArtifacts || ctx.vm.showPrestige,
    autoAdvanceOn: (ctx) => ctx.tab === 'artifacts',
  },
  {
    id: 'prestige-explain',
    landmark: 'prestige-subtab',
    title: 'Ready to Ascend',
    body: "You've reached the point where Prestige pays off. It resets your run for Relics that boost every future run - your Artifacts, Relics, and ships stay. Tap PRESTIGE to see what you'd gain, whenever you're ready.",
    trigger: (ctx) => ctx.tab === 'artifacts' && ctx.vm.canPrestige,
    screen: 'artifacts',
  },
  {
    id: 'artifact-spend',
    landmark: 'artifacts-list',
    title: 'Spend Your Relics',
    body: 'Artifacts are permanent, run-spanning upgrades - spend Relics here to boost your whole fleet forever.',
    trigger: (ctx) => ctx.tab === 'artifacts' && ctx.session.prestige.relics.balance.gt(BigNumber.Zero),
    autoAdvanceOn: (ctx) => Array.from({ length: ctx.session.artifacts.count }, (_, i) => ctx.session.artifacts.levelOf(i) > 0).some(Boolean),
    screen: 'artifacts',
    noTapHint: true, // the list is a container - the real target is whichever row inside it
  },

  // -- Shop --
  {
    id: 'extras',
    landmark: 'nav-shop',
    title: "Don't Miss Out",
    body: 'Open the Shop down here for your free Daily Reward, card packs, and other bonuses!',
    trigger: (ctx) => ctx.session.stats.bossesDefeated >= 1,
  },

  // -- Talents: nav teaser, then the real in-screen action, then Gem Sockets --
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
    screen: 'talents',
    noTapHint: true, // the summary strip is a status display - the real target is a node below it
  },
  {
    id: 'gem-socket',
    landmark: null,
    title: 'Gem Sockets',
    body: 'Some Talent nodes are Gem Sockets - tap one to unlock it, then tap again to slot in an owned card for a bonus based on its rarity!',
    trigger: (ctx) => anyGemSocketUnlocked(ctx.session),
    screen: 'talents',
  },

  // -- Achievements & Leaderboard (Top Bar, always mounted) - lightweight, discovery-only --
  {
    id: 'achievements-intro',
    landmark: 'topbar-achievements',
    title: 'Achievements',
    body: 'Milestones you unlock as you play - tap the medal to see your collection.',
    trigger: (ctx) => ctx.session.stats.bossesDefeated >= 2,
  },
  {
    id: 'leaderboard-intro',
    landmark: 'topbar-leaderboard',
    title: 'Leaderboard',
    body: "See how your fleet stacks up against other commanders' - tap here to check the ranks.",
    trigger: (ctx) => ctx.session.stats.bossesDefeated >= 3,
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
