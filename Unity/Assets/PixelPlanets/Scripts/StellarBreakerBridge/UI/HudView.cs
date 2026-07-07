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
        Button _tapBtn, _prestigeBtn, _fleetBtn, _artBtn; Text _tapBtnLbl, _prestigeBtnLbl;
        Button _buyModeBtn; Text _buyModeLbl; bool _buyMax;
        Button[] _skillBtns; Text[] _skillLbls;
        // FTUE progressive disclosure
        Text _callout;
        bool _tapUpShown, _fleetShown, _artShown, _prestigeShown;
        bool _introCallout, _tappedOnce;
        // modals
        FleetPanel _fleet; ArtifactPanel _artifacts; PrestigePanel _prestige; OfflinePanel _offline; SettingsPanel _settings;
        DailyPanel _daily; Button _dailyBtn; Text _dailyBtnLbl;
        // feedback
        Transform _floatRoot;
        readonly Queue<FloatingNumber> _floatPool = new Queue<FloatingNumber>();
        float _bannerT;
        Image _flash;
        float _flashT, _flashDuration;

        // Boss timer urgency (below this many seconds the timer pulses + beeps)
        const int BossUrgentSeconds = 10;
        int _lastBeepSecond = -1;

        Action<DamageEvent>       _onTap;
        Action<int, BigNumber>    _onShipHit;
        Action<string>            _onMessage;
        Action<Planet, BigNumber> _onReward;
        Action<BigNumber>         _onSkillDamage;
        Action<int>               _onBossStarted;

        /// <summary>Feedback-only categorization — purely presentational, no gameplay meaning.</summary>
        enum FeedbackKind { Tap, Fleet, Skill }

        public void Bind(GameSession session, IEnemyView enemyView,
                         Action onResetSave, double offlineSeconds, BigNumber offlineGold)
        {
            _s = session;
            _enemy = enemyView;
            _presenter = new MainPresenter(session);

            if (transform.Find("HudCanvas") == null) Build(onResetSave);

            // First-tap callout only for a truly fresh player (no progress, no save history)
            _introCallout = _s.TapUpgrade.Level == 1 && _s.Stage.HighestStage <= 1
                         && !(_s.Wallet.Stardust > BigNumber.Zero);

            _onTap         = e => { _tappedOnce = true; OnHit(e.Amount, FeedbackKind.Tap); AudioManager.Instance?.Tap(); };
            _onShipHit     = (i, d) => OnHit(d, FeedbackKind.Fleet);
            _onSkillDamage = d => OnHit(d, FeedbackKind.Skill);
            // OnMessage is currently boss-fail-only; pair it with a distinct SFX + confirm
            // via console-style banner that the player already sees which stage they landed on
            // (the message text itself names the farm stage — see GameSession.HandleBossFailed).
            _onMessage = msg => { ShowBanner(msg); AudioManager.Instance?.BossFail(); };

            _onBossStarted = stage =>
            {
                ShowBanner("☠ BOSS ENCOUNTER — SECTOR " + stage);
                AudioManager.Instance?.BossStart();
                _lastBeepSecond = -1;
            };

            _onReward = (p, g) =>
            {
                // Kill ceremony: burst on the (still-visible) dying target, stronger gold
                // popup, small screen shake, boom SFX. The new target's pop-in + explosion
                // overlap, reading as "shatter → pause → next target" without any real delay.
                // Boss kills get a bigger version of the same ceremony — the only tension
                // beat in the game should pay off harder than a normal kill.
                bool bossKill = p.IsBoss;
                _enemy?.Explode();
                float popScale = bossKill ? 2.2f : 1.7f;
                float popY     = bossKill ? 230f : 200f;
                string popText = "+" + g.ToShortString();
                if (bossKill)
                {
                    // Communicate the harder-boss-pays-more bonus right on the popup itself.
                    double mult = _s.Stage.BossRewardMultiplier(p.Stage);
                    popText += "  (×" + mult.ToString("0.0") + " BOSS BONUS)";
                }
                SpawnFloating(popText, UiTheme.Success, popY, popScale, 0.9f, 200f);
                CameraShake.Shake(bossKill ? 0.32f : 0.18f, bossKill ? 0.11f : 0.06f);

                if (bossKill) { ShowBanner("★ BOSS DEFEATED ★"); AudioManager.Instance?.BossDown(); }
                else          AudioManager.Instance?.Explosion();
            };
            _s.Taps.OnDamageDealt   += _onTap;
            _s.Ships.OnShipHit      += _onShipHit;
            _s.OnSkillDamage        += _onSkillDamage;
            _s.OnMessage            += _onMessage;
            _s.OnReward             += _onReward;
            _s.Stage.OnBossStarted  += _onBossStarted;

            if (offlineGold > BigNumber.Zero)
            {
                _offline.Show(offlineSeconds, offlineGold);
            }
            else
            {
                // Only auto-pop the daily reward when we didn't already pop the offline
                // reward this session — avoids stacking two full-screen modals on launch.
                long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                if (_s.Daily.CanClaim(now)) _daily.Open();
            }
        }

        void OnDestroy()
        {
            if (_s == null) return;
            _s.Taps.OnDamageDealt   -= _onTap;
            _s.Ships.OnShipHit      -= _onShipHit;
            _s.OnSkillDamage        -= _onSkillDamage;
            _s.OnMessage            -= _onMessage;
            _s.OnReward             -= _onReward;
            _s.Stage.OnBossStarted  -= _onBossStarted;
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

            _dailyBtn = UiKit.Button(canvas, "DailyBtn", new Vector2(1f, 1f), new Vector2(-192, -72), new Vector2(108, 108), out _dailyBtnLbl, 44);
            _dailyBtn.onClick.AddListener(() => { AudioManager.Instance?.Click(); _daily.Open(); });

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

            // FTUE callout (pulsing guidance under the planet)
            _callout = UiKit.Label(canvas, "Callout", new Vector2(0.5f, 0.5f), new Vector2(0, -330), new Vector2(980, 70), 42, TextAnchor.MiddleCenter, UiTheme.Boss);
            _callout.text = "";

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

            _fleetBtn = UiKit.Button(canvas, "FleetBtn", new Vector2(0.5f, 0f), new Vector2(-280, 188), new Vector2(260, 112), out var fLbl, 30);
            fLbl.text = "FLEET";
            _fleetBtn.onClick.AddListener(() => { AudioManager.Instance?.Click(); _fleet.Toggle(); });

            _artBtn = UiKit.Button(canvas, "ArtBtn", new Vector2(0.5f, 0f), new Vector2(0, 188), new Vector2(260, 112), out var aLbl, 28);
            aLbl.text = "ARTIFACTS";
            _artBtn.onClick.AddListener(() => { AudioManager.Instance?.Click(); _artifacts.Toggle(); });

            _prestigeBtn = UiKit.Button(canvas, "AscendBtn", new Vector2(0.5f, 0f), new Vector2(280, 188), new Vector2(260, 112), out _prestigeBtnLbl, 28);
            _prestigeBtnLbl.text = "ASCEND";
            _prestigeBtn.onClick.AddListener(() => { AudioManager.Instance?.Click(); _prestige.Open(); });

            // Progressive disclosure: everything non-essential starts hidden.
            _buyModeBtn.gameObject.SetActive(false);
            _tapBtn.gameObject.SetActive(false);
            _fleetBtn.gameObject.SetActive(false);
            _artBtn.gameObject.SetActive(false);
            _prestigeBtn.gameObject.SetActive(false);
            for (int i = 0; i < _skillBtns.Length; i++) _skillBtns[i].gameObject.SetActive(false);

            // Modals
            _fleet     = new FleetPanel(canvas, _s, () => _buyMax);
            _artifacts = new ArtifactPanel(canvas, _s, () => _buyMax);
            _prestige  = new PrestigePanel(canvas, _s) { OnPrestiged = OnPrestigeCelebration };
            _offline   = new OfflinePanel(canvas);
            _daily     = new DailyPanel(canvas, _s)
            {
                OnClaimed = result =>
                {
                    string txt = "Daily Day " + result.day + "  +" + result.gold.ToShortString() + " Stardust"
                               + (result.relic ? "  +1 Relic" : "");
                    ShowBanner(txt);
                    SpawnFloating("+" + result.gold.ToShortString(), UiTheme.Success, 200f, 1.6f, 0.9f, 200f);
                    AudioManager.Instance?.Prestige();
                }
            };
            _settings  = new SettingsPanel(canvas, onResetSave, Application.version);

            // Full-screen flash overlay for big moments (prestige). Never blocks input.
            _flash = UiKit.FullStretch(canvas, "Flash", new Color(1f, 1f, 1f, 0f));
            _flash.raycastTarget = false;
            _flash.transform.SetAsLastSibling();
        }

        // Prestige celebration: banner + relic popup + screen flash + shake. Sound is already
        // played by PrestigePanel's confirm handler (AudioManager.Prestige()).
        void OnPrestigeCelebration(BigNumber relicsGained)
        {
            ShowBanner("★ PERMANENT POWER INCREASED ★  +" + relicsGained.ToShortString() + " relics");
            SpawnFloating("+" + relicsGained.ToShortString() + " ◆", UiTheme.Relic, 250f, 2.0f, 1.2f, 220f);
            Flash(UiTheme.Relic, 0.28f);
            CameraShake.Shake(0.22f, 0.08f);
        }

        void Flash(Color color, float duration)
        {
            if (_flash == null) return;
            _flashDuration = Mathf.Max(0.01f, duration);
            _flashT = _flashDuration;
            var c = color; c.a = 0.55f;
            _flash.color = c;
        }

        // ── per-frame refresh ──
        void Update()
        {
            if (_presenter == null || _stage == null) return;
            var vm = _presenter.Build();

            _stage.text     = vm.stageLabel.ToUpperInvariant() + (vm.isBoss ? "   ★ BOSS" : "");
            if (vm.bossActive)
            {
                bool urgent = vm.bossSecondsLeft <= BossUrgentSeconds;
                _bossTimer.text = "⏱  " + vm.bossSecondsLeft + "s";

                if (urgent)
                {
                    // Pulse color + scale below the threshold; beep once per second (not every
                    // frame) so it reads as urgency, not noise.
                    float pulse = 0.5f + 0.5f * Mathf.Sin(Time.time * 10f);
                    _bossTimer.color = Color.Lerp(UiTheme.Boss, new Color(1f, 0.15f, 0.15f), 0.6f + 0.4f * pulse);
                    _bossTimer.transform.localScale = Vector3.one * (1f + 0.15f * pulse);

                    if (vm.bossSecondsLeft != _lastBeepSecond && vm.bossSecondsLeft >= 1)
                    {
                        _lastBeepSecond = vm.bossSecondsLeft;
                        AudioManager.Instance?.BossTick();
                    }
                }
                else
                {
                    _bossTimer.color = UiTheme.Boss;
                    _bossTimer.transform.localScale = Vector3.one;
                    _lastBeepSecond = -1;
                }
            }
            else
            {
                _bossTimer.text  = vm.zoneLabel;          // reuse the slot to show the sector zone
                _bossTimer.color = UiTheme.SubText;
                _bossTimer.transform.localScale = Vector3.one;
                _lastBeepSecond = -1;
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

            // ── Progressive disclosure (sticky within a session) ──
            if (!_tapUpShown   && vm.showUpgradeTap) { _tapUpShown   = true; _tapBtn.gameObject.SetActive(true); _buyModeBtn.gameObject.SetActive(true); }
            if (!_fleetShown   && vm.showFleet)      { _fleetShown   = true; _fleetBtn.gameObject.SetActive(true);   ShowBanner("Fleet available — hire your first ship"); }
            if (!_artShown     && vm.showArtifacts)  { _artShown     = true; _artBtn.gameObject.SetActive(true); }
            if (!_prestigeShown&& vm.showPrestige)   { _prestigeShown= true; _prestigeBtn.gameObject.SetActive(true); }

            string activeSkillInfo = "";
            if (vm.skills != null)
                for (int i = 0; i < _skillBtns.Length && i < vm.skills.Length; i++)
                {
                    var sv = vm.skills[i];
                    // locked skills are hidden, not shown dim
                    if (_skillBtns[i].gameObject.activeSelf != sv.unlocked)
                        _skillBtns[i].gameObject.SetActive(sv.unlocked);
                    if (!sv.unlocked) continue;

                    _skillLbls[i].text = sv.active ? sv.label + "\n" + sv.secondsLeft + "s"
                                       : sv.ready  ? sv.label + "\nREADY"
                                                   : sv.label + "\n" + sv.secondsLeft + "s";
                    _skillLbls[i].color = sv.active ? UiTheme.Boss      // active  → gold
                                        : sv.ready  ? UiTheme.Success   // ready   → green
                                                    : UiTheme.SubText;  // cooldown→ dim
                    _skillBtns[i].interactable = sv.ready;
                    if (sv.active && activeSkillInfo == "") activeSkillInfo = sv.description;
                }
            _skillInfo.text = activeSkillInfo;

            UpdateCallout();

            _fleet.Refresh();
            _artifacts.Refresh();
            _prestige.Refresh();
            _daily.Refresh();
            bool dailyClaimable = _s.Daily.CanClaim(DateTimeOffset.UtcNow.ToUnixTimeSeconds());
            _dailyBtnLbl.text = dailyClaimable ? "🎁!" : "🎁";
            _dailyBtnLbl.color = dailyClaimable ? UiTheme.Success : UiTheme.Text;

            if (_bannerT > 0f)
            {
                _bannerT -= Time.deltaTime;
                var c = _banner.color; c.a = Mathf.Clamp01(_bannerT); _banner.color = c;
                if (_bannerT <= 0f) _banner.text = "";
            }

            if (_flashT > 0f)
            {
                _flashT -= Time.deltaTime;
                float a = Mathf.Clamp01(_flashT / _flashDuration) * 0.55f;
                var fc = _flash.color; fc.a = a; _flash.color = fc;
            }
        }

        // FTUE guidance: first tap → first upgrade. Pulses; disappears when done.
        void UpdateCallout()
        {
            if (_callout == null) return;
            string msg = null;

            if (_introCallout && !_tappedOnce)
                msg = "TAP THE PLANET TO FIRE";
            else if (_introCallout && _tapUpShown && _s.TapUpgrade.Level == 1)
                msg = "▲ UPGRADE YOUR CANNON";

            if (msg == null) { if (_callout.text != "") _callout.text = ""; return; }

            _callout.text = msg;
            var c = _callout.color;
            c.a = 0.55f + 0.45f * Mathf.Sin(Time.time * 5f);
            _callout.color = c;
        }

        public void ShowBanner(string text)
        {
            if (_banner == null) return;
            _banner.text = text;
            var c = _banner.color; c.a = 1f; _banner.color = c;
            _bannerT = 4f;
        }

        // ── feedback ──
        // Per-source visual language: fleet ticks are small/quick/cool so they don't spam the
        // screen; tap is the baseline; skill hits are bigger/hotter/longer with a "⚡" tag so
        // they read as more impactful than a normal tap. Reward stays the largest of all
        // (set in the OnReward handler above). A boss target additionally intensifies whatever
        // is hitting it (bigger + redder), so "boss damage" reads distinctly without a 4th style.
        void OnHit(BigNumber dmg, FeedbackKind kind)
        {
            _enemy?.Punch();

            Color color; float scale, yBase, life, rise; string prefix;
            switch (kind)
            {
                case FeedbackKind.Fleet:
                    color = new Color(0.55f, 0.85f, 1f); scale = 0.8f; yBase = 95f;  life = 0.5f; rise = 130f; prefix = "";
                    break;
                case FeedbackKind.Skill:
                    color = new Color(1f, 0.55f, 0.20f); scale = 1.35f; yBase = 130f; life = 0.9f; rise = 220f; prefix = "⚡";
                    break;
                default: // Tap
                    color = new Color(1f, 0.95f, 0.6f); scale = 1f;   yBase = 110f; life = 0.7f; rise = 170f; prefix = "";
                    break;
            }

            bool boss = _s.Enemy.Current != null && _s.Enemy.Current.IsBoss;
            if (boss)
            {
                scale *= 1.18f;
                color = Color.Lerp(color, new Color(1f, 0.22f, 0.18f), 0.35f);
            }

            SpawnFloating(prefix + dmg.ToShortString(), color, yBase, scale, life, rise);
        }

        void SpawnFloating(string text, Color color, float yBase, float scale = 1f, float life = 0.7f, float rise = 170f)
        {
            if (_floatRoot == null) return;
            var f = _floatPool.Count > 0 ? _floatPool.Dequeue() : CreateFloater();
            f.Play(new Vector2(UnityEngine.Random.Range(-150f, 150f), yBase), text, color, scale, life, rise);
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
