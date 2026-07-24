// Drives TutorialOverlay.tsx: picks the active step (lowest-index step in TUTORIAL_STEPS whose
// trigger is true and hasn't been seen yet), and lets the overlay dismiss it either manually
// ("GOT IT") or via the taught action itself (autoAdvanceOn - see TutorialSteps.ts).
import { useEffect, useState } from 'react'
import type { GameSession } from '../game/gameplay/GameSession'
import type { MainViewModel } from '../game/ui/MainPresenter'
import type { PendingPack } from '../game/cards/cardsApi'
import { TUTORIAL_STEPS, type TutorialContext, type TutorialStep } from '../game/tutorial/TutorialSteps'
import type { NavTab } from './BottomNav'

/** The lowest-index step whose trigger is true and hasn't been dismissed yet - pure, no React,
 *  so it's directly testable without mounting the hook. */
export function selectActiveStep(seen: ReadonlySet<string>, ctx: TutorialContext): TutorialStep | undefined {
  return TUTORIAL_STEPS.find((step) => !seen.has(step.id) && step.trigger(ctx))
}

/** True for a save with existing progress but an empty tutorialSeen - it predates this feature
 *  (a genuinely new player who reached real progress would have already dismissed at least the
 *  welcome step along the way - see TutorialSteps.ts's welcome-tap trigger). */
export function needsRetroactiveSkip(session: GameSession): boolean {
  return session.tutorialSeen.size === 0 && (session.tapUpgrade.level > 1 || session.stage.highestStage > 1)
}

export function useTutorial(session: GameSession, vm: MainViewModel, tab: NavTab, pendingPacks: PendingPack[]) {
  // session.tutorialSeen is a plain mutated Set (matches how the rest of the save-bound session
  // state works), not React state - this counter forces a re-render whenever it changes so
  // dismiss()/skip() take effect immediately regardless of the ambient tick-driven re-render rate.
  const [version, setVersion] = useState(0)

  // Mark everything seen once instead of replaying the whole sequence on top of veteran progress.
  useEffect(() => {
    if (needsRetroactiveSkip(session)) {
      for (const step of TUTORIAL_STEPS) session.tutorialSeen.add(step.id)
      setVersion((v) => v + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const ctx: TutorialContext = { session, vm, tab, pendingPacks }
  const active = selectActiveStep(session.tutorialSeen, ctx)

  const dismiss = (id: string) => {
    session.tutorialSeen.add(id)
    setVersion((v) => v + 1)
  }

  const skip = () => {
    for (const step of TUTORIAL_STEPS) session.tutorialSeen.add(step.id)
    setVersion((v) => v + 1)
  }

  /** Settings > "Replay Tutorial" - the opposite of skip(), clears every seen id so the whole
   *  sequence walks again from whichever step's trigger is true right now. */
  const replay = () => {
    session.tutorialSeen.clear()
    setVersion((v) => v + 1)
  }

  // Auto-advance once the taught action happens - re-checked every render (cheap pure checks),
  // naturally stops once the step is dismissed and `active` moves to the next step or none.
  useEffect(() => {
    if (active?.autoAdvanceOn?.(ctx)) dismiss(active.id)
  })

  return {
    step: active,
    isFirstStep: active !== undefined && TUTORIAL_STEPS[0]?.id === active.id,
    dismiss,
    skip,
    replay,
    // Exposed for tests - not read by TutorialOverlay itself.
    version,
  }
}
