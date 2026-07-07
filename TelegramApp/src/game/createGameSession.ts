import { defaultBalanceConfig, type BalanceConfig } from './config/BalanceConfig'
import { buildDefaultShips } from './config/ShipDefinition'
import { GameSession } from './gameplay/GameSession'

/** Builds a fully-wired GameSession with the default ship roster and balance config. */
export function createGameSession(cfg: BalanceConfig = defaultBalanceConfig): GameSession {
  return new GameSession(cfg, 1, buildDefaultShips())
}
