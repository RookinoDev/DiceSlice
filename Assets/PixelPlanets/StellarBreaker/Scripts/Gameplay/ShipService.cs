using System;
using System.Collections.Generic;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;

namespace StellarBreaker.Gameplay
{
    /// <summary>
    /// Owns the fleet: per-ship levels, buy/upgrade (infinite), cooldown-based hits,
    /// effective DPS (with milestones + cooldown breakpoints), and idle damage per tick.
    /// </summary>
    public class ShipService
    {
        const int MaxHitsPerShipPerTick = 1000;   // safety clamp

        readonly IReadOnlyList<ShipDefinition> _ships;
        readonly BalanceConfig _cfg;
        readonly int[]    _levels;
        readonly double[] _timers;                 // seconds accumulated toward next hit

        /// <summary>(shipIndex, newLevel)</summary>
        public event Action<int, int>       OnShipChanged;
        /// <summary>(shipIndex, hitDamage) — for floating numbers.</summary>
        public event Action<int, BigNumber> OnShipHit;

        public ShipService(IReadOnlyList<ShipDefinition> ships, BalanceConfig cfg)
        {
            _ships  = ships ?? throw new ArgumentNullException(nameof(ships));
            _cfg    = cfg   ?? throw new ArgumentNullException(nameof(cfg));
            _levels = new int[_ships.Count];
            _timers = new double[_ships.Count];
        }

        public int  Count          => _ships.Count;
        public int  LevelOf(int i) => _levels[i];
        public bool IsOwned(int i) => _levels[i] > 0;
        public ShipDefinition Def(int i) => _ships[i];

        public BigNumber NextCost(int i)
            => UpgradeCost.Exponential(_levels[i] + 1, _ships[i].baseCost, _cfg.shipCostPerLevel);

        public double Cooldown(int i)
            => ShipCombat.Cooldown(_levels[i], _ships[i].baseCooldown,
                                   _cfg.shipCooldownBreakpoints, _cfg.shipCooldownFactor, _cfg.shipCooldownMin);

        public BigNumber HitDamage(int i)
            => ShipCombat.HitDamage(_levels[i], _ships[i].baseHitDamage, _cfg.shipDamagePerLevel,
                                    _cfg.shipMilestoneLevels, _cfg.shipMilestoneMultipliers);

        public BigNumber ShipDps(int i)
            => ShipCombat.EffectiveDps(_levels[i], _ships[i].baseHitDamage, _ships[i].baseCooldown,
                                       _cfg.shipDamagePerLevel,
                                       _cfg.shipCooldownBreakpoints, _cfg.shipCooldownFactor, _cfg.shipCooldownMin,
                                       _cfg.shipMilestoneLevels, _cfg.shipMilestoneMultipliers);

        public BigNumber FleetDps()
        {
            var sum = BigNumber.Zero;
            for (int i = 0; i < _ships.Count; i++) sum = sum + ShipDps(i);
            return sum;
        }

        public bool BuyOrUpgrade(int i, CurrencyService wallet)
        {
            if (wallet == null) throw new ArgumentNullException(nameof(wallet));
            if (!wallet.TrySpend(NextCost(i))) return false;
            _levels[i]++;
            OnShipChanged?.Invoke(i, _levels[i]);
            return true;
        }

        /// <summary>Reset every ship to unowned (used by prestige).</summary>
        public void ResetLevels()
        {
            for (int i = 0; i < _levels.Length; i++) { _levels[i] = 0; _timers[i] = 0; }
        }

        /// <summary>
        /// Advance all ship cooldowns by deltaSeconds; each ship that completes a cooldown
        /// deals one HitDamage to the active planet. Returns total damage dealt this tick.
        /// </summary>
        public BigNumber Tick(double deltaSeconds, EnemyController enemy)
        {
            if (enemy == null || deltaSeconds <= 0) return BigNumber.Zero;

            var total = BigNumber.Zero;
            for (int i = 0; i < _ships.Count; i++)
            {
                if (_levels[i] <= 0) continue;

                double cd = Cooldown(i);
                _timers[i] += deltaSeconds;

                int hits = 0;
                while (_timers[i] >= cd && hits < MaxHitsPerShipPerTick)
                {
                    _timers[i] -= cd;
                    var hit = HitDamage(i);
                    if (enemy.Current != null) enemy.ApplyDamage(hit);
                    OnShipHit?.Invoke(i, hit);
                    total = total + hit;
                    hits++;
                }
            }
            return total;
        }
    }
}
