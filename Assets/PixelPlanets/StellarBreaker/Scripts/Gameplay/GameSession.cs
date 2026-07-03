using System;
using System.Collections.Generic;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;
using StellarBreaker.Monetization;

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
        public DailyRewardService Daily    { get; } = new DailyRewardService();

        /// <summary>The active skills exposed to the UI (in display order).</summary>
        public IReadOnlyList<SkillType> SkillSlots { get; }

        public event Action<Planet, BigNumber> OnReward;
        /// <summary>Short player-facing notices (e.g. boss failed).</summary>
        public event Action<string> OnMessage;
        /// <summary>Damage dealt by an active skill (Meteor instant, Drone auto-tap) — for feedback only.</summary>
        public event Action<BigNumber> OnSkillDamage;

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
                OnSkillDamage?.Invoke(droneDmg);
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
            if (instant > BigNumber.Zero)
            {
                Enemy.ApplyDamage(instant);
                OnSkillDamage?.Invoke(instant);
            }
            return true;
        }

        // ── Prestige ────────────────────────────────────────────────
        /// <summary>Stage at which prestige unlocks (read-only, for UI reveal rules).</summary>
        public int       PrestigeUnlockStage => _cfg.prestigeUnlockStage;
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

        // ── Daily reward ───────────────────────────────────────────────
        public readonly struct DailyPreview
        {
            public readonly int day;          // 1..7 in the cycle
            public readonly BigNumber gold;
            public readonly bool relic;
            public readonly bool canClaim;     // true = claimable now / claim just succeeded

            public DailyPreview(int day, BigNumber gold, bool relic, bool canClaim)
            {
                this.day = day; this.gold = gold; this.relic = relic; this.canClaim = canClaim;
            }
        }

        /// <summary>What claiming right now would grant, without claiming it.</summary>
        public DailyPreview PreviewDaily(long nowUnixSeconds)
        {
            bool can = Daily.CanClaim(nowUnixSeconds);
            int streak = Daily.PreviewStreak(nowUnixSeconds);
            int day = DailyRewardTable.DayInCycle(streak);
            BigNumber oneKillGold = GoldReward.ForStage(Stage.CurrentStage, _cfg.goldBase, _cfg.goldGrowth);
            BigNumber gold = DailyRewardTable.GoldFor(streak, oneKillGold, _cfg);
            bool relic = DailyRewardTable.GrantsRelic(streak, _cfg) && Stage.HighestStage >= _cfg.prestigeUnlockStage;
            return new DailyPreview(day, gold, relic, can);
        }

        /// <summary>Claim today's daily reward. Returns what was granted (canClaim=false if already claimed today).</summary>
        public DailyPreview ClaimDaily(long nowUnixSeconds)
        {
            var preview = PreviewDaily(nowUnixSeconds);
            if (!preview.canClaim) return preview;

            Daily.Claim(nowUnixSeconds);
            Wallet.Add(preview.gold);
            if (preview.relic) Prestige.Relics.Add(BigNumber.One);
            return preview;
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
            int farmStage = stage - 1;
            Stage.GoToStage(farmStage);
            OnMessage?.Invoke("Boss failed — returned to Sector " + farmStage + ". Farm more power and retry!");
        }
    }
}
