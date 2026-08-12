// @vitest-environment jsdom
// Tapping a leaderboard row should open that player's profile - previously the rows were plain,
// non-interactive divs (a player asked to be able to browse other players' profiles/collections).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LeaderboardSheet } from './LeaderboardSheet'
import type { LeaderboardEntry } from '../../game/leaderboardApi'

const fetchLeaderboardMock = vi.fn()
vi.mock('../../game/leaderboardApi', () => ({ fetchLeaderboard: (...args: unknown[]) => fetchLeaderboardMock(...args) }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const entries: LeaderboardEntry[] = [
  { telegramUserId: 111, firstName: 'Alireza', username: 'alireza', photoUrl: null, value: 2230 },
  { telegramUserId: 222, firstName: 'Rook', username: 'rook', photoUrl: null, value: 1800 },
]

describe('LeaderboardSheet: rows open the tapped player\'s profile', () => {
  it('calls onSelectPlayer with that row\'s telegramUserId', async () => {
    fetchLeaderboardMock.mockResolvedValue(entries)
    const onSelectPlayer = vi.fn()
    render(<LeaderboardSheet open={true} onClose={() => {}} apiBaseUrl="https://example.test" onSelectPlayer={onSelectPlayer} />)

    await screen.findByText('Alireza')
    fireEvent.click(screen.getByText('Alireza'))
    expect(onSelectPlayer).toHaveBeenCalledWith(111)

    fireEvent.click(screen.getByText('Rook'))
    expect(onSelectPlayer).toHaveBeenCalledWith(222)
  })
})
