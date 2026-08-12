// "What's New" - shown once per update (see news.ts) to a returning player, listing everything
// that changed since they last opened the game.
import type { NewsEntry } from '../../game/news'
import { Sheet } from '../Sheet'

interface NewsSheetProps {
  entries: NewsEntry[]
  open: boolean
  onClose: () => void
}

export function NewsSheet({ entries, open, onClose }: NewsSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="WHAT'S NEW">
      <div className="news-list">
        {entries.map((entry) => (
          <div key={entry.id} className="news-entry">
            <div className="news-entry-date">{entry.date}</div>
            <div className="news-entry-title">{entry.title}</div>
            <ul className="news-entry-items">
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <button className="tutorial-callout-got-it" onClick={onClose}>
        GOT IT
      </button>
    </Sheet>
  )
}
