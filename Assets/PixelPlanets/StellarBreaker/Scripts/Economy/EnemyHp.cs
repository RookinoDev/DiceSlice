using StellarBreaker.Core;

namespace StellarBreaker.Economy
{
    /// <summary>
    /// Parametric enemy HP curve. HP(stage) = base × growth^(stage-1).
    /// Boss HP = enemy HP × multiplier (cycle handled by caller).
    /// (Full curve service comes in Phase 3; this is the minimal parametric form Phase 2 needs.)
    /// </summary>
    public static class EnemyHp
    {
        public static BigNumber ForStage(int stage, double baseHp, double growth)
        {
            int steps = stage - 1;
            if (steps <= 0) return new BigNumber(baseHp);
            return new BigNumber(baseHp) * new BigNumber(growth).Pow(steps);
        }

        public static BigNumber BossForStage(int stage, double baseHp, double growth, int multiplier)
            => ForStage(stage, baseHp, growth) * new BigNumber(multiplier);
    }
}
