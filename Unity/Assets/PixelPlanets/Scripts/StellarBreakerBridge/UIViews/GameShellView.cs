using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using StellarBreaker.Core;
using StellarBreaker.Gameplay;

namespace StellarBreaker.HudViews
{
    /// <summary>
    /// Root orchestrator for the art-driven UI (replaces StellarBreaker.Hud.HudView). Wires the
    /// persistent TopBar/BottomNav, the 4 full screens (Combat/Fleet/Artifacts/Prestige) and the
    /// bottom-sheet modals to a GameSession, and owns lightweight combat feedback (floating
    /// numbers, banner, screen flash). Build the hierarchy + art in the Editor, assign every
    /// field below, add this component to the Canvas root, and call Bind() exactly like the old
    /// HudView — StellarBreakerBootstrap only needs to point at this component instead.
    /// </summary>
    public class GameShellView : MonoBehaviour
    {
        [Header("Shell")]
        [SerializeField] TopBarView topBar;
        [SerializeField] BottomNavView bottomNav;

        [Header("Full screens (children of the shell, toggled by BottomNav)")]
        [SerializeField] GameObject combatScreenRoot;
        [SerializeField] CombatScreenView combatScreen;
        [SerializeField] GameObject fleetScreenRoot;
        [SerializeField] FleetScreenView fleetScreen;
        [SerializeField] GameObject artifactsScreenRoot;
        [SerializeField] ArtifactsScreenView artifactsScreen;
        [SerializeField] GameObject prestigeScreenRoot;
        [SerializeField] PrestigeScreenView prestigeScreen;

        [Header("Sheets / modals")]
        [SerializeField] SkillLoadoutSheet skillLoadoutSheet;
        [SerializeField] PrestigeConfirmSheet prestigeConfirmSheet;
        [SerializeField] MissionsSheet missionsSheet;
        [SerializeField] DailyRewardSheet dailyRewardSheet;
        [SerializeField] OfflineRewardsSheet offlineRewardsSheet;
        [SerializeField] SettingsSheet settingsSheet;
        [SerializeField] ShipUnlockToast shipUnlockToast;

        [Header("Combat feedback")]
        [SerializeField] Transform floatRoot;
        [SerializeField] FloatingNumber floatingNumberPrefab;
        [SerializeField] TMP_Text bannerLabel;
        [SerializeField] Image flashOverlay;

        GameSession _s;
        IEnemyView _enemy;
        readonly Queue<FloatingNumber> _floatPool = new Queue<FloatingNumber>();
        float _bannerT, _flashT, _flashDuration;

        Action<DamageEvent>       _onTap;
        Action<int, BigNumber>    _onShipHit;
        Action<string>            _onMessage;
        Action<Planet, BigNumber> _onReward;
        Action<BigNumber>         _onSkillDamage;
        Action<int, int>          _onShipChanged;
        Action<int>               _onBossStarted;

        void Awake()
        {
            if (bottomNav) bottomNav.OnTabSelected += OnTabSelected;

            if (topBar)
            {
                topBar.OnSettingsClicked     += () => { settingsSheet?.RearmReset(); settingsSheet?.Open(); };
                topBar.OnNotificationClicked += () => missionsSheet?.Open();
                topBar.OnDailyClicked        += () => dailyRewardSheet?.Open();
            }

            if (combatScreen) combatScreen.OnMoreSkillsClicked += () => skillLoadoutSheet?.Open();
            if (prestigeScreen) prestigeScreen.OnPrestigeRequested += () => prestigeConfirmSheet?.Open();
            if (prestigeConfirmSheet) prestigeConfirmSheet.OnPrestiged += OnPrestigeCelebration;
            if (dailyRewardSheet) dailyRewardSheet.OnClaimed += OnDailyClaimed;
            if (shipUnlockToast) shipUnlockToast.OnViewFleetRequested += () => bottomNav?.Select(NavTab.Fleet);
        }

