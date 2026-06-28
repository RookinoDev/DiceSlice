using UnityEngine;
using UnityEngine.UI;

/// <summary>Tiny self-destructing floating damage number (rises + fades). Placeholder feedback.</summary>
public class FloatingNumber : MonoBehaviour
{
    const float Life = 0.7f, Rise = 170f;

    float _t;
    Text  _text;
    RectTransform _rt;
    Vector2 _start;

    void Awake()
    {
        _text  = GetComponent<Text>();
        _rt    = (RectTransform)transform;
        _start = _rt.anchoredPosition;
    }

    void Update()
    {
        _t += Time.deltaTime;
        float k = _t / Life;

        _rt.anchoredPosition = _start + Vector2.up * (Rise * k);
        _rt.localScale = Vector3.one * (1f + 0.25f * Mathf.Clamp01(1f - k * 3f));

        if (_text != null)
        {
            var c = _text.color;
            c.a = Mathf.Clamp01(1f - k);
            _text.color = c;
        }

        if (_t >= Life) Destroy(gameObject);
    }
}
