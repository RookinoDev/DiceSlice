using System;
using System.Collections.Generic;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;

namespace StellarBreaker.Gameplay
{
    /// <summary>
    /// Headless composition root for the core loop. StageManager is the single
    /// progression authority; skills buff tap/idle; prestige resets the run for Relics.
    /// </summary>
    public class GameSession
    {
        readonly BalanceConfig _cfg;

        public StageManager     Stage      { get; }
        public EnemyController  Enemy      { get; }
        public CurrencyService  Wallet     { get; }
        public TapDamageUpgrade TapUpgrade { get; }
        public TapController    Taps       { get; }
        public ShipService      Ships      { get; }
        public SkillService     Skills     { get; }
        public PrestigeService  Prestige   { get; }

        /// <summary>The active skills exposed to the UI (in display order).</summary>
        public IReadOnlyList<SkillType> SkillSlots { get; }

        public event Action<Planet, BigNumber> OnReward;

        public GameSession(IPlanetProvider provider, BalanceConfig cfg, int startStage = 1,
                           IReadOnlyList<ShipDefinition> ships = null)
        {
            _cfg       = cfg ?? throw new ArgumentNullException(nameof(cfg));
            Wallet     = new CurrencyService();
            TapUpgrade = new TapDamageUpgrade(cfg);
            Stage      = new StageManager(cfg, startStage);
            Enemy      = new EnemyController(provider, Stage);
            Ships      = new ShipService(ships ?? Array.Empty<ShipDefinition>(), cfg);
            Skills     = new SkillService(SkillCatalog.BuildPrototype(cfg), () => TapUpgrade.Level);
            Prestige   = new PrestigeService(cfg);
            SkillSlots = new[] { SkillType.Overdrive, SkillType.BattleCry, SkillType.MeteorStrike };

            // Taps are multiplied by the active tap-damage skill buff.
            Taps = new TapController(Enemy, TapUpgrade, () => Skills.TapDamageMultiplier());

            Enemy.OnPlanetKilled += HandleKill;
            Stage.OnBossFailed   += HandleBossFailed;
        }

        public void Begin() => Enemy.Begin();
        public void Tap()   => Taps.Tap();

        /// <summary>Advance boss timer, skill timers, and idle damage (DPS skill-buffed).</summary>
        public BigNumber Tick(double deltaSeconds)
        {
            Stage.Tick(deltaSeconds);
            Skills.Tick(deltaSeconds);
            return Ships.Tick(deltaSeconds, Enemy, Skills.DpsMultiplier());
        }

        public bool UpgradeTapDamage() => TapUpgrade.TryUpgrade(Wallet);
        public bool BuyShip(int i)     => Ships.BuyOrUpgrade(i, Wallet);

        /// <summary>Activate a skill: timed buffs start, Meteor deals instant damage.</summary>
        public bool ActivateSkill(SkillType t)
        {
            if (!Skills.CanActivate(t)) return false;
            BigNumber instant = Skills.Activate(t, TapUpgrade.CurrentDamage);
            if (instant > BigNumber.Zero) Enemy.ApplyDamage(instant);
            return true;
        }

        // ── Prestige ────────────────────────────────────────────────
        public bool      CanPrestige()   => Stage.HighestStage >= _cfg.prestigeUnlockStage;
        public BigNumber PreviewRelics() => Prestige.RelicsForStage(Stage.HighestStage);

        /// <summary>Reset the run for Relics. Returns Relics gained (0 if not unlocked).</summary>
        public BigNumber DoPrestige()
        {
            if (!CanPrestige()) return BigNumber.Zero;
            BigNumber gained = Prestige.Prestige(Stage.HighestStage, Wallet, TapUpgrade, Ships, Stage);
            Stage.Begin();   // re-enter stage 1 → spawns a fresh planet
            return gained;
        }

        void HandleKill(Planet planet)
        {
            BigNumber gold = Stage.GoldFor(planet.Stage);
            Wallet.Add(gold);
            OnReward?.Invoke(planet, gold);
        }

        void HandleBossFailed(int stage)
        {
            Enemy.Respawn();
            Stage.RetryBoss();
        }
    }
}
