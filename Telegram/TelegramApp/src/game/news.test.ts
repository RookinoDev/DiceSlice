// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { NEWS_ENTRIES, unseenNewsEntries, markNewsSeen } from './news'

beforeEach(() => {
  localStorage.clear()
})

describe('news', () => {
  it('has at least one entry, newest first with a unique id', () => {
    expect(NEWS_ENTRIES.length).toBeGreaterThan(0)
    expect(new Set(NEWS_ENTRIES.map((e) => e.id)).size).toBe(NEWS_ENTRIES.length)
  })

  it('a player who has never seen news gets only the latest entry, not the whole history', () => {
    const unseen = unseenNewsEntries()
    expect(unseen).toEqual(NEWS_ENTRIES.slice(0, 1))
  })

  it('markNewsSeen against the latest entry clears unseen', () => {
    markNewsSeen()
    expect(unseenNewsEntries()).toEqual([])
  })

  it('an unrecognized lastSeenId (storage cleared oddly) falls back to just the latest entry', () => {
    localStorage.setItem('stellarbreaker.news.lastSeenId.v1', 'not-a-real-id')
    expect(unseenNewsEntries()).toEqual(NEWS_ENTRIES.slice(0, 1))
  })
})
