using System;
using StellarBreaker.Core;

namespace StellarBreaker.Gameplay
{
    /// <summary>
    /// Applies tap damage to the active planet and emits a damage event for the View
    /// (floating numbers). Input source (mouse/touch) lives in the scene layer and
    /// just calls Tap(); this stays headless/testable.
    /// </summary>
    public class TapController
    {
        readonly EnemyController  _enemy;
        readonly TapDamageUpgrade _tapDamage;

        /// <summary>View hook for floating damage numbers.</summary>
        public event Action<DamageEvent> OnDamageDealt;

        public TapController(EnemyController enemy, TapDamageUpgrade tapDamage)
        {
            _enemy     = enemy     ?? throw new ArgumentNullException(nameof(enemy));
            _tapDamage = tapDamage ?? throw new ArgumentNullException(nameof(tapDamage));
        }

        public void Tap()
        {
            if (_enemy.Current == null) return;

            BigNumber dmg = _tapDamage.CurrentDamage;
            _enemy.ApplyDamage(dmg);
            OnDamageDealt?.Invoke(new DamageEvent(dmg, isCrit: false));
        }
    }
}
