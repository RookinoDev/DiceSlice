using System;
using System.Collections.Generic;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;

namespace StellarBreaker.Gameplay
{
    /// <summary>
    /// Fixed one-shot quest list (no rotation/re-roll in this pass). Tracks a running BigNumber
    /// counter per mission (planets destroyed / cumulative tap damage / ship upgrades bought),
    /// and lets the UI claim a Gold reward once the target is reached. Claimed missions stay
    /// claimed forever (persisted).
    /// </summary>
    public class MissionService
    {
        readonly IReadOnlyList<MissionDefinition> _defs;
        readonly CurrencyService _wallet;
        readonly BigNumber[] _progress;
        readonly bool[]      _claimed;

        /// <summary>(missionIndex) fired when a mission's progress changes.</summary>
        public event Action<int> OnProgressChanged;
        /// <summary>(missionIndex, goldPaid) fired when a mission is claimed.</summary>
        public event Action<int, BigNumber> OnClaimed;

        public MissionService(IReadOnlyList<MissionDefinition> defs, CurrencyService wallet)
        {
            _defs   = defs   ?? throw new ArgumentNullException(nameof(defs));
            _wallet = wallet ?? throw new ArgumentNullException(nameof(wallet));
            _progress = new BigNumber[_defs.Count];
            _claimed  = new bool[_defs.Count];
            for (int i = 0; i < _progress.Length; i++) _progress[i] = BigNumber.Zero;
        }

        public int Count => _defs.Count;
        public MissionDefinition Def(int i) => _defs[i];
        public BigNumber Progress(int i)    => _progress[i];
        public bool IsClaimed(int i)        => _claimed[i];
        public bool IsComplete(int i)       => _progress[i] >= new BigNumber(_defs[i].target);

        /// <summary>0..1, clamped — for progress bars.</summary>
        public float Progress01(int i)
        {
            double target = Math.Max(1e-9, _defs[i].target);
            double frac = _progress[i].ToDouble() / target;
            return (float)Math.Min(1.0, Math.Max(0.0, frac));
        }

        public bool Claim(int i)
        {
            if (i < 0 || i >= _defs.Count) return false;
            if (_claimed[i] || !IsComplete(i)) return false;
            _claimed[i] = true;
            var reward = new BigNumber(_defs[i].goldReward);
            _wallet.Add(reward);
            OnClaimed?.Invoke(i, reward);
            return true;
        }

        // ── event hooks (wired by GameSession) ──
        public void NotifyPlanetDestroyed()    => AddProgress(MissionType.DestroyPlanets, BigNumber.One);
        public void NotifyTapDamage(BigNumber dmg) => AddProgress(MissionType.TapDamageTotal, dmg);
        public void NotifyShipUpgraded()       => AddProgress(MissionType.ShipUpgrades, BigNumber.One);

        void AddProgress(MissionType type, BigNumber amount)
        {
            for (int i = 0; i < _defs.Count; i++)
            {
                if (_defs[i].type != type || _claimed[i]) continue;
                _progress[i] = _progress[i] + amount;
                OnProgressChanged?.Invoke(i);
            }
        }

        // ── save/load ──
        public BigNumberData[] CaptureProgress()
        {
            var arr = new BigNumberData[_progress.Length];
            for (int i = 0; i < arr.Length; i++) arr[i] = BigNumberData.From(_progress[i]);
            return arr;
        }

        public bool[] CaptureClaimed() => (bool[])_claimed.Clone();

        public void RestoreProgress(BigNumberData[] progress, bool[] claimed)
        {
            if (progress != null)
            {
                int n = Math.Min(progress.Length, _progress.Length);
                for (int i = 0; i < n; i++) _progress[i] = progress[i].To();
            }
            if (claimed != null)
            {
                int n = Math.Min(claimed.Length, _claimed.Length);
                for (int i = 0; i < n; i++) _claimed[i] = claimed[i];
            }
        }
    }
}
