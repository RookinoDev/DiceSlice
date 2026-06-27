using System;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;

namespace StellarBreaker.Gameplay
{
    /// <summary>
    /// The infinitely-upgradable tap-damage stat. Owns the level; computes current
    /// damage and next cost from parametric curves; buys the next level via a wallet.
    /// </summary>
    public class TapDamageUpgrade
    {
        readonly BalanceConfig _cfg;

        public int Level { get; private set; }

        public event Action<int> OnLevelChanged;

        public TapDamageUpgrade(BalanceConfig cfg, int level = 1)
        {
            _cfg  = cfg ?? throw new ArgumentNullException(nameof(cfg));
            Level = level < 1 ? 1 : level;
        }

        public BigNumber CurrentDamage => TapDamageCurve.ForLevel(Level, _cfg);
        public BigNumber NextCost      => UpgradeCost.TapDamage(Level, _cfg);

        /// <summary>Spend Stardust to raise the level by one. False if unaffordable.</summary>
        public bool TryUpgrade(CurrencyService wallet)
        {
            if (wallet == null) throw new ArgumentNullException(nameof(wallet));
            if (!wallet.TrySpend(NextCost)) return false;
            Level++;
            OnLevelChanged?.Invoke(Level);
            return true;
        }

        /// <summary>Reset to a level (used by prestige).</summary>
        public void Reset(int level = 1)
        {
            Level = level < 1 ? 1 : level;
            OnLevelChanged?.Invoke(Level);
        }
    }
}
