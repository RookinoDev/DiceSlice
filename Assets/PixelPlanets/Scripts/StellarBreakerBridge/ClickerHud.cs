using System;
using UnityEngine;
using UnityEngine.UI;
using StellarBreaker.Core;
using StellarBreaker.Gameplay;
using StellarBreaker.UI;

/// <summary>
/// Minimal MVP combat HUD (uGUI, mobile portrait). View-only: reads a MainViewModel
/// from MainPresenter each frame and pushes it into Text/Image. Buttons call GameSession.
/// Adds placeholder floating damage numbers and a small enemy hit punch.
/// </summary>
public class ClickerHud : MonoBehaviour
{
    GameSession   _s;
    MainPresenter _presenter;

    Text  _stage, _hp, _currency, _tapDmg, _dps, _bossTimer, _tapBtnLabel, _shipBtnLabel, _banner;
    Image _hpFill;
    Button _tapBtn, _shipBtn, _prestigeBtn;
    Text _prestigeLabel;
    readonly Button[] _skillBtns   = new Button[3];
    readonly Text[]   _skillLabels = new Text[3];
    Transform _floatRoot, _planetRoot;
    float _punch, _bannerT;

    Action<DamageEvent>      _onTap;
    Action<int, BigNumber>   _onShipHit;

    public void Bind(GameSession session)
    {
        _s = session;
        _presenter = new MainPresenter(session);
        if (transform.Find("ClickerCanvas") == null) Build();

        _onTap     = e => OnHit(e.Amount);
        _onShipHit = (i, d) => OnHit(d);
        _s.Taps.OnDamageDealt += _onTap;
        _s.Ships.OnShipHit    += _onShipHit;
    }

    void OnDestroy()
    {
        if (_s == null) return;
        _s.Taps.OnDamageDealt -= _onTap;
        _s.Ships.OnShipHit    -= _onShipHit;
    }

    static Font UiFont =>
        PixelPlanetGenerator.CustomFont
        ?? Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf")
        ?? Resources.GetBuiltinResource<Font>("Arial.ttf");

    void Build()
    {
        EnsureEventSystem();

        var canvasGo = new GameObject("ClickerCanvas");
        canvasGo.transform.SetParent(transform, false);
        var canvas = canvasGo.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 100;
        var scaler = canvasGo.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1080, 1920);   // mobile portrait
        scaler.matchWidthOrHeight = 0.5f;
        canvasGo.AddComponent<GraphicRaycaster>();
        var root = canvasGo.transform;

        // Top: stage + HP bar + currency + boss timer
        _stage    = Label(root, "Stage",    new Vector2(0.5f, 1f), new Vector2(0, -70),  new Vector2(900, 70), 46, TextAnchor.MiddleCenter);
        var barBg = Panel(root, "HpBarBg",  new Vector2(0.5f, 1f), new Vector2(0, -160), new Vector2(820, 46), new Color(0, 0, 0, 0.55f));
        _hpFill   = Panel(root, "HpFill",   new Vector2(0.5f, 1f), new Vector2(0, -160), new Vector2(820, 46), new Color(0.85f, 0.25f, 0.30f, 1f));
        barBg.sprite = _hpFill.sprite = WhiteSprite();
        _hpFill.type = Image.Type.Filled; _hpFill.fillMethod = Image.FillMethod.Horizontal; _hpFill.fillOrigin = 0;
        _hp       = Label(root, "HpText",   new Vector2(0.5f, 1f), new Vector2(0, -160), new Vector2(820, 46), 28, TextAnchor.MiddleCenter);
        _currency = Label(root, "Currency", new Vector2(0.5f, 1f), new Vector2(0, -220), new Vector2(900, 50), 40, TextAnchor.MiddleCenter);
        _bossTimer= Label(root, "BossTimer",new Vector2(0.5f, 1f), new Vector2(0, -270), new Vector2(900, 44), 34, TextAnchor.MiddleCenter);
        _bossTimer.color = new Color(1f, 0.78f, 0.28f);

        // Banner (offline earnings etc.)
        _banner = Label(root, "Banner", new Vector2(0.5f, 0.5f), new Vector2(0, 360), new Vector2(980, 70), 44, TextAnchor.MiddleCenter);
        _banner.color = new Color(0.55f, 1f, 0.65f);
        _banner.text  = "";

