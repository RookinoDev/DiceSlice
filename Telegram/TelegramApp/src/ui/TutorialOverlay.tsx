// Spotlight overlay for the first-time-player tutorial (see useTutorial.ts + TutorialSteps.ts).
// The scrim never captures clicks - real gameplay stays fully tappable underneath, including
// the spotlighted element itself, so a step with autoAdvanceOn dismisses via the taught action
// rather than a separate confirm tap. Position is read straight from getLandmarkRect() during
// render rather than tracked in its own effect/observer - GameShell already re-renders
// continuously off the game tick, so the cutout stays in sync for free.
//
// Rendered via a portal straight into document.body rather than in GameShell's own tree: the
// screen-shake hook (useScreenShake) applies a `transform` to .game-shell during boss/prestige
// moments, which would turn it into a new containing block for any `position: fixed` descendant
// and throw off every getBoundingClientRect()/window.innerHeight coordinate this component uses.
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { getLandmarkRect } from './combatFx/landmarks'
import type { TutorialStep } from '../game/tutorial/TutorialSteps'

interface TutorialOverlayProps {
  step: TutorialStep | undefined
  isFirstStep: boolean
  onDismiss: (id: string) => void
  onSkip: () => void
}

const CUTOUT_PAD = 8

export function TutorialOverlay({ step, isFirstStep, onDismiss, onSkip }: TutorialOverlayProps) {
  if (!step) return null

  const rect = step.landmark ? getLandmarkRect(step.landmark) : null
  // Target hasn't mounted yet this frame (e.g. a tab just switched) - skip rendering rather
  // than flash a cutout at (0,0). It reappears the moment the real element registers itself.
  if (step.landmark && !rect) return null

  const manualDismiss = !step.autoAdvanceOn

  return createPortal(
    <div className="tutorial-scrim">
      {rect ? (
        <>
          <div
            className="tutorial-cutout"
            style={{
              left: rect.left - CUTOUT_PAD,
              top: rect.top - CUTOUT_PAD,
              width: rect.width + CUTOUT_PAD * 2,
              height: rect.height + CUTOUT_PAD * 2,
            }}
          />
          <div className="tutorial-callout" style={calloutPosition(rect)}>
            <div className="tutorial-callout-title">{step.title}</div>
            <div className="tutorial-callout-body">{step.body}</div>
            {manualDismiss && (
              <button className="tutorial-callout-got-it" onClick={() => onDismiss(step.id)}>
                GOT IT
              </button>
            )}
            {isFirstStep && (
              <button className="tutorial-skip-link" onClick={onSkip}>
                Skip tutorial
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="tutorial-card">
          <div className="tutorial-callout-title">{step.title}</div>
          <div className="tutorial-callout-body">{step.body}</div>
          {manualDismiss && (
            <button className="tutorial-callout-got-it" onClick={() => onDismiss(step.id)}>
              GOT IT
            </button>
          )}
          {isFirstStep && (
            <button className="tutorial-skip-link" onClick={onSkip}>
              Skip tutorial
            </button>
          )}
        </div>
      )}
    </div>,
    document.body,
  )
}

/** Flips above/below the cutout depending on available space, anchored so the callout can grow
 *  without knowing its own height up front (top-anchored when below, bottom-anchored when
 *  above). Full-width minus margins - this is always a narrow phone viewport, so there's no
 *  need to also center-align on the cutout's X position. */
function calloutPosition(rect: DOMRect): CSSProperties {
  const showAbove = rect.top > window.innerHeight / 2
  return {
    left: 16,
    right: 16,
    top: showAbove ? 'auto' : rect.bottom + CUTOUT_PAD + 10,
    bottom: showAbove ? window.innerHeight - rect.top + CUTOUT_PAD + 10 : 'auto',
  }
}
