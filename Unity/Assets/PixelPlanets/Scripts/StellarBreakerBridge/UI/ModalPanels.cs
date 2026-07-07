using System;
using UnityEngine;
using UnityEngine.UI;
using StellarBreaker.Core;
using StellarBreaker.Gameplay;
using StellarBreaker.Monetization;

namespace StellarBreaker.Hud
{
    /// <summary>Backdrop + centered window + close button. Each modal subclasses this.</summary>
    public abstract class ModalBase
    {
        protected GameObject Root;
        protected RectTransform Window;
        public bool IsOpen => Root != null && Root.activeSelf;

        public void Open()  { if (Root) { Root.transform.SetAsLastSibling(); Root.SetActive(true); } }
        public void Close() { if (Root) Root.SetActive(false); }
        public void Toggle(){ if (IsOpen) Close(); else Open(); }

        protected void BuildShell(Transform canvas, string name, Vector2 winSize, string title)
        {
            Root = new GameObject(name);
            Root.transform.SetParent(canvas, false);
            var rt = Root.AddComponent<RectTransform>();
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.offsetMin = rt.offsetMax = Vector2.zero;
            var backdrop = Root.AddComponent<Image>();
            backdrop.color = UiTheme.Backdrop;     // raycast target → blocks taps behind

            var win = UiKit.Panel(Root.transform, "Window", new Vector2(0.5f, 0.5f), Vector2.zero, winSize, UiTheme.Panel);
            Window = (RectTransform)win.transform;
            UiKit.Label(Window, "Title", new Vector2(0.5f, 1f), new Vector2(0, -54), new Vector2(winSize.x - 140, 72), 48, TextAnchor.MiddleCenter)
                 .text = title;
            var close = UiKit.Button(Window, "Close", new Vector2(1f, 1f), new Vector2(-58, -54), new Vector2(96, 80),
                                     out var cl, 42, new Color(0.40f, 0.15f, 0.20f, 0.95f));
            cl.text = "✕";
            close.onClick.AddListener(() => { AudioManager.Instance?.Click(); Close(); });

            Root.SetActive(false);
        }
    }

    // ── Fleet ────────────────────────────────────────────────────────
    public sealed class FleetPanel : ModalBase
    {
        readonly GameSession _s;
        readonly Func<bool> _buyMax;
        Button[] _rowBtns; Text[] _rowLabels; Text _page, _total;
        int _pageIdx; const int Size = 6;

        public FleetPanel(Transform canvas, GameSession s, Func<bool> buyMax = null)
        {
            _s = s;
            _buyMax = buyMax ?? (() => false);
            BuildShell(canvas, "FleetPanel", new Vector2(980, 1520), "FLEET");
            _total = UiKit.Label(Window, "Total", new Vector2(0.5f, 1f), new Vector2(0, -132), new Vector2(900, 50), 32, TextAnchor.MiddleCenter, UiTheme.SubText);

            _rowBtns = new Button[Size]; _rowLabels = new Text[Size];
            for (int r = 0; r < Size; r++)
            {
                int row = r;
                _rowBtns[r] = UiKit.Button(Window, "Row" + r, new Vector2(0.5f, 1f), new Vector2(0, -220 - r * 175), new Vector2(900, 156), out _rowLabels[r], 28);
                _rowLabels[r].alignment = TextAnchor.MiddleLeft;
                _rowBtns[r].onClick.AddListener(() =>
                {
                    AudioManager.Instance?.Click();
                    int idx = _pageIdx * Size + row;
                    if (idx < _s.Ships.Count) { if (_buyMax()) _s.BuyShipMax(idx); else _s.BuyShip(idx); }
                });
            }
            var prev = UiKit.Button(Window, "Prev", new Vector2(0.5f, 0f), new Vector2(-285, 72), new Vector2(240, 100), out var pl, 30); pl.text = "◀";
            prev.onClick.AddListener(() => { AudioManager.Instance?.Click(); _pageIdx--; Clamp(); });
            var next = UiKit.Button(Window, "Next", new Vector2(0.5f, 0f), new Vector2(285, 72), new Vector2(240, 100), out var nl, 30); nl.text = "▶";
            next.onClick.AddListener(() => { AudioManager.Instance?.Click(); _pageIdx++; Clamp(); });
            _page = UiKit.Label(Window, "Page", new Vector2(0.5f, 0f), new Vector2(0, 100), new Vector2(320, 56), 32, TextAnchor.MiddleCenter);
        }