        // Floating-number layer (center)
        _floatRoot = Rect(root, "Floaters", new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(100, 100));

        // Bottom: stats + buttons
        _tapDmg = Label(root, "TapDmg", new Vector2(0.5f, 0f), new Vector2(0, 350), new Vector2(900, 44), 32, TextAnchor.MiddleCenter);
        _dps    = Label(root, "Dps",    new Vector2(0.5f, 0f), new Vector2(0, 305), new Vector2(900, 44), 32, TextAnchor.MiddleCenter);

        _tapBtn  = MakeButton(root, "UpgradeTap", new Vector2(0.5f, 0f), new Vector2(0, 215), new Vector2(700, 100), out _tapBtnLabel);
        _tapBtn.onClick.AddListener(() => _s.UpgradeTapDamage());

        _shipBtn = MakeButton(root, "BuyShip", new Vector2(0.5f, 0f), new Vector2(0, 100), new Vector2(700, 100), out _shipBtnLabel);
        _shipBtn.onClick.AddListener(() => { if (_s.Ships.Count > 0) _s.BuyShip(0); });

        // Skills row (3 buttons)
        for (int i = 0; i < _skillBtns.Length; i++)
        {
            int idx = i;
            _skillBtns[i] = MakeButton(root, "Skill" + i, new Vector2(0.5f, 0f),
                                       new Vector2((i - 1) * 235f, 470), new Vector2(220, 96), out _skillLabels[i]);
            _skillLabels[i].fontSize = 26;
            _skillBtns[i].onClick.AddListener(() =>
            {
                if (idx < _s.SkillSlots.Count) _s.ActivateSkill(_s.SkillSlots[idx]);
            });
        }

