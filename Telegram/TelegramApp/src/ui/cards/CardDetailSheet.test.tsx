// @vitest-environment jsdom
// Regression test for a real player report: a visited profile's showcased cards rendered
// LOCKED ("???" / UNDISCOVERED) whenever the viewer hadn't found that card themselves - even
// though the showcase only ever contains cards the profile owner actually owns (server-validated,
// see cardsApi.saveShowcase). Fix: GameShell now passes a showcasedOwnedSummary() override for
// cards inspected from a showcase, instead of looking the card up in the viewer's own collection
// (see collectionSummary.ts + the ShowcaseEditor/ProfileSheet/GameShell wiring change).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CardDetailSheet } from './CardDetailSheet'
import { FULL_CATALOG } from '../../game/cards/generatedCards'
import { showcasedOwnedSummary } from '../../game/cards/collectionSummary'

// jsdom lacks rAF, matchMedia, ResizeObserver, and AudioContext - stub the platform, not the app
// (same pattern as PackOpeningOverlay.test.tsx).
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal(
    'matchMedia',
    (q: string) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList,
  )
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('AudioContext', class { resume() {} createBuffer() { return { copyToChannel() {} } } createBufferSource() { return { connect() {}, start() {} } } createGain() { return { gain: {}, connect() {} } } get state() { return 'running' } get destination() { return {} } })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const card = FULL_CATALOG[0]

describe('CardDetailSheet: a showcased card is not gated by the viewer\'s own collection', () => {
  it('renders LOCKED when the viewer has no ownership record for the card (baseline)', () => {
    render(<CardDetailSheet card={card} owned={null} open={true} onClose={() => {}} onExplore={() => {}} />)
    expect(screen.getByText('???')).toBeTruthy()
    expect(screen.getByText('UNDISCOVERED')).toBeTruthy()
    expect(screen.queryByText(card.name)).toBeFalsy()
  })

  it('renders unlocked from a showcasedOwnedSummary() override, with no fabricated mint number', () => {
    render(<CardDetailSheet card={card} owned={showcasedOwnedSummary('standard')} open={true} onClose={() => {}} onExplore={() => {}} />)
    expect(screen.getByText(card.name)).toBeTruthy()
    expect(screen.queryByText('???')).toBeFalsy()
    expect(screen.queryByText('UNDISCOVERED')).toBeFalsy()
    // bestSerial is the "unknown" sentinel (0) - the MINT No. row must stay hidden rather than
    // show a fabricated serial that isn't the profile owner's real one.
    expect(screen.queryByText('MINT Nº')).toBeFalsy()
  })
})