        int Pages() => Mathf.Max(1, (_s.Ships.Count + Size - 1) / Size);
        void Clamp() => _pageIdx = Mathf.Clamp(_pageIdx, 0, Pages() - 1);

        public void Refresh()
        {
            if (!IsOpen) return;
            Clamp();
            var ships = _s.Ships;
            _total.text = "Total Fleet DPS:  " + ships.FleetDps().ToShortString();
            for (int r = 0; r < Size; r++)
            {
                int idx = _pageIdx * Size + r;
                if (idx < ships.Count)
                {
                    _rowBtns[r].gameObject.SetActive(true);
                    string st = ships.IsOwned(idx) ? "Lv " + ships.LevelOf(idx) : "BUY";
                    var def = ships.Def(idx);
                    string cls = string.IsNullOrEmpty(def.className) ? "" : "  ·  " + def.className;
                    _rowLabels[r].text = "   " + def.shipName + cls + "   [" + st + "]" +
                                         "\n   DPS " + ships.ShipDps(idx).ToShortString() + "      Cost " + ships.NextCost(idx).ToShortString();
                    _rowBtns[r].interactable = _s.Wallet.CanAfford(ships.NextCost(idx));
                }
                else _rowBtns[r].gameObject.SetActive(false);
            }
            _page.text = (_pageIdx + 1) + " / " + Pages();
        }
    }

    // ── Artifacts ────────────────────────────────────────────────────
    public sealed class ArtifactPanel : ModalBase
    {
        readonly GameSession _s;
        readonly Func<bool> _buyMax;
        Button[] _btns; Text[] _labels; Text _relics;

        public ArtifactPanel(Transform canvas, GameSession s, Func<bool> buyMax = null)
        {
            _s = s;
            _buyMax = buyMax ?? (() => false);
            BuildShell(canvas, "ArtifactPanel", new Vector2(980, 1100), "ARTIFACTS");
            _relics = UiKit.Label(Window, "Relics", new Vector2(0.5f, 1f), new Vector2(0, -132), new Vector2(900, 56), 36, TextAnchor.MiddleCenter, UiTheme.Relic);

            int n = _s.Artifacts.Count;
            _btns = new Button[n]; _labels = new Text[n];
            for (int i = 0; i < n; i++)
            {
                int idx = i;
                _btns[i] = UiKit.Button(Window, "Art" + i, new Vector2(0.5f, 1f), new Vector2(0, -230 - i * 200), new Vector2(900, 180), out _labels[i], 28);
                _labels[i].alignment = TextAnchor.MiddleLeft;
                _btns[i].onClick.AddListener(() =>
                {
                    AudioManager.Instance?.Click();
                    if (idx < _s.Artifacts.Count) { if (_buyMax()) _s.BuyArtifactMax(idx); else _s.BuyArtifact(idx); }
                });
            }
        }

        public void Refresh()
        {
            if (!IsOpen) return;
            _relics.text = "◆ Relics:  " + _s.Prestige.Relics.Stardust.ToShortString();
            var a = _s.Artifacts;
            for (int i = 0; i < _btns.Length; i++)
            {
                var d = a.Def(i);
                int lvl = a.LevelOf(i);
                int pct     = (int)System.Math.Round(d.BonusAt(lvl) * 100.0);
                int nextPct = (int)System.Math.Round(d.BonusAt(lvl + 1) * 100.0);
                string desc = string.IsNullOrEmpty(d.description) ? "" : "\n   " + d.description;
                _labels[i].text = "   " + d.displayName + "   Lv " + lvl + desc +
                                  "\n   +" + pct + "%  →  +" + nextPct + "%      Cost " + a.NextCost(i).ToShortString() + " relics";
                _btns[i].interactable = _s.Prestige.Relics.CanAfford(a.NextCost(i));
            }
        }
    }

