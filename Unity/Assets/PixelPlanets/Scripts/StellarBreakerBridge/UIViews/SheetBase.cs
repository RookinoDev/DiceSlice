using UnityEngine;
using UnityEngine.UI;

namespace StellarBreaker.HudViews
{
    /// <summary>
    /// Base for bottom-sheet / centered modals built entirely in the Editor (backdrop + window +
    /// close button already exist as children — this just toggles the root and wires the close
    /// button). Subclasses add their own Refresh(GameSession) logic.
    /// </summary>
    public abstract class SheetBase : MonoBehaviour
    {
        [SerializeField] protected Button closeButton;
        [SerializeField] protected Button backdropButton;   // optional: tap-outside-to-close

        public bool IsOpen => gameObject.activeSelf;

        protected virtual void Awake()
        {
            if (closeButton)   closeButton.onClick.AddListener(Close);
            if (backdropButton) backdropButton.onClick.AddListener(Close);
        }

        public virtual void Open()
        {
            transform.SetAsLastSibling();
            gameObject.SetActive(true);
        }

        public virtual void Close() => gameObject.SetActive(false);

        public void Toggle()
        {
            if (IsOpen) Close(); else Open();
        }
    }
}