        public void Bind(GameSession session, IEnemyView enemyView, Action onResetSave,
                         double offlineSeconds, BigNumber offlineGold)
        {
            _s = session;
            _enemy = enemyView;

            combatScreen?.Bind(session);
            fleetScreen?.Bind(session);
            artifactsScreen?.Bind(session);
            prestigeScreen?.Bind(session);
            skillLoadoutSheet?.Bind(session);
            prestigeConfirmSheet?.Bind(session);
            missionsSheet?.Bind(session);
            dailyRewardSheet?.Bind(session);
            settingsSheet?.Bind(onResetSave, Application.version);

            _onTap         = e => { OnHit(e.Amount, FeedbackKind.Tap); AudioManager.Instance?.Tap(); };
            _onShipHit     = (i, d) => OnHit(d, FeedbackKind.Fleet);
            _onSkillDamage = d => OnHit(d, FeedbackKind.Skill);
            _onMessage     = msg => { ShowBanner(msg); AudioManager.Instance?.BossFail(); };
            _onShipChanged = (i, lvl) => { if (lvl == 1) shipUnlockToast?.Show(session.Ships.Def(i), i); };

            _onReward = (p, g) =>
            {
                bool bossKill = p.IsBoss;
                _enemy?.Explode();
                string popText = "+" + g.ToShortString();
                if (bossKill)
                {
                    double mult = _s.Stage.BossRewardMultiplier(p.Stage);
                    popText += "  (×" + mult.ToString("0.0") + " BOSS BONUS)";
                    ShowBanner("★ BOSS DEFEATED ★");
                    AudioManager.Instance?.BossDown();
                }
                else AudioManager.Instance?.Explosion();

                SpawnFloating(popText, UiPalette.Success, bossKill ? 230f : 200f, bossKill ? 2.2f : 1.7f, 0.9f, 200f);
                CameraShake.Shake(bossKill ? 0.32f : 0.18f, bossKill ? 0.11f : 0.06f);
            };

            session.Taps.OnDamageDealt  += _onTap;
            session.Ships.OnShipHit     += _onShipHit;
            session.OnSkillDamage       += _onSkillDamage;
            session.OnMessage           += _onMessage;
            session.OnReward            += _onReward;
            session.Ships.OnShipChanged += _onShipChanged;
            _onBossStarted = stage =>
            {
                ShowBanner("☠ BOSS ENCOUNTER — SECTOR " + stage);
                AudioManager.Instance?.BossStart();
            };
            session.Stage.OnBossStarted += _onBossStarted;

            OnTabSelected(NavTab.Combat);

            if (offlineGold > BigNumber.Zero)
            {
                offlineRewardsSheet?.Show(offlineSeconds, offlineGold);
            }
            else
            {
                long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                if (session.Daily.CanClaim(now)) dailyRewardSheet?.Open();
            }
        }

        void OnDestroy()
        {
            if (_s == null) return;
            _s.Taps.OnDamageDealt  -= _onTap;
            _s.Ships.OnShipHit     -= _onShipHit;
            _s.OnSkillDamage       -= _onSkillDamage;
            _s.OnMessage           -= _onMessage;
            _s.OnReward            -= _onReward;
            _s.Ships.OnShipChanged -= _onShipChanged;
            _s.Stage.OnBossStarted -= _onBossStarted;
        }

        void OnTabSelected(NavTab tab)
        {
            if (combatScreenRoot)    combatScreenRoot.SetActive(tab == NavTab.Combat);
            if (fleetScreenRoot)     fleetScreenRoot.SetActive(tab == NavTab.Fleet);
            if (artifactsScreenRoot) artifactsScreenRoot.SetActive(tab == NavTab.Artifacts);
            if (prestigeScreenRoot) prestigeScreenRoot.SetActive(tab == NavTab.Prestige);
        }

