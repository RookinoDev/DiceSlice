using System.Collections.Generic;

namespace StellarBreaker.Monetization
{
    public enum BoostTarget { AllDamage, Gold, IdleReward }

    /// <summary>
    /// Temporary (timed, e.g. rewarded-ad) and permanent (e.g. IAP) stat multipliers.
    /// Multiplier(target) = permanent × ∏ active temporaries. Permanent survives prestige.
    /// </summary>
    public class BoostService
    {
        class Temp { public BoostTarget target; public double mult; public double remaining; }

        readonly Dictionary<BoostTarget, double> _permanent = new Dictionary<BoostTarget, double>();
        readonly List<Temp> _temporaries = new List<Temp>();

        public void AddTemporary(BoostTarget target, double multiplier, double seconds)
            => _temporaries.Add(new Temp { target = target, mult = multiplier, remaining = seconds });

        public void AddPermanent(BoostTarget target, double multiplier)
        {
            double cur = _permanent.TryGetValue(target, out var p) ? p : 1.0;
            _permanent[target] = cur * multiplier;
        }

        public double Multiplier(BoostTarget target)
        {
            double m = _permanent.TryGetValue(target, out var p) ? p : 1.0;
            foreach (var t in _temporaries)
                if (t.target == target && t.remaining > 0) m *= t.mult;
            return m;
        }

        public bool HasTemporary(BoostTarget target)
        {
            foreach (var t in _temporaries)
                if (t.target == target && t.remaining > 0) return true;
            return false;
        }

        public void Tick(double dt)
        {
            for (int i = _temporaries.Count - 1; i >= 0; i--)
            {
                _temporaries[i].remaining -= dt;
                if (_temporaries[i].remaining <= 0) _temporaries.RemoveAt(i);
            }
        }

        /// <summary>Prestige clears timed boosts but keeps permanent ones.</summary>
        public void OnPrestige() => _temporaries.Clear();
    }
}
