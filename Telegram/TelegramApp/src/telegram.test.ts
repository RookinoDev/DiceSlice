// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { getSharedProfileUserId } from './telegram'

function setSearch(search: string) {
  window.history.replaceState(null, '', `/${search}`)
}

afterEach(() => {
  setSearch('')
})

describe('getSharedProfileUserId', () => {
  it('reads the ?u= query param set by worker.mjs\'s /start handler on a shared link', () => {
    setSearch('?u=12345')
    expect(getSharedProfileUserId()).toBe(12345)
  })

  it('returns null when absent (a normal, non-shared launch)', () => {
    expect(getSharedProfileUserId()).toBeNull()
  })

  it('returns null for a non-numeric or non-positive value rather than throwing', () => {
    setSearch('?u=not-a-number')
    expect(getSharedProfileUserId()).toBeNull()
    setSearch('?u=-5')
    expect(getSharedProfileUserId()).toBeNull()
    setSearch('?u=0')
    expect(getSharedProfileUserId()).toBeNull()
  })
})
