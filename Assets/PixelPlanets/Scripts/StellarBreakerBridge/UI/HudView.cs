using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using StellarBreaker.Core;
using StellarBreaker.Gameplay;
using StellarBreaker.UI;

namespace StellarBreaker.Hud
{
    /// <summary>
    /// Root of the runtime combat HUD (mobile portrait). Builds the always-on combat screen,
    /// owns feedback (floating numbers, hit punch, SFX, banner) and opens the modal panels.
    /// Reads state only through MainPresenter / GameSession public APIs — no game logic here.
    /// </summary>
    public class HudView : MonoBehaviour
    {
        GameSession   _s;
        IEnemyView    _enemy;
        MainPresenter _presenter;

        // top + combat
        Text _stage, _bossTimer, _gold, _relics, _hp, _info, _banner, _skillInfo;
        Image _hpFill;
        // actions
        Button _tapBtn, _prestigeBtn; Text _tapBtnLbl, _prestigeBtnLbl;
        Button _buyModeBtn; Text _buyModeLbl; bool _buyMax;
        Button[] _skillBtns; Text[] _skillLbls;
        // modals
        FleetPanel _fleet; ArtifactPanel _artifacts; PrestigePanel _prestige; OfflinePanel _offline; SettingsPanel _settings;
        // feedback
        Transform _floatRoot;
        readonly Queue<FloatingNumber> _floatPool = new Queue<FloatingNumber>();
        float _bannerT;

        Action<DamageEvent>       _onTap;
        Action<int, BigNumber>    _onShipHit;
        Action<string>            _onMessage;
        Action<Planet, BigNumber> _onReward;

        public void Bind(GameSession session, IEnemyView enemyView,
                         Action onResetSave, double offlineSeconds, BigNumber offlineGold)
        {
            _s = session;
            _enemy = enemyView;
            _presenter = new MainPresenter(session);

            if (transform.Find("HudCanvas") == null) Build(onResetSave);

            _onTap     = e => { OnHit(e.Amount); AudioManager.Instance?.Tap(); };
            _onShipHit = (i, d) => OnHit(d);
            _onMessage = ShowBanner;
            _onReward  = (p, g) => { SpawnFloating("+" + g.ToShortString(), UiTheme.Success, 185f); AudioManager.Instance?.Death(); };
            _s.Taps.OnDamageDealt += _onTap;
            _s.Ships.OnShipHit    += _onShipHit;
            _s.OnMessage          += _onMessage;
            _s.OnReward           += _onReward;

            if (offlineGold > BigNumber.Zero) _offline.Show(offlineSeconds, offlineGold);
        }

        void OnDestroy()
        {
            if (_s == null) return;
            _s.Taps.OnDamageDealt -= _onTap;
            _s.Ships.OnShipHit    -= _onShipHit;
            _s.OnMessage          -= _onMessage;
            _s.OnReward           -= _onReward;
        }

