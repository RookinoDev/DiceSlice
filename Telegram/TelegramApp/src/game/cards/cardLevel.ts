// A base card's Level reflects how many duplicate copies you own (any variant combined) -
// climbs on doubling thresholds (1/2/4/8/16/...) so it's a real, satisfying "level up" without
// ever needing hundreds of copies to keep climbing. See gemAbility.ts for how a level scales a
// socketed card's ability.
export function cardLevelForCount(count: number): number {
  if (count <= 0) return 0
  return 1 + Math.floor(Math.log2(count))
}

/** Total copies needed to reach the NEXT level - for a "3 more to level up" style UI hint. */
export function copiesForNextCardLevel(count: number): number {
  return 2 ** cardLevelForCount(count)
}
