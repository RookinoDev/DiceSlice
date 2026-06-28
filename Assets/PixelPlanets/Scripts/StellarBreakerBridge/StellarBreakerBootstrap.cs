using System;
using UnityEngine;
using UnityEngine.EventSystems;
using StellarBreaker.Core;
using StellarBreaker.Config;
using StellarBreaker.Gameplay;
using StellarBreaker.Economy;
using StellarBreaker.Persistence;

/// <summary>
/// One-drop integration for the clicker game on top of the existing PixelPlanetGenerator.
/// Add this component to the GameObject that has PixelPlanetGenerator. It:
///   • removes the dev-only UI (manual tweaker + "New Planet" button) at runtime,
///   • builds a headless GameSession (enemy + wallet + tap-damage upgrade),
///   • turns taps (mouse/touch, anywhere) into damage on the current planet,
///   • awards Stardust on kill and lets you buy tap-damage upgrades.
///
/// Does NOT modify PixelPlanetGenerator. The on-screen readout is a temporary dev HUD —
/// the real HUD + floating numbers come in the UI phase (this just proves the loop).
/// </summary>
[RequireComponent(typeof(PixelPlanetGenerator))]
public class StellarBreakerBootstrap : MonoBehaviour
{
    [Header("Balance (optional — a default is created if left empty)")]
    [SerializeField] private BalanceConfig balanceConfig;

    [Header("Setup")]
    [SerializeField] private bool removeDevUI  = true;
    [SerializeField] private bool tapAnywhere  = true;
    [SerializeField] private bool showDebugHud = false;   // real Canvas HUD is default now
    [SerializeField] private int  startStage   = 1;

    [Header("Debug / testing (runtime-only; does NOT touch the asset)")]
    [Tooltip("Divides enemy HP base (29 → 29/divisor). 1 = off.")]
    [SerializeField] private float testHpDivisor = 3f;
    [Tooltip("Divides the per-stage HP INCREASE (1.57 → 1 + 0.57/divisor). 1 = off.")]
    [SerializeField] private float testGrowthDivisor = 3f;

    [Header("Saving")]
    [SerializeField] private float autosaveSeconds = 15f;

    private PixelPlanetGenerator   _generator;
    private PlanetGeneratorAdapter _adapter;
    private GameSession            _session;
    private BalanceConfig          _cfg;
    private ClickerHud             _hud;
    private SaveService            _save;
    private float                  _saveAccum;
    private bool _cleaned;

    void Awake()
    {
        _generator = GetComponent<PixelPlanetGenerator>();

        // Prefer the assigned asset, else the one in Resources, else code defaults.
        var src = balanceConfig != null ? balanceConfig : Resources.Load<BalanceConfig>("BalanceConfig");
        // Use a runtime COPY so the debug overrides never mutate the source asset.
        _cfg = src != null ? Instantiate(src) : ScriptableObject.CreateInstance<BalanceConfig>();
        ApplyDebugScaling(_cfg);

        _adapter = _generator.GetComponent<PlanetGeneratorAdapter>();
        if (_adapter == null) _adapter = gameObject.AddComponent<PlanetGeneratorAdapter>();

        GameContext.Register(_cfg);
    }

    void Start()
    {
        var fleet = ShipCatalog.BuildDefault();   // TODO: real datasheet base costs
        _session = new GameSession(_adapter, _cfg, startStage, fleet);
        GameContext.Register(_session);

        // ── Load saved progress + offline earnings (before gameplay begins) ──
        _save = new SaveService(new FileSaveStore());
        BigNumber offline = BigNumber.Zero;
        if (_save.TryLoad(out var state))
        {
            SaveBinder.Apply(_session, state);          // currency, tap level, ships, stage
            offline = ComputeOffline(state);
            if (offline > BigNumber.Zero) _session.Wallet.Add(offline);
        }

        _session.Begin();

        _hud = GetComponent<ClickerHud>();
        if (_hud == null) _hud = gameObject.AddComponent<ClickerHud>();
        _hud.Bind(_session);

        if (offline > BigNumber.Zero)
        {
            string msg = "Offline earnings  +" + offline.ToShortString();
            _hud.ShowBanner(msg);
            Debug.Log("[StellarBreaker] " + msg);
        }
    }

    // currency/sec from idle DPS at the current stage, capped by config.
    BigNumber ComputeOffline(SaveState state)
    {
        long now  = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        long last = state.lastSaveUnixSeconds;
        if (last <= 0 || last > now) return BigNumber.Zero;   // basic timestamp sanity

        int stage = _session.Stage.CurrentStage;
        var income = OfflineIncome.PerSecond(
            _session.Ships.FleetDps(), _session.Stage.HpFor(stage), _session.Stage.GoldFor(stage));
        return OfflineEarnings.FromConfig(last, now, income, _cfg);
    }