        // ── build ──
        void Build(Action onResetSave)
        {
            UiKit.EnsureEventSystem();
            var canvas = UiKit.Canvas(transform, "HudCanvas", 100).transform;

            // Top bar
            var gear = UiKit.Button(canvas, "Settings", new Vector2(1f, 1f), new Vector2(-72, -72), new Vector2(108, 108), out var gearLbl, 50);
            gearLbl.text = "⚙";
            gear.onClick.AddListener(() => { AudioManager.Instance?.Click(); _settings.RearmReset(); _settings.Open(); });

            // Buy-mode toggle (×1 / MAX) — applies to tap, ships and artifacts.
            _buyModeBtn = UiKit.Button(canvas, "BuyMode", new Vector2(0f, 1f), new Vector2(104, -72), new Vector2(176, 96), out _buyModeLbl, 30);
            _buyModeLbl.text = "BUY ×1";
            _buyModeBtn.onClick.AddListener(() =>
            {
                AudioManager.Instance?.Click();
                _buyMax = !_buyMax;
                _buyModeLbl.text = _buyMax ? "BUY MAX" : "BUY ×1";
            });

            _stage     = UiKit.Label(canvas, "Stage",  new Vector2(0.5f, 1f), new Vector2(0, -80),  new Vector2(820, 74), 48, TextAnchor.MiddleCenter);
            _bossTimer = UiKit.Label(canvas, "Boss",   new Vector2(0.5f, 1f), new Vector2(0, -152), new Vector2(820, 52), 34, TextAnchor.MiddleCenter, UiTheme.Boss);
            _gold      = UiKit.Label(canvas, "Gold",   new Vector2(0.5f, 1f), new Vector2(0, -238), new Vector2(900, 64), 46, TextAnchor.MiddleCenter, UiTheme.Gold);
            _relics    = UiKit.Label(canvas, "Relics", new Vector2(0.5f, 1f), new Vector2(0, -300), new Vector2(900, 46), 32, TextAnchor.MiddleCenter, UiTheme.Relic);

            // HP bar
            UiKit.Panel(canvas, "HpBg",   new Vector2(0.5f, 1f), new Vector2(0, -415), new Vector2(840, 54), UiTheme.BarBg);
            _hpFill = UiKit.Bar(canvas, "HpFill", new Vector2(0.5f, 1f), new Vector2(0, -415), new Vector2(840, 54), UiTheme.Hp);
            _hp = UiKit.Label(canvas, "HpText", new Vector2(0.5f, 1f), new Vector2(0, -415), new Vector2(840, 54), 30, TextAnchor.MiddleCenter);

            _floatRoot = UiKit.Rect(canvas, "Floaters", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(100, 100));
            _banner = UiKit.Label(canvas, "Banner", new Vector2(0.5f, 0.5f), new Vector2(0, 360), new Vector2(980, 72), 44, TextAnchor.MiddleCenter, UiTheme.Success);
            _banner.text = "";

            // Skill bar
            int n = _s.SkillSlots.Count;
            _skillBtns = new Button[n]; _skillLbls = new Text[n];
            float sp = 1000f / Mathf.Max(1, n);
            for (int i = 0; i < n; i++)
            {
                int idx = i;
                _skillBtns[i] = UiKit.Button(canvas, "Skill" + i, new Vector2(0.5f, 0f), new Vector2((i - (n - 1) / 2f) * sp, 560), new Vector2(sp - 14f, 104), out _skillLbls[i], 22);
                _skillBtns[i].onClick.AddListener(() =>
                {
                    if (idx < _s.SkillSlots.Count && _s.ActivateSkill(_s.SkillSlots[idx])) AudioManager.Instance?.Skill();
                });
            }

            // Skill details (shows the active skill's effect; blank when none active)
            _skillInfo = UiKit.Label(canvas, "SkillInfo", new Vector2(0.5f, 0f), new Vector2(0, 668), new Vector2(1000, 40), 24, TextAnchor.MiddleCenter, UiTheme.SubText);
            _skillInfo.text = "";

            // Action area
            _info = UiKit.Label(canvas, "Info", new Vector2(0.5f, 0f), new Vector2(0, 470), new Vector2(900, 44), 30, TextAnchor.MiddleCenter, UiTheme.SubText);

            _tapBtn = UiKit.Button(canvas, "UpgradeTap", new Vector2(0.5f, 0f), new Vector2(0, 335), new Vector2(840, 132), out _tapBtnLbl, 38, UiTheme.Primary);
            _tapBtn.onClick.AddListener(() => { AudioManager.Instance?.Click(); if (_buyMax) _s.UpgradeTapDamageMax(); else _s.UpgradeTapDamage(); });

            var fleetBtn = UiKit.Button(canvas, "FleetBtn", new Vector2(0.5f, 0f), new Vector2(-280, 188), new Vector2(260, 112), out var fLbl, 30);
            fLbl.text = "FLEET";
            fleetBtn.onClick.AddListener(() => { AudioManager.Instance?.Click(); _fleet.Toggle(); });

            var artBtn = UiKit.Button(canvas, "ArtBtn", new Vector2(0.5f, 0f), new Vector2(0, 188), new Vector2(260, 112), out var aLbl, 28);
            aLbl.text = "ARTIFACTS";
            artBtn.onClick.AddListener(() => { AudioManager.Instance?.Click(); _artifacts.Toggle(); });

            _prestigeBtn = UiKit.Button(canvas, "AscendBtn", new Vector2(0.5f, 0f), new Vector2(280, 188), new Vector2(260, 112), out _prestigeBtnLbl, 28);
            _prestigeBtnLbl.text = "ASCEND";
            _prestigeBtn.onClick.AddListener(() => { AudioManager.Instance?.Click(); _prestige.Open(); });

            // Modals
            _fleet     = new FleetPanel(canvas, _s, () => _buyMax);
            _artifacts = new ArtifactPanel(canvas, _s, () => _buyMax);
            _prestige  = new PrestigePanel(canvas, _s) { OnPrestiged = g => ShowBanner("Stellar Ascension!  +" + g.ToShortString() + " relics") };
            _offline   = new OfflinePanel(canvas);
            _settings  = new SettingsPanel(canvas, onResetSave, Application.version);
        }

