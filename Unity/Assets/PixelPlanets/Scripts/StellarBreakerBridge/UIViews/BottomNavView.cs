using System;
using UnityEngine;
using UnityEngine.UI;

namespace StellarBreaker.HudViews
{
    public enum NavTab { Combat, Fleet, Artifacts, Prestige }

    /// <summary>
    /// Bottom tab bar (Combat / Fleet / Artifacts / Prestige) seen on every full screen.
    /// Purely a tab switcher — GameShellView owns which screen GameObject is actually shown.
    /// </summary>
    public class BottomNavView : MonoBehaviour
    {
        [Serializable]
        public struct TabButton
        {
            public NavTab tab;
            public Button button;
            public GameObject activeState;     // e.g. a colored icon/label shown only when selected
            public GameObject inactiveState;
            public GameObject dot;             // optional notification dot (Prestige uses this when relics are ready)
        }

        [SerializeField] TabButton[] tabs;

        public event Action<NavTab> OnTabSelected;

        NavTab _current = NavTab.Combat;

        void Awake()
        {
            for (int i = 0; i < tabs.Length; i++)
            {
                var tab = tabs[i].tab;
                if (tabs[i].button != null)
                    tabs[i].button.onClick.AddListener(() => Select(tab));
            }
            Select(_current);
        }

        public void Select(NavTab tab)
        {
            _current = tab;
            for (int i = 0; i < tabs.Length; i++)
            {
                bool active = tabs[i].tab == tab;
                if (tabs[i].activeState)   tabs[i].activeState.SetActive(active);
                if (tabs[i].inactiveState) tabs[i].inactiveState.SetActive(!active);
            }
            OnTabSelected?.Invoke(tab);
        }

        public void SetDot(NavTab tab, bool visible)
        {
            for (int i = 0; i < tabs.Length; i++)
                if (tabs[i].tab == tab && tabs[i].dot) tabs[i].dot.SetActive(visible);
        }
    }
}
