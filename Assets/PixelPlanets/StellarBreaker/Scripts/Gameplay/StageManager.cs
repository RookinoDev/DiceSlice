using System;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Economy;

namespace StellarBreaker.Gameplay
{
    /// <summary>
    /// Authoritative progression: current stage, boss detection (every Nth stage),
    /// the [2,4,6,7,10] multiplier cycle, boss HP/gold, and the boss timer gate.
    ///
    /// Assumptions (datasheet didn't specify): a boss occurs every `bossStageInterval`
    /// stages; the multiplier cycles through bossMultipliers per successive boss; a boss
    /// fail keeps you on the boss stage (retryable) rather than dropping a stage.
    /// </summary>
    public class StageManager
    {
        readonly BalanceConfig _cfg;

        public int    CurrentStage { get; private set; }
        public int    HighestStage { get; private set; }
        public bool   BossActive   { get; private set; }
        public double BossTimeLeft { get; private set; }

        public event Action<int> OnStageEntered;
        public event Action<int> OnBossStarted;
        public event Action<int> OnBossCleared;
        public event Action<int> OnBossFailed;

        public StageManager(BalanceConfig cfg, int startStage = 1)
        {
            _cfg         = cfg ?? throw new ArgumentNullException(nameof(cfg));
            CurrentStage = Math.Max(1, startStage);
            HighestStage = CurrentStage;
        }

        public bool IsBossStage(int stage)
            => _cfg.bossStageInterval > 0 && stage % _cfg.bossStageInterval == 0;

        public bool CurrentIsBoss => IsBossStage(CurrentStage);

        public int BossMultiplier(int stage)
        {
            var m = _cfg.bossMultipliers;
            if (!IsBossStage(stage) || m == null || m.Length == 0) return 1;
            int idx = (stage / _cfg.bossStageInterval) - 1;       // 0-based boss index
            idx = ((idx % m.Length) + m.Length) % m.Length;
            return m[idx];
        }

        public BigNumber HpFor(int stage)
        {
            var hp = EnemyHp.ForStage(stage, _cfg.enemyHpBase, _cfg.enemyHpGrowth);
            if (IsBossStage(stage)) hp = hp * new BigNumber(BossMultiplier(stage));
            return hp;
        }

        public BigNumber GoldFor(int stage)
        {
            var g = GoldReward.ForStage(stage, _cfg.goldBase, _cfg.goldGrowth);
            if (IsBossStage(stage)) g = g * new BigNumber(_cfg.bossGoldMultiplier);
            return g;
        }

        /// <summary>Activate the current stage (starts the boss timer if it's a boss).</summary>
        public void Begin() => EnterStage(CurrentStage);

        void EnterStage(int stage)
        {
            CurrentStage = stage;
            if (stage > HighestStage) HighestStage = stage;
            OnStageEntered?.Invoke(stage);

            if (IsBossStage(stage))
            {
                BossActive   = true;
                BossTimeLeft = _cfg.bossTimerSeconds;
                OnBossStarted?.Invoke(stage);
            }
            else
            {
                BossActive   = false;
                BossTimeLeft = 0;
            }
        }

        /// <summary>The active planet was destroyed. Clears a boss (advance) or advances normally.</summary>
        public void NotifyPlanetKilled()
        {
            if (IsBossStage(CurrentStage))
            {
                if (!BossActive) return;                 // failed boss must be retried first
                BossActive = false;
                OnBossCleared?.Invoke(CurrentStage);
            }
            EnterStage(CurrentStage + 1);
        }

        /// <summary>Advance the boss timer. On expiry the boss fails and you keep the stage.</summary>
        public void Tick(double deltaSeconds)
        {
            if (!BossActive) return;
            BossTimeLeft -= deltaSeconds;
            if (BossTimeLeft <= 0)
            {
                BossTimeLeft = 0;
                BossActive   = false;
                OnBossFailed?.Invoke(CurrentStage);      // stays on stage
            }
        }

        /// <summary>Re-arm the boss timer after a failure to attempt again.</summary>
        public void RetryBoss()
        {
            if (IsBossStage(CurrentStage) && !BossActive)
            {
                BossActive   = true;
                BossTimeLeft = _cfg.bossTimerSeconds;
                OnBossStarted?.Invoke(CurrentStage);
            }
        }

        /// <summary>Reset to stage 1 (used by prestige). Keeps HighestStage.</summary>
        public void ResetToStart()
        {
            CurrentStage = 1;
            BossActive   = false;
            BossTimeLeft = 0;
        }

        /// <summary>Full reset for prestige: back to stage 1 and clear HighestStage (run-based).</summary>
        public void ResetForPrestige()
        {
            CurrentStage = 1;
            HighestStage = 1;
            BossActive   = false;
            BossTimeLeft = 0;
        }

        /// <summary>Restore progress from a save (call before Begin). Boss restarts cleanly.</summary>
        public void RestoreProgress(int current, int highest)
        {
            CurrentStage = Math.Max(1, current);
            HighestStage = Math.Max(CurrentStage, Math.Max(1, highest));
            BossActive   = false;
            BossTimeLeft = 0;
        }
    }
}
