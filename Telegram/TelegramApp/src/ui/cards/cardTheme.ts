// Presentation-only rarity theme for the card UI - kept separate from game/cards/catalog.ts's
// data, matching how shipTierVisuals.ts separates fleet presentation from ShipDefinition.ts.
import type { CardRarity } from '../../game/cards/catalog'

export const RARITY_COLOR: Record<CardRarity, string> = {
  common: '#8b93ac',
  uncommon: '#3adc84',
  rare: '#43ddee',
  epic: '#e24fff',
  legendary: '#ffb238',
  ultra: '#fff2c9',
}

/** Collection-number display, e.g. "023/066". */
export function collectionNo(no: number, total: number): string {
  return `${String(no).padStart(3, '0')}/${String(total).padStart(3, '0')}`
}
