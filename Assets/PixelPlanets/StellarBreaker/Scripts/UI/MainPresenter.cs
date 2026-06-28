using System;
using StellarBreaker.Gameplay;

namespace StellarBreaker.UI
{
    /// <summary>Immutable snapshot the main-screen View renders (no Unity types → testable).</summary>
    public struct MainViewModel
    {
        public string stageLabel;
        public bool   isBoss;
        public bool   bossActive;
        public int    bossSecondsLeft;

        public string hpText;
        public float  hpFraction;        // 0..1

        public string stardustText;
        public string tapDamageText;
        public string fleetDpsText;

        public string tapUpgradeCostText;
        public bool   canUpgradeTap;

        public bool   hasShip;
        public string shipButtonText;
        public bool   canBuyShip;

        public SkillVm[] skills;
        public bool      canPrestige;
        public string    prestigeText;
    }

    /// <summary>One skill button's display state.</summary>
    public struct SkillVm
    {
        public string label;
        public bool   unlocked;
        public bool   ready;
        public bool   active;
        public int    secondsLeft;   // active time left, or cooldown left
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
                fleetDpsText       = _s.Ships.FleetDps().ToShortString(),
                tapUpgradeCostText = _s.TapUpgrade.NextCost.ToShortString(),
                canUpgradeTap      = _s.Wallet.CanAfford(_s.TapUpgrade.NextCost),
                bossActive         = _s.Stage.BossActive,
                bossSecondsLeft    = (int)Math.Ceiling(_s.Stage.BossTimeLeft),
            };

            if (p != null)
            {
                vm.stageLabel = "Stage " + p.Stage;
                vm.isBoss     = p.IsBoss;
                vm.hpText     = p.CurrentHP.ToShortString() + " / " + p.MaxHP.ToShortString();
                vm.hpFraction = (float)p.HpFraction01();
            }
            else
            {
                vm.stageLabel = "—";
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
                    unlocked    = _s.Skills.IsUnlocked(t),
                    ready       = _s.Skills.CanActivate(t),
                    active      = active,
                    secondsLeft = (int)Math.Ceiling(secs),
                };
            }
            vm.skills       = sk;
            vm.canPrestige  = _s.CanPrestige();
            vm.prestigeText = "PRESTIGE  +" + _s.PreviewRelics().ToShortString();
            return vm;
        }
    }
}