    // ── Prestige ─────────────────────────────────────────────────────
    public sealed class PrestigePanel : ModalBase
    {
        readonly GameSession _s;
        Text _info; Button _confirm; Text _confirmLbl;
        public Action<BigNumber> OnPrestiged;

        public PrestigePanel(Transform canvas, GameSession s)
        {
            _s = s;
            BuildShell(canvas, "PrestigePanel", new Vector2(960, 1150), "STELLAR ASCENSION");
            _info = UiKit.Label(Window, "Info", new Vector2(0.5f, 1f), new Vector2(0, -420), new Vector2(860, 720), 32, TextAnchor.UpperLeft);

            _confirm = UiKit.Button(Window, "Confirm", new Vector2(0.5f, 0f), new Vector2(-240, 90), new Vector2(420, 120), out _confirmLbl, 34, UiTheme.Primary);
            _confirmLbl.text = "ASCEND";
            _confirm.onClick.AddListener(() =>
            {
                var g = _s.DoPrestige();
                Close();
                if (g > BigNumber.Zero) { AudioManager.Instance?.Prestige(); OnPrestiged?.Invoke(g); }
            });
            var cancel = UiKit.Button(Window, "Cancel", new Vector2(0.5f, 0f), new Vector2(240, 90), new Vector2(420, 120), out var cl, 34);
            cl.text = "CANCEL";
            cancel.onClick.AddListener(() => { AudioManager.Instance?.Click(); Close(); });
        }

        public void Refresh()
        {
            if (!IsOpen) return;
            bool can = _s.CanPrestige();
            _info.text =
                "Ascend to a new stellar cycle for a PERMANENT power boost.\n\n" +
                "Highest sector:  " + _s.Stage.HighestStage + "\n" +
                "Relics gained:  +" + _s.PreviewRelics().ToShortString() + "\n\n" +
                "RESETS:  sector, Stardust, tap level, fleet\n" +
                "KEEPS FOREVER:  relics, artifacts\n\n" +
                (can ? "Spend Relics in the Artifacts panel — even one level is a real jump in power. Ascending sooner means reaching that jump sooner."
                     : "Reach a higher sector to ascend.");
            _confirm.interactable = can;
        }
    }

    // ── Daily reward ─────────────────────────────────────────────────
    public sealed class DailyPanel : ModalBase
    {
        readonly GameSession _s;
        Text _body; Button _claim; Text _claimLbl;
        public Action<GameSession.DailyPreview> OnClaimed;

        public DailyPanel(Transform canvas, GameSession s)
        {
            _s = s;
            BuildShell(canvas, "DailyPanel", new Vector2(900, 840), "DAILY REWARD");
            _body = UiKit.Label(Window, "Body", new Vector2(0.5f, 1f), new Vector2(0, -310), new Vector2(820, 400), 32, TextAnchor.MiddleCenter);
            _body.supportRichText = true;

            _claim = UiKit.Button(Window, "Claim", new Vector2(0.5f, 0f), new Vector2(0, 110), new Vector2(560, 130), out _claimLbl, 38, UiTheme.Primary);
            _claim.onClick.AddListener(() =>
            {
                AudioManager.Instance?.Click();
                long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                var result = _s.ClaimDaily(now);
                if (result.canClaim) OnClaimed?.Invoke(result);   // canClaim=true here means the claim just succeeded
                Refresh();
            });
        }

