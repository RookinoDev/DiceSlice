using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace StellarBreaker.Persistence
{
    /// <summary>Abstracts where JSON is stored (file, memory, …).</summary>
    public interface ISaveStore
    {
        bool   Exists(string key);
        string Read(string key);
        void   Write(string key, string json);
        void   Delete(string key);
    }

    /// <summary>In-memory store for tests.</summary>
    public class InMemorySaveStore : ISaveStore
    {
        readonly Dictionary<string, string> _data = new Dictionary<string, string>();
        public bool   Exists(string key) => _data.ContainsKey(key);
        public string Read(string key)   => _data.TryGetValue(key, out var v) ? v : null;
        public void   Write(string key, string json) => _data[key] = json;
        public void   Delete(string key) => _data.Remove(key);
    }

    /// <summary>Persistent-data-path file store for the real game.</summary>
    public class FileSaveStore : ISaveStore
    {
        readonly string _dir;
        public FileSaveStore(string subDir = "StellarBreaker")
        {
            _dir = Path.Combine(Application.persistentDataPath, subDir);
            Directory.CreateDirectory(_dir);
        }
        string FilePath(string key) => Path.Combine(_dir, key + ".json");
        public bool   Exists(string key) => File.Exists(FilePath(key));
        public string Read(string key)   => File.Exists(FilePath(key)) ? File.ReadAllText(FilePath(key)) : null;
        public void   Write(string key, string json) => File.WriteAllText(FilePath(key), json);
        public void   Delete(string key) { if (File.Exists(FilePath(key))) File.Delete(FilePath(key)); }
    }

    /// <summary>Cloud-sync hook (no real implementation yet).</summary>
    public interface ICloudSync
    {
        bool   Available { get; }
        void   Push(string json);
        string Pull();
    }

    /// <summary>Serializes/deserializes SaveState through an ISaveStore.</summary>
    public class SaveService
    {
        public const string Key = "save";
        /// <summary>Current save schema version (bump when SaveState changes shape).</summary>
        public const int CurrentVersion = 1;

        readonly ISaveStore _store;
        readonly ICloudSync _cloud;   // optional

        public SaveService(ISaveStore store, ICloudSync cloud = null)
        {
            _store = store ?? throw new ArgumentNullException(nameof(store));
            _cloud = cloud;
        }

        public void Save(SaveState state)
        {
            state.version             = CurrentVersion;
            state.lastSaveUnixSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            string json = JsonUtility.ToJson(state);
            _store.Write(Key, json);
            if (_cloud != null && _cloud.Available) _cloud.Push(json);
        }

        /// <summary>
        /// Load the save. Returns false (and leaves the file intact) on a missing, empty,
        /// or MALFORMED save rather than throwing — a corrupt file must not crash startup.
        /// Missing fields fall back to SaveState defaults; newer versions load best-effort.
        /// </summary>
        public bool TryLoad(out SaveState state)
        {
            state = null;
            if (!_store.Exists(Key)) return false;
            string json = _store.Read(Key);
            if (string.IsNullOrEmpty(json)) return false;
            try
            {
                state = JsonUtility.FromJson<SaveState>(json);
            }
            catch (Exception e)
            {
                Debug.LogWarning("[SaveService] Ignoring corrupt save: " + e.Message);
                state = null;
                return false;
            }
            return state != null;
        }

        public void Delete() => _store.Delete(Key);
    }
}