        void OnPrestigeCelebration(BigNumber relicsGained)
        {
            ShowBanner("★ PERMANENT POWER INCREASED ★  +" + relicsGained.ToShortString() + " relics");
            SpawnFloating("+" + relicsGained.ToShortString() + " ◆", UiPalette.Relic, 250f, 2.0f, 1.2f, 220f);
            Flash(UiPalette.Relic, 0.28f);
            CameraShake.Shake(0.22f, 0.08f);
            AudioManager.Instance?.Prestige();
        }

        void OnDailyClaimed(GameSession.DailyPreview result)
        {
            string txt = "Daily Day " + result.day + "  +" + result.gold.ToShortString() + " Stardust"
                       + (result.relic ? "  +1 Relic" : "");
            ShowBanner(txt);
            SpawnFloating("+" + result.gold.ToShortString(), UiPalette.Success, 200f, 1.6f, 0.9f, 200f);
            AudioManager.Instance?.Prestige();
        }

        void Update()
        {
            if (_s == null) return;

            topBar?.Refresh(_s);
            if (combatScreenRoot != null && combatScreenRoot.activeSelf) combatScreen?.Refresh();
            if (fleetScreenRoot != null && fleetScreenRoot.activeSelf)   fleetScreen?.Refresh();
            if (artifactsScreenRoot != null && artifactsScreenRoot.activeSelf) artifactsScreen?.Refresh();
            if (prestigeScreenRoot != null && prestigeScreenRoot.activeSelf)   prestigeScreen?.Refresh();
            skillLoadoutSheet?.Refresh();
            missionsSheet?.Refresh();
            dailyRewardSheet?.Refresh();

            if (bottomNav)
                bottomNav.SetDot(NavTab.Prestige, _s.CanPrestige());

            if (_bannerT > 0f)
            {
                _bannerT -= Time.deltaTime;
                if (bannerLabel)
                {
                    var c = bannerLabel.color; c.a = Mathf.Clamp01(_bannerT); bannerLabel.color = c;
                    if (_bannerT <= 0f) bannerLabel.text = "";
                }
            }

            if (_flashT > 0f && flashOverlay)
            {
                _flashT -= Time.deltaTime;
                float a = Mathf.Clamp01(_flashT / _flashDuration) * 0.55f;
                var fc = flashOverlay.color; fc.a = a; flashOverlay.color = fc;
            }
        }

        public void ShowBanner(string text)
        {
            if (!bannerLabel) return;
            bannerLabel.text = text;
            var c = bannerLabel.color; c.a = 1f; bannerLabel.color = c;
            _bannerT = 4f;
        }

        void Flash(Color color, float duration)
        {
            if (!flashOverlay) return;
            _flashDuration = Mathf.Max(0.01f, duration);
            _flashT = _flashDuration;
            var c = color; c.a = 0.55f;
            flashOverlay.color = c;
        }

        enum FeedbackKind { Tap, Fleet, Skill }

        void OnHit(BigNumber dmg, FeedbackKind kind)
        {
            _enemy?.Punch();

            Color color; float scale, yBase, life, rise; string prefix;
            switch (kind)
            {
                case FeedbackKind.Fleet:
                    color = new Color(0.55f, 0.85f, 1f); scale = 0.8f; yBase = 95f; life = 0.5f; rise = 130f; prefix = "";
                    break;
                case FeedbackKind.Skill:
                    color = new Color(1f, 0.55f, 0.20f); scale = 1.35f; yBase = 130f; life = 0.9f; rise = 220f; prefix = "⚡";
                    break;
                default:
                    color = new Color(1f, 0.95f, 0.6f); scale = 1f; yBase = 110f; life = 0.7f; rise = 170f; prefix = "";
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
            if (!floatRoot || !floatingNumberPrefab) return;
            var f = _floatPool.Count > 0 ? _floatPool.Dequeue() : CreateFloater();
            f.Play(new Vector2(UnityEngine.Random.Range(-150f, 150f), yBase), text, color, scale, life, rise);
        }

        FloatingNumber CreateFloater()
        {
            var f = Instantiate(floatingNumberPrefab, floatRoot);
            f.OnDone = fn => _floatPool.Enqueue(fn);
            return f;
        }
    }
}
