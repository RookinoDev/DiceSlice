using System;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;

namespace StellarBreaker.Gameplay
{
    /// <summary>
    /// Prestige: convert progress into Relics and reset run state. Relics + artifacts persist.
    ///   Relics(stage) = floor( scale × max(0, stage - startStage)^power ).
    /// </summary>
    public class PrestigeService
    {
        readonly BalanceConfig _cfg;

        /// <summary>Persistent Relic balance (the prestige currency).</summary>
        public CurrencyService Relics { get; } = new CurrencyService();

        public event Action<BigNumber> OnPrestiged;   // relics gained

        public PrestigeService(BalanceConfig cfg)
            => _cfg = cfg ?? throw new ArgumentNullException(nameof(cfg));

        public BigNumber RelicsForStage(int highestStage)
        {
            int s = Math.Max(0, highestStage - _cfg.relicStartStage);
            if (s <= 0) return BigNumber.Zero;
            double r = _cfg.relicScale * Math.Pow(s, _cfg.relicPower);
            return new BigNumber(Math.Floor(r));
        }

        /// <summary>
        /// Perform a prestige: award Relics from the highest stage, then reset the run
        /// (Stardust, tap level, ship levels, stage). Returns Relics gained.
        /// </summary>
        public BigNumber Prestige(int highestStage,
                                  CurrencyService stardust,
                                  TapDamageUpgrade tap,
                                  ShipService ships,
                                  StageManager stage = null)
        {
            var gained = RelicsForStage(highestStage);
            Relics.Add(gained);

            stardust?.Set(BigNumber.Zero);
            tap?.Reset();
            ships?.ResetLevels();
            stage?.ResetToStart();

            OnPrestiged?.Invoke(gained);
            return gained;
        }
    }
}
