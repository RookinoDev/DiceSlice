// Server-authoritative shop catalog (see TelegramApp/src/ui/sheets/ShopSheet.tsx, the in-app
// Shop that replaces the old chat-only "/shop" command). The client only ever renders what
// GET-equivalent /api/shop/items returns and asks for an invoice by id - price and description
// live here, never on the client, so nothing about a real-money purchase is client-trusted.
//
// `oneTime: true` items are enforced server-side (see hasPurchased in db.mjs): once a purchase
// row exists for that (user, item) pair - claimed or not - no second invoice link is issued.
//
// Item ids double as the Telegram invoice payload and the key GRANT_EFFECTS (TelegramApp's
// purchases.ts) or claimPurchases (db.mjs) switch on - never rename or reuse one, since a
// renamed id would silently orphan any already-recorded-but-unclaimed purchase forever.
export const SHOP_ITEMS = [
  // One-time, steeply discounted vs buying a Stardust bundle + Stellar Pack separately -
  // db.mjs's claimPurchases mints the Stellar Pack half (see STARTER_PACK_ITEM), the Stardust
  // half is a normal client-side GRANT_EFFECTS entry (purchases.ts).
  {
    id: 'starter_pack',
    title: 'Starter Offer',
    description: '2,000 Stardust + 1 Stellar Pack - one-time, well under buying them apart.',
    priceStars: 39,
    kind: 'bundle',
    oneTime: true,
  },
  {
    id: 'stardust_pack_500',
    title: 'Small Stardust Pack',
    description: '500 bonus Stardust.',
    priceStars: 25,
    kind: 'currency',
    oneTime: false,
  },
  {
    id: 'stardust_pack_1500',
    title: 'Medium Stardust Pack',
    description: '1,500 bonus Stardust - better value than the Small pack.',
    priceStars: 60,
    kind: 'currency',
    oneTime: false,
  },
  {
    id: 'stardust_pack_5000',
    title: 'Large Stardust Pack',
    description: '5,000 bonus Stardust - best value of the three.',
    priceStars: 175,
    kind: 'currency',
    oneTime: false,
  },
  // "buy_pack_<type>" - the <type> suffix must be a real cards.mjs PACK_TYPES key; db.mjs's
  // claimPurchases mints the pack itself, see its BUY_PACK_PREFIX comment.
  //
  // Description wording is deliberately precise about WHAT is guaranteed: "at least one X or
  // better" for the 4 standard packs (only slot 0 carries the floor, see cards.mjs), vs. "every
  // single one" / "the rest" for the 3 Stars-only vault packs below (allSlotsFloor covers every
  // slot) - the two mechanics are genuinely different and the copy shouldn't blur them.
  {
    id: 'buy_pack_meteor',
    title: 'Meteor Pack',
    description: 'Mostly 1 card, sometimes a bonus haul of up to 5. At least one uncommon or better.',
    priceStars: 20,
    kind: 'cards',
    oneTime: false,
  },
  {
    id: 'buy_pack_stellar',
    title: 'Stellar Pack',
    description: '4 cards. At least one rare or better.',
    priceStars: 45,
    kind: 'cards',
    oneTime: false,
  },
  {
    id: 'buy_pack_deepsky',
    title: 'Deep Sky Pack',
    description: '5 cards. At least one epic or better.',
    priceStars: 90,
    kind: 'cards',
    oneTime: false,
  },
  {
    id: 'buy_pack_nebula',
    title: 'Nebula Bundle',
    description: '8 cards. At least one rare or better - the biggest haul in the shop.',
    priceStars: 140,
    kind: 'cards',
    oneTime: false,
    tag: 'NEW',
  },
  {
    id: 'buy_pack_epicvault',
    title: 'Epic Vault',
    description: '3 cards, every single one epic or better. No commons, ever.',
    priceStars: 150,
    kind: 'cards',
    oneTime: false,
    tag: 'NEW',
  },
  {
    id: 'buy_pack_singularity',
    title: 'Singularity Pack',
    description: '5 cards. At least one legendary or better.',
    priceStars: 200,
    kind: 'cards',
    oneTime: false,
  },
  {
    id: 'buy_pack_legendarycache',
    title: 'Legendary Cache',
    description: '4 cards: 1 guaranteed legendary, the rest epic or better. The rarest offer in the shop.',
    priceStars: 260,
    kind: 'cards',
    oneTime: false,
    tag: 'NEW',
  },
  {
    id: 'offline_cap_boost',
    title: 'Offline Cap Extender',
    description: 'Permanently raises the offline earnings cap from 8h to 24h.',
    priceStars: 45,
    kind: 'boost',
    oneTime: true,
  },
  // Repeatable (oneTime: false) by design - Stars has no clean recurring-billing story for
  // bots, so this is modeled as a renewable 30-day top-up instead. Buying again while still
  // active extends from the current expiry rather than from now (see MonetizationBoosts).
  {
    id: 'vip_pass_30d',
    title: 'VIP Pass (30 days)',
    description: '+25% Stardust from every kill for 30 days. Repurchasing extends your remaining time.',
    priceStars: 99,
    kind: 'vip',
    oneTime: false,
  },
  // Refunds every point spent on a real stat node as unspent, so the player can rebuild their
  // tree from scratch - Talent Level/XP (how many points were ever earned) is untouched, only
  // allocation resets. Repeatable (oneTime: false) - a player may want to re-plan more than
  // once as new branches/combos open up. Eternal Drive's level and every perk it has ever
  // rolled are explicitly NOT refunded (see TalentService.resetNodeLevels's own comment) -
  // resetting it would let repeat purchases re-roll perks for free, which isn't a respec.
  {
    id: 'talent_reset',
    title: 'Talent Reset',
    description: 'Refunds every Talent Point you have spent so you can rebuild your tree from scratch. Eternal Drive perks are kept.',
    priceStars: 60,
    kind: 'boost',
    oneTime: false,
  },
]

export function getShopItem(id) {
  return SHOP_ITEMS.find((i) => i.id === id) ?? null
}