        public void Refresh()
        {
            if (!IsOpen) return;
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var p = _s.PreviewDaily(now);

            if (p.canClaim)
            {
                _body.text = "Day " + p.day + " of 7\n\nReward:\n<color=#FFD966>+" + p.gold.ToShortString() + "</color> Stardust" +
                             (p.relic ? "\n<color=#D2A8FF>+1 Relic</color>" : "");
                _claim.gameObject.SetActive(true);
                _claim.interactable = true;
                _claimLbl.text = "CLAIM";
            }
            else
            {
                long secs = DailyRewardService.SecondsUntilNextDay(now);
                int h = (int)(secs / 3600), m = (int)((secs % 3600) / 60);
                var next = _s.PreviewDaily(now + secs);
                _body.text = "Day " + p.day + " of 7 — CLAIMED ✓\n\nCome back in\n" + h + "h " + m + "m\nfor Day " + next.day + "!";
                _claim.interactable = false;
                _claimLbl.text = "CLAIMED";
            }
        }
    }

    // ── Offline reward ───────────────────────────────────────────────
    public sealed class OfflinePanel : ModalBase
    {
        Text _body;

        public OfflinePanel(Transform canvas)
        {
            BuildShell(canvas, "OfflinePanel", new Vector2(900, 760), "WELCOME BACK");
            _body = UiKit.Label(Window, "Body", new Vector2(0.5f, 1f), new Vector2(0, -320), new Vector2(840, 420), 32, TextAnchor.MiddleCenter);
            var claim = UiKit.Button(Window, "Claim", new Vector2(0.5f, 0f), new Vector2(0, 110), new Vector2(560, 130), out var lbl, 40, UiTheme.Primary);
            lbl.text = "CLAIM";
            claim.onClick.AddListener(() => { AudioManager.Instance?.Click(); Close(); });
        }

        public void Show(double seconds, BigNumber gold)
        {
            int h = (int)(seconds / 3600), m = (int)((seconds % 3600) / 60);
            _body.text = "Your fleet kept working while you were away.\n\nAway for " + (h > 0 ? h + "h " : "") + m + "m\n\nEarned\n<color=#FFD966>+" + gold.ToShortString() + "</color> Stardust";
            _body.supportRichText = true;
            Open();
        }
    }

    // ── Settings ─────────────────────────────────────────────────────
    public sealed class SettingsPanel : ModalBase
    {
        Button _mute; Text _muteLbl; Button _reset; Text _resetLbl;
        bool _resetArmed;
        readonly Action _onResetSave;

        public SettingsPanel(Transform canvas, Action onResetSave, string version)
        {
            _onResetSave = onResetSave;
            BuildShell(canvas, "SettingsPanel", new Vector2(900, 900), "SETTINGS");

            _mute = UiKit.Button(Window, "Mute", new Vector2(0.5f, 1f), new Vector2(0, -240), new Vector2(720, 130), out _muteLbl, 36);
            _mute.onClick.AddListener(() =>
            {
                AudioManager.Instance?.ToggleMute();
                AudioManager.Instance?.Click();
                RefreshMute();
            });

            _reset = UiKit.Button(Window, "Reset", new Vector2(0.5f, 1f), new Vector2(0, -400), new Vector2(720, 130), out _resetLbl, 34, new Color(0.45f, 0.16f, 0.2f, 0.96f));
            _resetLbl.text = "RESET SAVE";
            _reset.onClick.AddListener(() =>
            {
                if (!_resetArmed) { _resetArmed = true; _resetLbl.text = "TAP AGAIN TO CONFIRM"; }
                else { _onResetSave?.Invoke(); }
            });

            UiKit.Label(Window, "Version", new Vector2(0.5f, 0f), new Vector2(0, 70), new Vector2(800, 50), 26, TextAnchor.MiddleCenter, UiTheme.SubText)
                 .text = "Stellar Breaker · " + version;

            RefreshMute();
        }

        void RefreshMute()
        {
            bool muted = AudioManager.Instance != null && AudioManager.Instance.Muted;
            _muteLbl.text = muted ? "SFX:  OFF" : "SFX:  ON";
        }

        public void RearmReset()
        {
            _resetArmed = false;
            if (_resetLbl != null) _resetLbl.text = "RESET SAVE";
        }
    }
}