    void SaveNow()
    {
        if (_session != null && _save != null) _save.Save(SaveBinder.Capture(_session));
    }

    void OnApplicationPause(bool paused) { if (paused) SaveNow(); }
    void OnApplicationQuit()             { SaveNow(); }

    void LateUpdate()
    {
        if (!_cleaned)
        {
            _cleaned = true;
            if (removeDevUI) RemoveDevUI();
        }
    }

    void Update()
    {
        if (_session == null) return;

        _session.Tick(Time.deltaTime);   // idle fleet DPS

        if (tapAnywhere && TapBegan() && !PointerOverUI())
            _session.Tap();

        if (Input.GetKeyDown(KeyCode.U))   // quick keyboard upgrade
            _session.UpgradeTapDamage();

        // periodic autosave
        if (autosaveSeconds > 0f)
        {
            _saveAccum += Time.deltaTime;
            if (_saveAccum >= autosaveSeconds) { _saveAccum = 0f; SaveNow(); }
        }
    }

    // Test-only difficulty scaling on the runtime config copy.
    void ApplyDebugScaling(BalanceConfig cfg)
    {
        if (testHpDivisor > 0f && testHpDivisor != 1f)
            cfg.enemyHpBase /= testHpDivisor;

        if (testGrowthDivisor > 0f && testGrowthDivisor != 1f)
            cfg.enemyHpGrowth = 1.0 + (cfg.enemyHpGrowth - 1.0) / testGrowthDivisor;
    }

    // ── Input ────────────────────────────────────────────────────────
    static bool TapBegan()
    {
        if (Input.GetMouseButtonDown(0)) return true;
        for (int i = 0; i < Input.touchCount; i++)
            if (Input.GetTouch(i).phase == TouchPhase.Began) return true;
        return false;
    }

    static bool PointerOverUI()
        => EventSystem.current != null && EventSystem.current.IsPointerOverGameObject();

    // ── Remove dev-only UI created by the generator ──────────────────
    void RemoveDevUI()
    {
        var tweaker = _generator.GetComponent<PlanetTweakerUI>();
        if (tweaker != null) Destroy(tweaker);

        var ui = GameObject.Find("PlanetUI");
        if (ui != null)
        {
            var btn = ui.transform.Find("RerollButton");
            if (btn != null) Destroy(btn.gameObject);
        }
    }

    // ── Temporary dev HUD (replace in the UI phase) ──────────────────
    void OnGUI()
    {
        if (!showDebugHud || _session?.Enemy.Current == null) return;

        var p      = _session.Enemy.Current;
        var label  = new GUIStyle(GUI.skin.label) { fontSize = 20, fontStyle = FontStyle.Bold };
        label.normal.textColor = Color.white;

        GUI.Label(new Rect(14, 12, 800, 28),
            $"STAGE {p.Stage}{(p.IsBoss ? "  (BOSS)" : "")}", label);
        GUI.Label(new Rect(14, 40, 800, 28),
            $"HP  {p.CurrentHP.ToShortString()} / {p.MaxHP.ToShortString()}", label);
        GUI.Label(new Rect(14, 68, 800, 28),
            $"Stardust  {_session.Wallet.Stardust.ToShortString()}", label);
        GUI.Label(new Rect(14, 96, 800, 28),
            $"Tap dmg  {_session.TapUpgrade.CurrentDamage.ToShortString()}  (Lv {_session.TapUpgrade.Level})", label);

        GUI.Label(new Rect(14, 124, 800, 28),
            $"Fleet DPS  {_session.Ships.FleetDps().ToShortString()}", label);

        var btn = new GUIStyle(GUI.skin.button) { fontSize = 16 };

        string tapCost = _session.TapUpgrade.NextCost.ToShortString();
        GUI.enabled = _session.Wallet.CanAfford(_session.TapUpgrade.NextCost);
        if (GUI.Button(new Rect(14, 156, 280, 40), $"Upgrade Tap  ({tapCost})", btn))
            _session.UpgradeTapDamage();
        GUI.enabled = true;

        // First few ships (a real ship list comes in the UI phase)
        int shown = Mathf.Min(5, _session.Ships.Count);
        for (int i = 0; i < shown; i++)
        {
            var s = _session.Ships;
            string verb = s.IsOwned(i) ? "Lv " + s.LevelOf(i) : "Buy";
            GUI.enabled = _session.Wallet.CanAfford(s.NextCost(i));
            if (GUI.Button(new Rect(14, 204 + i * 38, 300, 34),
                    $"{s.Def(i).shipName}  {verb}  ({s.NextCost(i).ToShortString()})", btn))
                _session.BuyShip(i);
            GUI.enabled = true;
        }
    }
}
