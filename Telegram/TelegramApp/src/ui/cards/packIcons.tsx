// Which dedicated glyph a PackType renders as (see icons.tsx's "Card Pack glyphs" section) -
// shared by ShopSheet.tsx's pack tiles and PackOpeningOverlay.tsx's ceremony wrapper, so both
// show the exact same icon for a given pack rather than two independent guesses.
import type { ComponentType } from 'react'
import type { PackType } from '../../game/cards/cardsApi'
import { MeteorPackIcon, StellarPackIcon, DeepSkyPackIcon, NebulaPackIcon, EpicVaultPackIcon, SingularityPackIcon, LegendaryCachePackIcon } from '../icons'

interface PackIconProps {
  color?: string
  size?: number
}

export const PACK_ICON: Record<PackType, ComponentType<PackIconProps>> = {
  meteor: MeteorPackIcon,
  stellar: StellarPackIcon,
  deepsky: DeepSkyPackIcon,
  singularity: SingularityPackIcon,
  nebula: NebulaPackIcon,
  epicvault: EpicVaultPackIcon,
  legendarycache: LegendaryCachePackIcon,
}
