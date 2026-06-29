using System;
using UnityEngine;
using UnityEngine.UI;

/// <summary>Poolable floating damage/reward number (rises + fades). Returns itself when done.</summary>
public class FloatingNumber : MonoBehaviour
{
    const float Life = 0.7f, Rise = 170f;

    float _t;
    Text  _text;
    RectTransform _rt;
    Vector2 _start;

    /// <summary>Invoked when the animation finishes so the owner can recycle this instance.</summary>
    public Action<FloatingNumber> OnDone;

    void Awake()
    {
        _text = GetComponent<Text>();
        _rt   = (RectTransform)transform;
    }

    /// <summary>(Re)start the animation from a pooled/active state.</summary>
    public void Play(Vector2 start, string text, Color color)
    {
        _t = 0f;
        _start = start;
        _rt.anchoredPosition = start;
        _rt.localScale = Vector3.one;
        if (_text != null) { _text.text = text; color.a = 1f; _text.color = color; }
        gameObject.SetActive(true);
    }

    void Update()
    {
        _t += Time.deltaTime;
        float k = _t / Life;

        _rt.anchoredPosition = _start + Vector2.up * (Rise * k);
        _rt.localScale = Vector3.one * (1f + 0.25f * Mathf.Clamp01(1f - k * 3f));
        if (_text != null) { var c = _text.color; c.a = Mathf.Clamp01(1f - k); _text.color = c; }

        if (_t >= Life)
        {
            gameObject.SetActive(false);   // recycle instead of Destroy
            OnDone?.Invoke(this);
        }
    }
}
