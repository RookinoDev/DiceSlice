using System;
using StellarBreaker.Config;
using StellarBreaker.Gameplay;

namespace StellarBreaker.UI
{
    /// <summary>Immutable snapshot the main-screen View renders (no Unity types → testable).</summary>
    public struct MainViewModel
    {
        public string stageLabel;
        public string zoneLabel;          // sector/biome name, e.g. "OUTER ORBIT"
        public bool   isBoss;
        public bool   bossActive;
        public int    bossSecondsLeft;

        public string hpText;
        public float  hpFraction;        // 0..1

        public string stardustText;
        public string tapDamageText;
        public int    tapLevel;
        public string fleetDpsText;

        public string tapUpgradeCostText;
        public bool   canUpgradeTap;

        public bool   hasShip;
        public string shipButtonText;
        public bool   canBuyShip;

        public SkillVm[] skills;
        public bool      canPrestige;
        public string    prestigeText;

        public string      relicsText;
        public ArtifactVm[] artifacts;

        // Progressive disclosure (FTUE): hide systems until they become relevant.
        public bool showUpgradeTap;   // after first gold/kill
        public bool showFleet;        // first ship owned OR close to affordable
        public bool showArtifacts;    // relics exist or an artifact is owned
        public bool showPrestige;     // near/at the unlock stage, or relics exist
    }

    /// <summary>One skill button's display state.</summary>
    public struct SkillVm
    {
        public string label;
        public string description;
        public bool   unlocked;
        public bool   ready;
        public bool   active;
        public int    secondsLeft;   // active time left, or cooldown left
    }

    /// <summary>One artifact button's display state.</summary>
    public struct ArtifactVm
    {
        public string label;
        public string levelText;     // e.g. "Lv 3  +15%"
        public string costText;
        public bool   canBuy;
    }

    /// <summary>
    /// Maps a GameSession to a MainViewModel. The View calls Build() each frame and
    /// pushes values into Text/Image components. All numbers via BigNumber.ToShortString().
    /// </summary>
    public class MainPresenter
    {
        readonly GameSession _s;

        public MainPresenter(GameSession session) => _s = session;

        public MainViewModel Build()
        {
            var p  = _s.Enemy.Current;
            var vm = new MainViewModel
            {
                stardustText       = _s.Wallet.Stardust.ToShortString(),
                tapDamageText      = _s.TapUpgrade.CurrentDamage.ToShortString(),
                tapLevel           = _s.TapUpgrade.Level,
                fleetDpsText       = _s.Ships.FleetDps().ToShortString(),
                tapUpgradeCostText = _s.TapUpgrade.NextCost.ToShortString(),
                canUpgradeTap      = _s.Wallet.CanAfford(_s.TapUpgrade.NextCost),
                bossActive         = _s.Stage.BossActive,
                bossSecondsLeft    = (int)Math.Ceiling(_s.Stage.BossTimeLeft),
            };

            if (p != null)
            {
                vm.stageLabel = "Sector " + p.Stage;
                vm.zoneLabel  = ZoneName(p.Stage);
                vm.isBoss     = p.IsBoss;
                vm.hpText     = p.CurrentHP.ToShortString() + " / " + p.MaxHP.ToShortString();
                vm.hpFraction = (float)p.HpFraction01();
            }
            else
            {
                vm.stageLabel = "—";
                vm.zoneLabel  = "";
                vm.hpText     = "";
                vm.hpFraction = 0f;
            }

            var ships = _s.Ships;
            if (ships.Count > 0)
            {
                vm.hasShip = true;
                string state = ships.IsOwned(0) ? "Lv " + ships.LevelOf(0) : "Buy";
                vm.shipButtonText = ships.Def(0).shipName + "  " + state + "  (" + ships.NextCost(0).ToShortString() + ")";
                vm.canBuyShip = _s.Wallet.CanAfford(ships.NextCost(0));
            }
            else
            {
                vm.hasShip = false;
                vm.shipButtonText = "—";
                vm.canBuyShip = false;
            }

            var slots = _s.SkillSlots;
            var sk = new SkillVm[slots.Count];
            for (int i = 0; i < slots.Count; i++)
            {
                var t = slots[i];
                bool active = _s.Skills.IsActive(t);
                double secs = active ? _s.Skills.ActiveTimeLeft(t) : _s.Skills.Cooldown(t);
                sk[i] = new SkillVm
                {
                    label       = _s.Skills.Name(t),
                    description = _s.Skills.Description(t),
                    unlocked    = _s.Skills.IsUnlocked(t),
                    ready       = _s.Skills.CanActivate(t),
                    active      = active,
                    secondsLeft = (int)Math.Ceiling(secs),
                };
            }
            vm.skills       = sk;
            vm.canPrestige  = _s.CanPrestige();
            vm.prestigeText = "ASCEND  +" + _s.PreviewRelics().ToShortString();

            vm.relicsText = _s.Prestige.Relics.Stardust.ToShortString();
            var arts = _s.Artifacts;
            var av = new ArtifactVm[arts.Count];
            for (int i = 0; i < arts.Count; i++)
            {
                ArtifactDefinition d = arts.Def(i);
                int lvl = arts.LevelOf(i);
                int pct = (int)Math.Round(d.BonusAt(lvl) * 100.0);
                av[i] = new ArtifactVm
                {
                    label     = d.displayName,
                    levelText = "Lv " + lvl + "  +" + pct + "%",
                    costText  = arts.NextCost(i).ToShortString(),
                    canBuy    = _s.Prestige.Relics.CanAfford(arts.NextCost(i)),
                };
            }
            vm.artifacts = av;

            // ── Reveal rules (derived from state → stateless, survives save/load) ──
            bool progressed = _s.TapUpgrade.Level > 1
                           || _s.Stage.CurrentStage > 1 || _s.Stage.HighestStage > 1
                           || _s.Wallet.Stardust > Core.BigNumber.Zero;
            vm.showUpgradeTap = progressed;

            bool anyShipOwned = ships.Count > 0 && ships.FleetDps() > Core.BigNumber.Zero;
            bool shipClose    = ships.Count > 0 &&
                _s.Wallet.Stardust * new Core.BigNumber(2.0) >= ships.NextCost(0);   // ≥50% of first cost
            vm.showFleet = anyShipOwned || shipClose;

            bool anyArtifact = false;
            for (int i = 0; i < arts.Count; i++) if (arts.LevelOf(i) > 0) { anyArtifact = true; break; }
            bool hasRelics = _s.Prestige.Relics.Stardust > Core.BigNumber.Zero;
            vm.showArtifacts = hasRelics || anyArtifact;

            vm.showPrestige = vm.canPrestige || hasRelics
                           || _s.Stage.HighestStage >= _s.PrestigeUnlockStage - 2;
            return vm;
        }

        /// <summary>Display-only zone/biome name for a stage (mirrors the planet-variant bands).</summary>
        public static string ZoneName(int stage)
        {
            if (stage < 10)  return "OUTER ORBIT";
            if (stage < 25)  return "RED BELT";
            if (stage < 50)  return "BROKEN MOONS";
            if (stage < 100) return "VOID FRONTIER";
            return "STELLAR CORE";
        }
    }
}
