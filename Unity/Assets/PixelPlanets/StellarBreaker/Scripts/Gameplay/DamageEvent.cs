using StellarBreaker.Core;

namespace StellarBreaker.Gameplay
{
    /// <summary>
    /// Logic payload for a single damage application. The View layer subscribes to
    /// TapController.OnDamageDealt and spawns a floating number from this.
    /// (Screen position is a View concern; crit comes online with skills.)
    /// </summary>
    public readonly struct DamageEvent
    {
        public readonly BigNumber Amount;
        public readonly bool      IsCrit;

        public DamageEvent(BigNumber amount, bool isCrit = false)
        {
            Amount = amount;
            IsCrit = isCrit;
        }
    }
}
