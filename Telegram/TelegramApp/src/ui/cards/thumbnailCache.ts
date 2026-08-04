// On-device cache for pre-rendered planet thumbnails (see ../../planet/planetThumbnail.ts) -
// IndexedDB so it survives reloads, keyed by card name (stable, unique - see cardTheme.ts's
// callers). Capped at ~30MB with LRU eviction: a card owned once and never viewed again should
// eventually give up its slot to cards the player actually looks at.
const DB_NAME = 'stellar-breaker-thumbnails'
const STORE_THUMBS = 'thumbnails'
const STORE_META = 'meta'
const DB_VERSION = 1

/** Bump this if planetThumbnail.ts's render output ever changes shape (new layer, different
 *  default framing, etc.) - every cached thumbnail is wiped and regenerated on next view. */
const CACHE_SCHEMA_VERSION = 1
const SIZE_CAP_BYTES = 30 * 1024 * 1024

interface ThumbRecord {
  key: string
  blob: Blob
  size: number
  lastAccess: number
}

/** Pure eviction decision, kept separate from IndexedDB I/O so it's unit-testable without a
 *  real (or faked) IndexedDB. Evicts oldest-`lastAccess` first until incomingSize fits under
 *  capBytes alongside whatever survives. Never evicts more than necessary. */
export function pickEvictions(records: Array<{ key: string; size: number; lastAccess: number }>, incomingSize: number, currentTotal: number, capBytes: number): string[] {
  let total = currentTotal + incomingSize
  if (total <= capBytes) return []
  const oldestFirst = [...records].sort((a, b) => a.lastAccess - b.lastAccess)
  const evict: string[] = []
  for (const r of oldestFirst) {
    if (total <= capBytes) break
    evict.push(r.key)
    total -= r.size
  }
  return evict
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_THUMBS)) db.createObjectStore(STORE_THUMBS, { keyPath: 'key' })
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'metaKey' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Clears the whole thumbnail cache if CACHE_SCHEMA_VERSION has moved on since the last visit -
 *  runs once per session (memoized like openDb itself). */
let versionCheckPromise: Promise<void> | null = null
function ensureSchemaVersion(): Promise<void> {
  if (versionCheckPromise) return versionCheckPromise
  versionCheckPromise = (async () => {
    const db = await openDb()
    const tx = db.transaction(STORE_META, 'readonly')
    const stored = await reqToPromise(tx.objectStore(STORE_META).get('schemaVersion') as IDBRequest<{ metaKey: string; value: number } | undefined>)
    if (stored?.value === CACHE_SCHEMA_VERSION) return
    const wipeTx = db.transaction([STORE_THUMBS, STORE_META], 'readwrite')
    wipeTx.objectStore(STORE_THUMBS).clear()
    wipeTx.objectStore(STORE_META).put({ metaKey: 'schemaVersion', value: CACHE_SCHEMA_VERSION })
    wipeTx.objectStore(STORE_META).put({ metaKey: 'totalSize', value: 0 })
    await reqToPromise(wipeTx.objectStore(STORE_META).get('schemaVersion'))
  })()
  return versionCheckPromise
}

async function getTotalSize(db: IDBDatabase): Promise<number> {
  const tx = db.transaction(STORE_META, 'readonly')
  const row = await reqToPromise(tx.objectStore(STORE_META).get('totalSize') as IDBRequest<{ metaKey: string; value: number } | undefined>)
  return row?.value ?? 0
}

/** Returns the cached thumbnail for `key`, or null if never rendered (or evicted). Touches
 *  lastAccess on hit so it survives future LRU passes. */
export async function getThumbnail(key: string): Promise<Blob | null> {
  await ensureSchemaVersion()
  const db = await openDb()
  const tx = db.transaction(STORE_THUMBS, 'readwrite')
  const record = await reqToPromise(tx.objectStore(STORE_THUMBS).get(key) as IDBRequest<ThumbRecord | undefined>)
  if (!record) return null
  tx.objectStore(STORE_THUMBS).put({ ...record, lastAccess: Date.now() })
  return record.blob
}

/** Caches `blob` under `key`, evicting the least-recently-viewed thumbnails first if this would
 *  push the cache over its size cap. */
export async function putThumbnail(key: string, blob: Blob): Promise<void> {
  await ensureSchemaVersion()
  const db = await openDb()
  const readTx = db.transaction([STORE_THUMBS, STORE_META], 'readonly')
  const [existing, allRecords, totalSize] = await Promise.all([
    reqToPromise(readTx.objectStore(STORE_THUMBS).get(key) as IDBRequest<ThumbRecord | undefined>),
    reqToPromise(readTx.objectStore(STORE_THUMBS).getAll() as IDBRequest<ThumbRecord[]>),
    getTotalSize(db),
  ])
  const currentTotal = totalSize - (existing?.size ?? 0)
  const others = allRecords.filter((r) => r.key !== key)
  const evictKeys = pickEvictions(others, blob.size, currentTotal, SIZE_CAP_BYTES)
  const evictedSize = others.filter((r) => evictKeys.includes(r.key)).reduce((sum, r) => sum + r.size, 0)

  const writeTx = db.transaction([STORE_THUMBS, STORE_META], 'readwrite')
  const store = writeTx.objectStore(STORE_THUMBS)
  for (const k of evictKeys) store.delete(k)
  store.put({ key, blob, size: blob.size, lastAccess: Date.now() } satisfies ThumbRecord)
  writeTx.objectStore(STORE_META).put({ metaKey: 'totalSize', value: currentTotal - evictedSize + blob.size })
  await reqToPromise(writeTx.objectStore(STORE_META).get('totalSize'))
}