        // Prestige (top, shown only when available)
        _prestigeBtn = MakeButton(root, "Prestige", new Vector2(0.5f, 1f),
                                  new Vector2(0, -330), new Vector2(560, 84), out _prestigeLabel);
        _prestigeLabel.fontSize = 30;
        _prestigeBtn.onClick.AddListener(() =>
        {
            var g = _s.DoPrestige();
            if (g > BigNumber.Zero) ShowBanner("Prestige!  +" + g.ToShortString() + " relics");
        });
        _prestigeBtn.gameObject.SetActive(false);
    }

    void Update()
    {
        if (_presenter == null || _stage == null) return;

        var vm = _presenter.Build();
        _stage.text     = vm.stageLabel.ToUpperInvariant() + (vm.isBoss ? "  ★BOSS" : "");
        _hp.text        = vm.hpText;
        _hpFill.fillAmount = vm.hpFraction;
        _bossTimer.text = vm.bossActive ? "⏱ BOSS  " + vm.bossSecondsLeft + "s" : "";
        _currency.text  = "✦ " + vm.stardustText;
        _tapDmg.text    = "Tap " + vm.tapDamageText;
        _dps.text       = "DPS " + vm.fleetDpsText;

        _tapBtnLabel.text    = "Upgrade Tap  (" + vm.tapUpgradeCostText + ")";
        _tapBtn.interactable = vm.canUpgradeTap;
        _shipBtnLabel.text    = vm.shipButtonText;
        _shipBtn.interactable = vm.canBuyShip;

        // Skills
        if (vm.skills != null)
        {
            for (int i = 0; i < _skillBtns.Length && i < vm.skills.Length; i++)
            {
                var sv = vm.skills[i];
                _skillLabels[i].text = !sv.unlocked ? sv.label + "\nLOCK"
                                     : sv.active   ? sv.label + "\n" + sv.secondsLeft + "s"
                                     : sv.ready    ? sv.label + "\nREADY"
                                                   : sv.label + "\n" + sv.secondsLeft + "s";
                _skillBtns[i].interactable = sv.ready;
            }
        }

        // Prestige
        _prestigeBtn.gameObject.SetActive(vm.canPrestige);
        if (vm.canPrestige) { _prestigeLabel.text = vm.prestigeText; _prestigeBtn.interactable = true; }

        // Enemy hit punch (decays back to rest scale)
        _punch = Mathf.MoveTowards(_punch, 0f, Time.deltaTime / 0.12f);
        var pr = PlanetRoot();
        if (pr != null) pr.localScale = Vector3.one * (1f + 0.12f * _punch);

        // Banner fade-out
        if (_bannerT > 0f)
        {
            _bannerT -= Time.deltaTime;
            var c = _banner.color; c.a = Mathf.Clamp01(_bannerT); _banner.color = c;
            if (_bannerT <= 0f) _banner.text = "";
        }
    }

    /// <summary>Show a transient banner (e.g. offline earnings) for a few seconds.</summary>
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
        _punch = 1f;
        SpawnFloating(dmg.ToShortString());
    }

    void SpawnFloating(string text)
    {
        if (_floatRoot == null || _floatRoot.childCount > 14) return;
        var t = Label(_floatRoot, "Dmg", new Vector2(0.5f, 0.5f),
                      new Vector2(UnityEngine.Random.Range(-150f, 150f), 110f),
                      new Vector2(420, 80), 46, TextAnchor.MiddleCenter);
        t.color = new Color(1f, 0.95f, 0.6f);
        t.text  = text;
        t.gameObject.AddComponent<FloatingNumber>();
    }

    Transform PlanetRoot()
    {
        if (_planetRoot != null) return _planetRoot;
        for (int i = 0; i < transform.childCount; i++)
        {
            var c = transform.GetChild(i);
            if (c.name.StartsWith("Planet_")) { _planetRoot = c; return c; }
        }
        return null;
    }

    static Sprite _white;
    static Sprite WhiteSprite()
    {
        if (_white != null) return _white;
        var tex = Texture2D.whiteTexture;
        _white = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f));
        return _white;
    }

    // ── tiny uGUI builders ──
    static void EnsureEventSystem()
    {
        if (FindObjectOfType<UnityEngine.EventSystems.EventSystem>() != null) return;
        var es = new GameObject("EventSystem");
        es.AddComponent<UnityEngine.EventSystems.EventSystem>();
        es.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();
    }

    static RectTransform Rect(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent, false);
        var rt = go.AddComponent<RectTransform>();
        rt.anchorMin = rt.anchorMax = anchor;
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = pos;
        rt.sizeDelta = size;
        return rt;
    }

    static Text Label(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size, int fontSize, TextAnchor align)
    {
        var rt = Rect(parent, name, anchor, pos, size);
        var t = rt.gameObject.AddComponent<Text>();
        t.font = UiFont; t.fontSize = fontSize; t.fontStyle = FontStyle.Bold;
        t.alignment = align; t.color = new Color(0.93f, 0.95f, 1f);
        t.horizontalOverflow = HorizontalWrapMode.Overflow;
        t.verticalOverflow = VerticalWrapMode.Overflow;
        var sh = rt.gameObject.AddComponent<Shadow>();
        sh.effectColor = new Color(0, 0, 0, 0.6f); sh.effectDistance = new Vector2(1.5f, -1.5f);
        return t;
    }

    static Image Panel(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size, Color color)
    {
        var rt = Rect(parent, name, anchor, pos, size);
        var img = rt.gameObject.AddComponent<Image>();
        img.color = color;
        return img;
    }

    static Button MakeButton(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size, out Text label)
    {
        var img = Panel(parent, name, anchor, pos, size, new Color(0.12f, 0.14f, 0.24f, 0.95f));
        var btn = img.gameObject.AddComponent<Button>();
        btn.targetGraphic = img;
        var c = btn.colors;
        c.normalColor = new Color(0.12f, 0.14f, 0.24f, 0.95f);
        c.highlightedColor = new Color(0.20f, 0.24f, 0.40f, 1f);
        c.pressedColor = new Color(0.08f, 0.09f, 0.16f, 1f);
        c.disabledColor = new Color(0.10f, 0.10f, 0.12f, 0.6f);
        btn.colors = c;
        label = Label(img.transform, "Label", new Vector2(0.5f, 0.5f), Vector2.zero, size, 34, TextAnchor.MiddleCenter);
        return btn;
    }
}
