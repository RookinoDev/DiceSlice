// Ported from Assets/PixelPlanets/StellarBreaker/Scripts/Gameplay/EnemyController.cs
// The Unity version forwarded to a concrete IPlanetProvider (GameObject spawner); the web
// port drops that indirection - the visual layer subscribes to onPlanetSpawned instead and
// derives what to render from the Planet itself (stage/isBoss), so no provider push is needed.
import type { BigNumber } from '../core/BigNumber'
import { Emitter } from '../core/Emitter'
import { Planet } from './Planet'
import { StageManager } from './StageManager'

/**
 * Host for the active planet's model. Does NOT decide progression: StageManager is the
 * authority. Spawns the planet for whatever stage StageManager enters, and on death simply
 * notifies StageManager, which decides the next stage (normal advance / boss clear / boss stay).
 */
export class EnemyController {
  private readonly stageManager: StageManager
  private _current: Planet | null = null

  readonly onPlanetSpawned = new Emitter<Planet>()
  readonly onPlanetKilled = new Emitter<{ planet: Planet; overkill: BigNumber }>()

  constructor(stageManager: StageManager) {
    this.stageManager = stageManager
    this.stageManager.onStageEntered.on((stage) => this.spawnForStage(stage))
  }

  get current(): Planet | null {
    return this._current
  }
  get stage(): number {
    return this.stageManager.currentStage
  }
  get stages(): StageManager {
    return this.stageManager
  }

  /** Enter the starting stage (spawns the first planet via StageManager). */
  begin(): void {
    this.stageManager.begin()
  }

  applyDamage(damage: BigNumber): void {
    this._current?.applyDamage(damage)
  }

  /** Respawn the current stage's planet at full HP (e.g. after a boss fail). */
  respawn(): void {
    this.spawnForStage(this.stageManager.currentStage)
  }

  private handleDestroyed = (e: { planet: Planet; overkill: BigNumber }) => {
    this.onPlanetKilled.emit(e)
    this.stageManager.notifyPlanetKilled() // authority decides next stage -> onStageEntered -> spawnForStage
  }

  private spawnForStage(stage: number): void {
    this._current = new Planet(stage, this.stageManager.hpFor(stage), this.stageManager.isBossStage(stage))
    this._current.onDestroyed.on(this.handleDestroyed)
    this.onPlanetSpawned.emit(this._current)
  }
}
