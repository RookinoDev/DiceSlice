using System;
using System.Collections.Generic;
using StellarBreaker.Core;
using StellarBreaker.Config;

namespace StellarBreaker.Gameplay
{
    /// <summary>
    /// Unlocks skills by player level, activates them (timed buff or instant Meteor),
    /// tracks duration + cooldown, and exposes aggregate combat modifiers.
    /// Scene-independent; player level is supplied by a delegate.
    /// </summary>
    public class SkillService
    {
        class State { public int level = 1; public double active; public double cooldown; }

        readonly Dictionary<SkillType, SkillDefinition> _defs = new Dictionary<SkillType, SkillDefinition>();
        readonly Dictionary<SkillType, State>           _state = new Dictionary<SkillType, State>();
        readonly Func<int> _playerLevel;

        double _cooldownReduction;   // 0..1

        public event Action<SkillType> OnActivated;
        public event Action<SkillType> OnExpired;

        public SkillService(IEnumerable<SkillDefinition> defs, Func<int> playerLevel)
        {
            _playerLevel = playerLevel ?? throw new ArgumentNullException(nameof(playerLevel));
            foreach (var d in defs)
            {
                _defs[d.type]  = d;
                _state[d.type] = new State();
            }
        }

        public string Name(SkillType t)     => _defs[t].displayName;
        public int  Level(SkillType t)      => _state[t].level;
        public void SetLevel(SkillType t, int level) => _state[t].level = Math.Max(1, level);
        public bool IsUnlocked(SkillType t) => _playerLevel() >= _defs[t].unlockLevel;
        public bool IsActive(SkillType t)   => _state[t].active > 0;
        public double Cooldown(SkillType t) => _state[t].cooldown;
        public double ActiveTimeLeft(SkillType t) => _state[t].active;

        public bool CanActivate(SkillType t)
        {
            var s = _state[t];
            if (!IsUnlocked(t) || s.cooldown > 0) return false;
            if (!_defs[t].isInstant && s.active > 0) return false;
            return true;
        }

        public void SetCooldownReduction(double fraction)
            => _cooldownReduction = fraction < 0 ? 0 : (fraction > 0.9 ? 0.9 : fraction);

        /// <summary>Raw effect value: a×lvl + b (NOT used for Meteor's instant damage).</summary>
        public double EffectValue(SkillType t)
        {
            var d = _defs[t]; int lvl = _state[t].level;
            return d.coeffPerLevel * lvl + d.coeffBase;
        }

        /// <summary>Activate a skill. Returns Meteor's instant damage (Zero for others).</summary>
        public BigNumber Activate(SkillType t, BigNumber tapDamage)
        {
            if (!CanActivate(t)) return BigNumber.Zero;
            var d = _defs[t]; var s = _state[t];
            s.cooldown = d.cooldown * (1.0 - _cooldownReduction);
            OnActivated?.Invoke(t);

            if (d.isInstant)
            {
                // Meteor Strike: 70×(1+lvl)×tapDamage
                if (t == SkillType.MeteorStrike)
                    return new BigNumber(d.coeffPerLevel * (1 + s.level)) * tapDamage;
                return BigNumber.Zero;
            }

            s.active = d.duration;
            return BigNumber.Zero;
        }

        public void Tick(double dt)
        {
            foreach (var kv in _state)
            {
                var s = kv.Value;
                if (s.cooldown > 0) s.cooldown = Math.Max(0, s.cooldown - dt);
                if (s.active > 0)
                {
                    s.active -= dt;
                    if (s.active <= 0) { s.active = 0; OnExpired?.Invoke(kv.Key); }
                }
            }
        }

        // ── Aggregate modifiers (only while the relevant skill is active) ──
        public BigNumber DpsMultiplier()
            => new BigNumber(1.0 + (IsActive(SkillType.BattleCry) ? EffectValue(SkillType.BattleCry) / 100.0 : 0));

        public BigNumber TapDamageMultiplier()
            => new BigNumber(1.0 + (IsActive(SkillType.Overdrive) ? EffectValue(SkillType.Overdrive) / 100.0 : 0));

        public BigNumber GoldMultiplier()
            => new BigNumber(1.0 + (IsActive(SkillType.MidasBeam) ? EffectValue(SkillType.MidasBeam) / 100.0 : 0));

        /// <summary>Extra crit chance in percentage points (0 when inactive).</summary>
        public double CritChanceBonusPercent()
            => IsActive(SkillType.TargetingSystem) ? EffectValue(SkillType.TargetingSystem) : 0;

        /// <summary>Drone auto-taps per second (0 when inactive).</summary>
        public double DroneTapsPerSecond()
            => IsActive(SkillType.DroneSwarm) ? EffectValue(SkillType.DroneSwarm) : 0;
    }
}