        // ── per-frame refresh ──
        void Update()
        {
            if (_presenter == null || _stage == null) return;
            var vm = _presenter.Build();

            _stage.text     = vm.stageLabel.ToUpperInvariant() + (vm.isBoss ? "   ★ BOSS" : "");
            if (vm.bossActive)
            {
                _bossTimer.text  = "⏱  " + vm.bossSecondsLeft + "s";
                _bossTimer.color = UiTheme.Boss;
            }
            else
            {
                _bossTimer.text  = vm.zoneLabel;          // reuse the slot to show the sector zone
                _bossTimer.color = UiTheme.SubText;
            }
            _gold.text      = "✦ " + vm.stardustText;
            _relics.gameObject.SetActive(vm.canPrestige || vm.relicsText != "0");
            _relics.text    = "◆ " + vm.relicsText;

            _hp.text = vm.hpText;
            _hpFill.fillAmount = vm.hpFraction;

            _info.text = "Tap Cannon  " + vm.tapDamageText + "    •    Fleet DPS  " + vm.fleetDpsText;
            _tapBtnLbl.text = "UPGRADE CANNON   Lv " + vm.tapLevel + "\n(" + vm.tapUpgradeCostText + ")";
            _tapBtn.interactable = vm.canUpgradeTap;

            _prestigeBtnLbl.text = vm.canPrestige ? "ASCEND\n+" + _s.PreviewRelics().ToShortString() : "ASCEND";
            _prestigeBtn.interactable = vm.canPrestige;

            string activeSkillInfo = "";
            if (vm.skills != null)
                for (int i = 0; i < _skillBtns.Length && i < vm.skills.Length; i++)
                {
                    var sv = vm.skills[i];
                    _skillLbls[i].text = !sv.unlocked ? sv.label + "\nLOCK"
                                       : sv.active   ? sv.label + "\n" + sv.secondsLeft + "s"
                                       : sv.ready    ? sv.label + "\nREADY"
                                                     : sv.label + "\n" + sv.secondsLeft + "s";
                    _skillLbls[i].color = !sv.unlocked ? UiTheme.SubText   // locked  → dim
                                        : sv.active   ? UiTheme.Boss      // active  → gold
                                        : sv.ready    ? UiTheme.Success   // ready   → green
                                                      : UiTheme.SubText;  // cooldown→ dim
                    _skillBtns[i].interactable = sv.ready;
                    if (sv.active && activeSkillInfo == "") activeSkillInfo = sv.description;
                }
            _skillInfo.text = activeSkillInfo;

            _fleet.Refresh();
            _artifacts.Refresh();
            _prestige.Refresh();

            if (_bannerT > 0f)
            {
                _bannerT -= Time.deltaTime;
                var c = _banner.color; c.a = Mathf.Clamp01(_bannerT); _banner.color = c;
                if (_bannerT <= 0f) _banner.text = "";
            }
        }

        public void ShowBanner(string text)
        {
            if (_banner == null) return;
            _banner.text = text;
            var c = _banner.color; c.a = 1f; _banner.color = c;
            _bannerT = 4f;
        }

        // ── feedback ──
        void OnHit(BigNumber dmg)
        {
            _enemy?.Punch();
            SpawnFloating(dmg.ToShortString(), new Color(1f, 0.95f, 0.6f), 110f);
        }

        void SpawnFloating(string text, Color color, float yBase)
        {
            if (_floatRoot == null) return;
            var f = _floatPool.Count > 0 ? _floatPool.Dequeue() : CreateFloater();
            f.Play(new Vector2(UnityEngine.Random.Range(-150f, 150f), yBase), text, color);
        }

        FloatingNumber CreateFloater()
        {
            var t = UiKit.Label(_floatRoot, "Float", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(420, 80), 46, TextAnchor.MiddleCenter);
            var f = t.gameObject.AddComponent<FloatingNumber>();
            f.OnDone = fn => _floatPool.Enqueue(fn);
            return f;
        }
    }
}
