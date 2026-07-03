using System;
using System.Collections.Generic;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;

namespace StellarBreaker.Gameplay
{
    /// <summary>
    /// Permanent artifacts bought with Relics. Each adds a multiplicative bonus to a stat.
    /// Survives prestige (Relics + artifact levels are not reset).
    /// </summary>
    public class ArtifactService
    {
        readonly IReadOnlyList<ArtifactDefinition> _defs;
        readonly CurrencyService _relics;
        readonly int[] _levels;

        public event Action<int, int> OnArtifactChanged;

        public ArtifactService(IReadOnlyList<ArtifactDefinition> defs, CurrencyService relicWallet)
        {
            _defs   = defs ?? throw new ArgumentNullException(nameof(defs));
            _relics = relicWallet ?? throw new ArgumentNullException(nameof(relicWallet));
            _levels = new int[_defs.Count];
        }

        public int Count => _defs.Count;
        public int LevelOf(int i) => _levels[i];
        public ArtifactDefinition Def(int i) => _defs[i];

        /// <summary>Restore artifact levels from a save (extra/short entries ignored).</summary>
        public void RestoreLevels(int[] levels)
        {
            if (levels == null) return;
            int n = System.Math.Min(levels.Length, _levels.Length);
            for (int i = 0; i < n; i++) _levels[i] = levels[i] < 0 ? 0 : levels[i];
        }

        public BigNumber NextCost(int i)
            => UpgradeCost.Exponential(_levels[i] + 1, _defs[i].baseCost, _defs[i].costGrowth);

        public bool BuyOrUpgrade(int i)
        {
            if (!_relics.TrySpend(NextCost(i))) return false;
            _levels[i]++;
            OnArtifactChanged?.Invoke(i, _levels[i]);
            return true;
        }

        /// <summary>Upgrade artifact i as many times as Relics allow (real cost each step →
        /// cannot overspend). Returns levels bought. Capped for safety.</summary>
        public int BuyOrUpgradeMax(int i, int cap = 100000)
        {
            int n = 0;
            while (n < cap && BuyOrUpgrade(i)) n++;
            return n;
        }

        /// <summary>Current fractional bonus for artifact i (0 if unowned). UI-friendly.</summary>
        public double LevelBonus(int i) => _defs[i].BonusAt(_levels[i]);

        /// <summary>Aggregate multiplier for a stat = ∏ (1 + bonus(level)).</summary>
        public BigNumber Multiplier(ArtifactEffect effect)
        {
            var mult = BigNumber.One;
            for (int i = 0; i < _defs.Count; i++)
            {
                if (_defs[i].effect != effect || _levels[i] <= 0) continue;
                mult = mult * new BigNumber(1.0 + _defs[i].BonusAt(_levels[i]));
            }
            return mult;
        }

        public BigNumber DpsMultiplier()       => Multiplier(ArtifactEffect.Dps);
        public BigNumber GoldMultiplier()      => Multiplier(ArtifactEffect.Gold);
        public BigNumber TapDamageMultiplier() => Multiplier(ArtifactEffect.TapDamage);
    }
}
