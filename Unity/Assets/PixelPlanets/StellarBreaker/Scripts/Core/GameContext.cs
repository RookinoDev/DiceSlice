using System;
using System.Collections.Generic;

namespace StellarBreaker.Core
{
    /// <summary>
    /// Minimal service locator. Logic systems register here so Views/other
    /// systems can resolve them without hard scene references. Scene-independent.
    /// </summary>
    public static class GameContext
    {
        static readonly Dictionary<Type, object> _services = new Dictionary<Type, object>();

        public static void Register<T>(T service) where T : class
        {
            if (service == null) throw new ArgumentNullException(nameof(service));
            _services[typeof(T)] = service;
        }

        public static T Get<T>() where T : class
            => _services.TryGetValue(typeof(T), out var v) ? (T)v : null;

        public static bool TryGet<T>(out T service) where T : class
        {
            if (_services.TryGetValue(typeof(T), out var v)) { service = (T)v; return true; }
            service = null;
            return false;
        }

        public static bool Has<T>() where T : class => _services.ContainsKey(typeof(T));

        public static void Unregister<T>() where T : class => _services.Remove(typeof(T));

        public static void Clear() => _services.Clear();
    }
}
