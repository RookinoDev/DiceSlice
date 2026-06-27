using StellarBreaker.Gameplay;

namespace StellarBreaker.UI
{
    /// <summary>Immutable snapshot the main-screen View renders (no Unity types → testable).</summary>
    public struct MainViewModel
    {
        public string stageLabel;
        public bool   isBoss;
        public string hpText;
        public float  hpFraction;        // 0..1
        public string stardustText;
        public string tapDamageText;
        public string fleetDpsText;
        public string tapUpgradeCostText;
        public bool   canUpgradeTap;
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
            var p = _s.Enemy.Current;
            var vm = new MainViewModel
            {
                stardustText       = _s.Wallet.Stardust.ToShortString(),
                tapDamageText      = _s.TapUpgrade.CurrentDamage.ToShortString(),
                fleetDpsText       = _s.Ships.FleetDps().ToShortString(),
                tapUpgradeCostText = _s.TapUpgrade.NextCost.ToShortString(),
                canUpgradeTap      = _s.Wallet.CanAfford(_s.TapUpgrade.NextCost),
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
            return vm;
        }
    }
}
