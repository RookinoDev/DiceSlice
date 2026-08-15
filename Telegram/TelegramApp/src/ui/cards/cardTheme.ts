// Presentation-only rarity theme for the card UI - kept separate from game/cards/catalog.ts's
// data, matching how shipTierVisuals.ts separates fleet presentation from ShipDefinition.ts.
import type { CardRarity } from '../../game/cards/catalog'
import type { PackType } from '../../game/cards/cardsApi'
import gemCommon from '../../assets/cards/gem-common.png'
import gemUncommon from '../../assets/cards/gem-uncommon.png'
import gemRare from '../../assets/cards/gem-rare.png'
import gemEpic from '../../assets/cards/gem-epic.png'
import gemLegendary from '../../assets/cards/gem-legendary.png'
import gemUltra from '../../assets/cards/gem-ultra.png'

export const RARITY_COLOR: Record<CardRarity, string> = {
  common: '#8b93ac',
  uncommon: '#3adc84',
  rare: '#43ddee',
  epic: '#e24fff',
  legendary: '#ffb238',
  ultra: '#fff2c9',
}

/** Shared rarity filter-chip options, low-to-high plus 'all' - was duplicated in CardsScreen.tsx
 *  before; SocketPickerSheet.tsx now reuses it too. */
export const RARITY_FILTERS: Array<CardRarity | 'all'> = ['all', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'ultra']

/** Faceted gem silhouette per tier (docs/CARD_SYSTEM_PLAN.md §2 "Rarity gems") - the collection-number line icon. Shape carries the tier read; color stays the art's own iridescent look rather than being tinted, so it doesn't fight RARITY_COLOR's border/glow use elsewhere. */
export const RARITY_GEM: Record<CardRarity, string> = {
  common: gemCommon,
  uncommon: gemUncommon,
  rare: gemRare,
  epic: gemEpic,
  legendary: gemLegendary,
  ultra: gemUltra,
}

/** Which rarity tier's color/gem a pack type borrows for its own presentation (a pack itself
 *  isn't a card, so it has no rarity of its own - this just picks which existing palette entry
 *  it reads as). Shared by ShopSheet.tsx and PackOpeningOverlay.tsx - was duplicated in both
 *  before, drifting new pack types out of sync was one edit away. */
export const PACK_TIER_RARITY: Record<PackType, CardRarity> = {
  meteor: 'uncommon',
  stellar: 'rare',
  deepsky: 'epic',
  singularity: 'legendary',
  nebula: 'rare',
  epicvault: 'epic',
  legendarycache: 'legendary',
}

/** Collection-number display, e.g. "023/066". */
export function collectionNo(no: number, total: number): string {
  return `${String(no).padStart(3, '0')}/${String(total).padStart(3, '0')}`
}
