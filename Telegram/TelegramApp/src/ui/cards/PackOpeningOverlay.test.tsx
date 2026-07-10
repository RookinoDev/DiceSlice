// @vitest-environment jsdom
// Drives the full pack-opening ceremony in a simulated DOM: hold-to-tear -> burst -> deal ->
// per-card lift/flip -> recap -> next pack. Uses the DEV mock API path (no initData in jsdom,
// import.meta.env.DEV in vitest), i.e. the same code the browser preview exercises.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PackOpeningOverlay } from './PackOpeningOverlay'
import type { PendingPack } from '../../game/cards/cardsApi'
// Pre-cache the DEV mock module: cardsApi reaches it via dynamic import, and under fake
// timers a first-time module load (real I/O, not a microtask) would never resolve.
import '../../game/cards/devMock'

// jsdom lacks rAF, matchMedia, AudioContext, and canvas - stub the platform, not the app.
beforeEach(() => {
  vi.useFakeTimers()
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    return setTimeout(() => {
      now += 50
      cb(now)
    }, 16) as unknown as number
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  vi.stubGlobal(
    'matchMedia',
    (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList,
  )
  vi.stubGlobal('AudioContext', class { resume() {} createBuffer() { return { copyToChannel() {} } } createBufferSource() { return { connect() {}, start() {} } } createGain() { return { gain: {}, connect() {} } } get state() { return 'running' } get destination() { return {} } })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const packs: PendingPack[] = [
  { id: 9002, type: 'singularity', createdAtMs: 0 },
  { id: 9001, type: 'meteor', createdAtMs: 0 },
]

describe('PackOpeningOverlay ceremony', () => {
  it('runs the whole ceremony: tear -> burst -> deal -> flips -> recap -> next pack', async () => {
    const onOpened = vi.fn()
    const { container } = render(<PackOpeningOverlay apiBaseUrl={undefined} pendingPacks={packs} onOpened={onOpened} open={true} onClose={() => {}} />)

    // Phase: pack. The wrapper floats, hint invites the hold.
    expect(container.querySelector('.pack-wrapper')).toBeTruthy()
    expect(screen.getByText('HOLD TO TEAR OPEN')).toBeTruthy()
    expect(screen.getByText(/2 LEFT/)).toBeTruthy()

    // Releasing early cancels the tear.
    const wrapper = container.querySelector('.pack-wrapper')!
    fireEvent.pointerDown(wrapper)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    fireEvent.pointerUp(wrapper)
    expect(container.querySelector('.pack-burst-flash')).toBeNull()

    // Full hold tears it: burst appears, then the dev-mock result deals in.
    fireEvent.pointerDown(wrapper)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500)
    })
    expect(onOpened).toHaveBeenCalledOnce()
    // Dealing/reveal: 5 face-down cards on the table.
    expect(container.querySelectorAll('.pack-card').length).toBe(5)

    // Let the deal finish -> reveal phase with the tap hint.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(screen.getByText('TAP TO REVEAL')).toBeTruthy()
    // Rarity tell: exactly one top card glows before its flip.
    expect(container.querySelectorAll('.pack-card--top').length).toBe(1)

    // Flip all five (each tap: lift 170ms -> land). Re-query the stage every tap: a
    // legendary flip's screen shake remounts the overlay subtree (key replay trick), which
    // detaches previously-captured nodes - real taps always land on the live DOM.
    for (let i = 1; i <= 5; i++) {
      fireEvent.click(container.querySelector('.pack-table')!.parentElement!)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600)
      })
      expect(container.querySelectorAll('.pack-card--revealed').length).toBe(i)
    }

    // Recap: best pull enthroned (the mock's legendary holo Betelgeuse), minis + continue.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(screen.getByText('BEST PULL')).toBeTruthy()
    expect(screen.getByText('BETELGEUSE')).toBeTruthy()
    expect(container.querySelectorAll('.pack-recap-mini').length).toBe(4)

    // CONTINUE chains straight into the next pack's ceremony.
    fireEvent.click(screen.getByText(/NEXT PACK/))
    expect(container.querySelector('.pack-wrapper')).toBeTruthy()
  })

  it('reveals variant, NEW, and serial details on flipped cards', async () => {
    const { container } = render(<PackOpeningOverlay apiBaseUrl={undefined} pendingPacks={packs} onOpened={() => {}} open={true} onClose={() => {}} />)
    fireEvent.pointerDown(container.querySelector('.pack-wrapper')!)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000)
    })
    for (let i = 0; i < 5; i++) {
      fireEvent.click(container.querySelector('.pack-table')!.parentElement!)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600)
      })
    }
    // Mock pack contains a foil, a holo legendary, a polychrome, and 3 NEW cards.
    expect(container.querySelectorAll('.pack-reveal-variant').length).toBeGreaterThanOrEqual(3)
    expect(container.querySelectorAll('.pack-reveal-new').length).toBeGreaterThanOrEqual(3)
    expect(container.querySelectorAll('.pack-reveal-serial').length).toBe(5)
  })
})
