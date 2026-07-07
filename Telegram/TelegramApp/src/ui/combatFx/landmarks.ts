// Tiny cross-component position registry for FX that need to travel between two DOM elements
// owned by different components (e.g. Resource Vacuum flying from the planet to the TopBar's
// gold pill). Avoids prop-drilling refs through GameShell for a handful of one-off visual hooks.
const elements = new Map<string, HTMLElement>()

export function registerLandmark(name: string, el: HTMLElement | null): void {
  if (el) elements.set(name, el)
  else elements.delete(name)
}

export function getLandmarkRect(name: string): DOMRect | null {
  return elements.get(name)?.getBoundingClientRect() ?? null
}

export function getLandmarkElement(name: string): HTMLElement | null {
  return elements.get(name) ?? null
}
