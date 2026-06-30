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
        public ArtifactService  Artifacts  { get; }

        /// <summary>The active skills exposed to the UI (in display order).</summary>
        public IReadOnlyList<SkillType> SkillSlots { get; }

        public event Action<Planet, BigNumber> OnReward;
        /// <summary>Short player-facing notices (e.g. boss failed).</summary>
        public event Action<string> OnMessage;

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
            Artifacts  = new ArtifactService(ArtifactCatalog.BuildDefault(cfg), Prestige.Relics);
            SkillSlots = new[] { SkillType.Overdrive, SkillType.BattleCry, SkillType.MeteorStrike,
                                 SkillType.DroneSwarm, SkillType.MidasBeam };

            // Taps are multiplied by the active tap-damage skill buff × permanent tap artifact.
            Taps = new TapController(Enemy, TapUpgrade,
                                     () => Skills.TapDamageMultiplier() * Artifacts.TapDamageMultiplier());

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

            // Drone Swarm: auto-taps/sec while active → continuous tap damage.
            double taps = Skills.DroneTapsPerSecond();
            if (taps > 0 && Enemy.Current != null)
            {
                BigNumber droneDmg = TapUpgrade.CurrentDamage
                                   * Skills.TapDamageMultiplier() * Artifacts.TapDamageMultiplier()
                                   * new BigNumber(taps * deltaSeconds);
                Enemy.ApplyDamage(droneDmg);
            }

            return Ships.Tick(deltaSeconds, Enemy, Skills.DpsMultiplier() * Artifacts.DpsMultiplier());
        }

        public bool UpgradeTapDamage() => TapUpgrade.TryUpgrade(Wallet);
        public bool BuyShip(int i)     => Ships.BuyOrUpgrade(i, Wallet);

        /// <summary>Buy/upgrade a permanent artifact with Relics. False if unaffordable.</summary>
        public bool BuyArtifact(int i) => Artifacts.BuyOrUpgrade(i);

        // ── Buy Max (spend everything affordable; never overspends) ──
        public int UpgradeTapDamageMax() => TapUpgrade.UpgradeMax(Wallet);
        public int BuyShipMax(int i)     => Ships.BuyOrUpgradeMax(i, Wallet);
        public int BuyArtifactMax(int i) => Artifacts.BuyOrUpgradeMax(i);

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
            BigNumber gold = Stage.GoldFor(planet.Stage) * Artifacts.GoldMultiplier() * Skills.GoldMultiplier();
            Wallet.Add(gold);
            OnReward?.Invoke(planet, gold);
        }

        // Boss-fail fallback: drop to the previous normal stage to farm power, then
        // re-advance into the boss again. Avoids the no-income soft-lock.
        void HandleBossFailed(int stage)
        {
            Stage.GoToStage(stage - 1);
            OnMessage?.Invoke("Boss failed — farm power and try again");
        }
    }
}
