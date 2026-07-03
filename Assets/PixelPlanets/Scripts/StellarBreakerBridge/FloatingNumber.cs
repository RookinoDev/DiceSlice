using System;
using UnityEngine;
using UnityEngine.UI;

/// <summary>Poolable floating damage/reward number (rises + fades). Returns itself when done.</summary>
public class FloatingNumber : MonoBehaviour
{
    const float DefaultLife = 0.7f, DefaultRise = 170f;

    float _t, _baseScale = 1f, _life = DefaultLife, _rise = DefaultRise;
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

    /// <summary>
    /// (Re)start the animation from a pooled/active state.
    /// baseScale &gt; 1 = a bigger/stronger popup (e.g. skill hits, kill rewards).
    /// life/rise let different event types feel distinct (fleet ticks quick+short,
    /// skill hits linger+travel further) without touching the pooling mechanics.
    /// </summary>
    public void Play(Vector2 start, string text, Color color, float baseScale = 1f,
                     float life = DefaultLife, float rise = DefaultRise)
    {
        _t = 0f;
        _start = start;
        _baseScale = baseScale;
        _life = life > 0f ? life : DefaultLife;
        _rise = rise;
        _rt.anchoredPosition = start;
        _rt.localScale = Vector3.one * baseScale;
        if (_text != null) { _text.text = text; color.a = 1f; _text.color = color; }
        gameObject.SetActive(true);
    }

    void Update()
    {
        _t += Time.deltaTime;
        float k = _t / _life;

        _rt.anchoredPosition = _start + Vector2.up * (_rise * k);
        _rt.localScale = Vector3.one * _baseScale * (1f + 0.25f * Mathf.Clamp01(1f - k * 3f));
        if (_text != null) { var c = _text.color; c.a = Mathf.Clamp01(1f - k); _text.color = c; }

        if (_t >= _life)
        {
            gameObject.SetActive(false);   // recycle instead of Destroy
            OnDone?.Invoke(this);
        }
    }
}
