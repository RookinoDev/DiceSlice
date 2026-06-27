using System;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;

namespace StellarBreaker.Gameplay
{
    /// <summary>
    /// Pure logic model of one destructible planet/enemy. Scene-independent & testable.
    /// HP is a BigNumber derived parametrically from the stage.
    /// </summary>
    public class Planet
    {
        public int       Stage     { get; }
        public BigNumber MaxHP     { get; }
        public BigNumber CurrentHP { get; private set; }
        public bool      IsBoss    { get; }

        public bool IsDead => CurrentHP <= BigNumber.Zero;

        /// <summary>Fired exactly once when HP first reaches ≤ 0.</summary>
        public event Action<Planet> OnDestroyed;

        public Planet(int stage, BigNumber maxHp, bool isBoss = false)
        {
            Stage     = stage;
            IsBoss    = isBoss;
            MaxHP     = maxHp;
            CurrentHP = maxHp;
        }

        /// <summary>Factory using the parametric enemy-HP curve from BalanceConfig.</summary>
        public static Planet Create(int stage, BalanceConfig cfg)
            => new Planet(stage, EnemyHp.ForStage(stage, cfg.enemyHpBase, cfg.enemyHpGrowth));

        public static Planet CreateBoss(int stage, BalanceConfig cfg, int multiplier)
            => new Planet(stage,
                          EnemyHp.BossForStage(stage, cfg.enemyHpBase, cfg.enemyHpGrowth, multiplier),
                          isBoss: true);

        /// <summary>Apply tap/DPS damage. Fires OnDestroyed once when HP hits zero.</summary>
        public void ApplyDamage(BigNumber damage)
        {
            if (IsDead) return;

            CurrentHP = CurrentHP - damage;
            if (CurrentHP <= BigNumber.Zero)
            {
                CurrentHP = BigNumber.Zero;
                OnDestroyed?.Invoke(this);
            }
        }

        /// <summary>0..1 remaining-HP fraction for health bars.</summary>
        public double HpFraction01()
        {
            if (MaxHP <= BigNumber.Zero) return 0.0;
            double f = (CurrentHP / MaxHP).ToDouble();
            return f < 0 ? 0 : (f > 1 ? 1 : f);
        }
    }
}
