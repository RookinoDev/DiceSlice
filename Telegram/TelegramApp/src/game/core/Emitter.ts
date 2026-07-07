export type Listener<T> = (arg: T) => void

export class Emitter<T = void> {
  private listeners: Listener<T>[] = []

  on(fn: Listener<T>): () => void {
    this.listeners.push(fn)
    return () => this.off(fn)
  }

  off(fn: Listener<T>): void {
    this.listeners = this.listeners.filter((l) => l !== fn)
  }

  emit(arg: T): void {
    for (const l of this.listeners.slice()) l(arg)
  }
}
