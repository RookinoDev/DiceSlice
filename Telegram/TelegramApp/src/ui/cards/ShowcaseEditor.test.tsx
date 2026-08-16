// @vitest-environment jsdom
// Regression test for a real player report: a showcase edit "stuck" in the UI but was gone
// the next day. Root cause was saveShowcase being fire-and-forget - a failed server save left
// the optimistic local update in place with zero feedback. commit() must now roll back and
// tell the player when the server save fails.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ShowcaseEditor, ShowcaseView } from './ShowcaseEditor'
import { FULL_CATALOG } from '../../game/cards/generatedCards'
import type { OwnedCard } from '../../game/cards/cardsApi'
import type { ShowcaseEntry } from '../../game/profileApi'

const saveShowcaseMock = vi.fn()
vi.mock('../../game/cards/cardsApi', () => ({ saveShowcase: (...args: unknown[]) => saveShowcaseMock(...args) }))

// jsdom lacks AudioContext - stub the platform (same as PackOpeningOverlay.test.tsx), not the app.
beforeEach(() => {
  vi.stubGlobal('AudioContext', class { resume() {} createBuffer() { return { copyToChannel() {} } } createBufferSource() { return { connect() {}, start() {} } } createGain() { return { gain: {}, connect() {} } } get state() { return 'running' } get destination() { return {} } })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const card = FULL_CATALOG[0]
const ownedCards: OwnedCard[] = [{ instanceId: 1, cardId: card.id, variant: 'standard', serial: 1, mintedAtMs: 0 }]

function addCardToFirstSlot() {
  fireEvent.click(screen.getAllByRole('button')[0]) // empty slot 0 -> opens picker
  fireEvent.click(screen.getByText(card.name))
}

describe('ShowcaseEditor: server save failures roll back instead of silently sticking', () => {
  it('keeps the optimistic update when the server save succeeds', async () => {
    saveShowcaseMock.mockResolvedValue(true)
    const onChange = vi.fn()
    const onToast = vi.fn()
    render(<ShowcaseEditor apiBaseUrl={undefined} ownedCards={ownedCards} showcase={[]} onChange={onChange} onInspect={() => {}} onToast={onToast} />)

    addCardToFirstSlot()
    expect(onChange).toHaveBeenCalledWith([{ cardId: card.id, variant: 'standard' }])
    await vi.waitFor(() => expect(saveShowcaseMock).toHaveBeenCalled())
    expect(onChange).toHaveBeenCalledTimes(1) // no rollback call
    expect(onToast).not.toHaveBeenCalled()
  })

  it('rolls back and toasts when the server save fails', async () => {
    saveShowcaseMock.mockResolvedValue(false)
    const onChange = vi.fn()
    const onToast = vi.fn()
    render(<ShowcaseEditor apiBaseUrl={undefined} ownedCards={ownedCards} showcase={[]} onChange={onChange} onInspect={() => {}} onToast={onToast} />)

    addCardToFirstSlot()
    expect(onChange).toHaveBeenNthCalledWith(1, [{ cardId: card.id, variant: 'standard' }])
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
    expect(onChange).toHaveBeenNthCalledWith(2, []) // rolled back to the pre-edit showcase
    expect(onToast).toHaveBeenCalledOnce()
  })
})

describe('ShowcaseView: visited-profile inspect passes the showcase entry through', () => {
  it('calls onInspect with the entry, not just the card, so a visitor can see it unlocked', () => {
    const onInspect = vi.fn()
    const entry: ShowcaseEntry = { cardId: card.id, variant: 'standard' }
    render(<ShowcaseView showcase={[entry]} onInspect={onInspect} />)

    fireEvent.click(screen.getByRole('button'))
    expect(onInspect).toHaveBeenCalledWith(card, entry)
  })
})
