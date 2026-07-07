using System;
using StellarBreaker.Core;

namespace StellarBreaker.Economy
{
    /// <summary>
    /// Holds the player's Stardust balance as a BigNumber. Scene-independent.
    /// </summary>
    public class CurrencyService
    {
        public BigNumber Stardust { get; private set; } = BigNumber.Zero;

        /// <summary>Fired whenever the balance changes; passes the new balance.</summary>
        public event Action<BigNumber> OnChanged;

        public void Add(BigNumber amount)
        {
            if (amount <= BigNumber.Zero) return;
            Stardust = Stardust + amount;
            OnChanged?.Invoke(Stardust);
        }

        public bool CanAfford(BigNumber cost) => Stardust >= cost;

        /// <summary>Deduct cost if affordable. Returns false (no change) otherwise.</summary>
        public bool TrySpend(BigNumber cost)
        {
            if (cost < BigNumber.Zero) return false;
            if (Stardust < cost) return false;
            Stardust = Stardust - cost;
            OnChanged?.Invoke(Stardust);
            return true;
        }

        /// <summary>Directly set the balance (for save/load or tests).</summary>
        public void Set(BigNumber value)
        {
            Stardust = value;
            OnChanged?.Invoke(Stardust);
        }
    }
}
