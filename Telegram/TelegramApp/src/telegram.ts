// Thin wrapper around the Telegram WebApp SDK (loaded via <script> in index.html).
// Falls back to no-ops when running outside Telegram (plain browser) so local dev still works.

interface HapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
  notificationOccurred(type: 'error' | 'success' | 'warning'): void
  selectionChanged(): void
}

interface BackButton {
  isVisible: boolean
  show(): void
  hide(): void
  onClick(handler: () => void): void
  offClick(handler: () => void): void
}

export interface TelegramUser {
  id: number
  first_name: string
  username?: string
  photo_url?: string
}

interface TelegramWebApp {
  ready(): void
  expand(): void
  enableClosingConfirmation(): void
  openTelegramLink(url: string): void
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  initData: string
  initDataUnsafe: { user?: TelegramUser; start_param?: string }
  viewportHeight: number
  viewportStableHeight: number
  safeAreaInset?: { top: number; bottom: number; left: number; right: number }
  HapticFeedback?: HapticFeedback
  BackButton?: BackButton
  onEvent(event: string, handler: () => void): void
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp }
  }
}

const THEME_KEYS = [
  'bg_color',
  'text_color',
  'hint_color',
  'link_color',
  'button_color',
  'button_text_color',
  'secondary_bg_color',
] as const

let cachedWebApp: TelegramWebApp | null = null

export function initTelegram() {
  const webApp = window.Telegram?.WebApp
  cachedWebApp = webApp ?? null

  if (!webApp) {
    return { available: false as const, user: null }
  }

  webApp.ready()
  webApp.expand()
  webApp.enableClosingConfirmation()

  applyTheme(webApp)
  applySafeArea(webApp)
  webApp.onEvent('themeChanged', () => applyTheme(webApp))
  webApp.onEvent('viewportChanged', () => applySafeArea(webApp))

  return {
    available: true as const,
    user: webApp.initDataUnsafe.user ?? null,
  }
}

function applyTheme(webApp: TelegramWebApp) {
  const root = document.documentElement.style
  for (const key of THEME_KEYS) {
    const value = webApp.themeParams[key]
    if (value) root.setProperty(`--tg-${key.replace(/_/g, '-')}`, value)
  }
}

function applySafeArea(webApp: TelegramWebApp) {
  const inset = webApp.safeAreaInset
  const root = document.documentElement.style
  root.setProperty('--tg-safe-top', `${inset?.top ?? 0}px`)
  root.setProperty('--tg-safe-bottom', `${inset?.bottom ?? 0}px`)
  root.setProperty('--tg-safe-left', `${inset?.left ?? 0}px`)
  root.setProperty('--tg-safe-right', `${inset?.right ?? 0}px`)
}

/** Raw initData string for server-side validation (e.g. claiming a Stars purchase). Null outside Telegram. */
export function getInitData(): string | null {
  return cachedWebApp?.initData || null
}

/** The Telegram user opening the app (display-only - servers must use validated initData). */
export function getTelegramUser(): TelegramUser | null {
  return cachedWebApp?.initDataUnsafe.user ?? null
}

/** Deep-link start parameter (t.me startapp links), e.g. "u_12345" for a profile visit. */
export function getStartParam(): string | null {
  return cachedWebApp?.initDataUnsafe.start_param ?? null
}

/** Opens Telegram's native share sheet with prefilled text + link. No-ops outside Telegram. */
export function shareViaTelegram(url: string, text: string): void {
  cachedWebApp?.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`)
}

/** Light haptic tap - use for frequent, low-weight actions (regular taps). */
export function hapticTap(): void {
  cachedWebApp?.HapticFeedback?.impactOccurred('light')
}

/** Medium haptic - use for deliberate actions (buy, claim, skill activation). */
export function hapticAction(): void {
  cachedWebApp?.HapticFeedback?.impactOccurred('medium')
}

/** Success notification haptic - use for celebratory moments (prestige, boss kill). */
export function hapticSuccess(): void {
  cachedWebApp?.HapticFeedback?.notificationOccurred('success')
}

/**
 * Shows Telegram's native BackButton while active and routes its click to `onBack`.
 * Returns a cleanup function. No-ops outside Telegram.
 */
export function useTelegramBackButton(active: boolean, onBack: () => void): () => void {
  const backButton = cachedWebApp?.BackButton
  if (!backButton) return () => {}

  if (active) {
    backButton.show()
    backButton.onClick(onBack)
  } else {
    backButton.hide()
  }

  return () => {
    backButton.offClick(onBack)
    backButton.hide()
  }
}
