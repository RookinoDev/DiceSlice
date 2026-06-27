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

        public BigNumber NextCost(int i)
            => UpgradeCost.Exponential(_levels[i] + 1, _defs[i].baseCost, _defs[i].costGrowth);

        public bool BuyOrUpgrade(int i)
        {
            if (!_relics.TrySpend(NextCost(i))) return false;
            _levels[i]++;
            OnArtifactChanged?.Invoke(i, _levels[i]);
            return true;
        }

        /// <summary>Aggregate multiplier for a stat = ∏ (1 + level × bonusPerLevel).</summary>
        public BigNumber Multiplier(ArtifactEffect effect)
        {
            var mult = BigNumber.One;
            for (int i = 0; i < _defs.Count; i++)
            {
                if (_defs[i].effect != effect || _levels[i] <= 0) continue;
                mult = mult * new BigNumber(1.0 + _levels[i] * _defs[i].bonusPerLevel);
            }
            return mult;
        }

        public BigNumber DpsMultiplier()       => Multiplier(ArtifactEffect.Dps);
        public BigNumber GoldMultiplier()      => Multiplier(ArtifactEffect.Gold);
        public BigNumber TapDamageMultiplier() => Multiplier(ArtifactEffect.TapDamage);
    }
}
