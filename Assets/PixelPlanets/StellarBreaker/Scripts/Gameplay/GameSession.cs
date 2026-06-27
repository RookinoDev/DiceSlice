using System;
using System.Collections.Generic;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;

namespace StellarBreaker.Gameplay
{
    /// <summary>
    /// Headless composition root for the core loop: enemy + wallet + tap-damage
    /// upgrade + tap controller, wired together (kill → award Stardust). Fully
    /// drivable from tests with a fake IPlanetProvider.
    /// </summary>
    public class GameSession
    {
        readonly BalanceConfig _cfg;

        public EnemyController  Enemy      { get; }
        public CurrencyService  Wallet     { get; }
        public TapDamageUpgrade TapUpgrade { get; }
        public TapController     Taps      { get; }
        public ShipService       Ships     { get; }

        /// <summary>Fired when a planet dies and Stardust is awarded (planet, gold).</summary>
        public event Action<Planet, BigNumber> OnReward;

        public GameSession(IPlanetProvider provider, BalanceConfig cfg, int startStage = 1,
                           IReadOnlyList<ShipDefinition> ships = null)
        {
            _cfg       = cfg ?? throw new ArgumentNullException(nameof(cfg));
            Wallet     = new CurrencyService();
            TapUpgrade = new TapDamageUpgrade(cfg);
            Enemy      = new EnemyController(provider, cfg, startStage);
            Taps       = new TapController(Enemy, TapUpgrade);
            Ships      = new ShipService(ships ?? Array.Empty<ShipDefinition>(), cfg);

            Enemy.OnPlanetKilled += HandleKill;
        }

        public void Begin() => Enemy.Begin();

        /// <summary>Apply one tap of damage to the active planet.</summary>
        public void Tap() => Taps.Tap();

        /// <summary>Advance idle/auto damage by elapsed seconds. Returns damage dealt.</summary>
        public BigNumber Tick(double deltaSeconds) => Ships.Tick(deltaSeconds, Enemy);

        /// <summary>Buy the next tap-damage level. False if unaffordable.</summary>
        public bool UpgradeTapDamage() => TapUpgrade.TryUpgrade(Wallet);

        /// <summary>Buy/upgrade ship i. False if unaffordable.</summary>
        public bool BuyShip(int i) => Ships.BuyOrUpgrade(i, Wallet);

        void HandleKill(Planet planet)
        {
            BigNumber gold = GoldReward.ForPlanet(planet, _cfg);
            Wallet.Add(gold);
            OnReward?.Invoke(planet, gold);
        }
    }
}
