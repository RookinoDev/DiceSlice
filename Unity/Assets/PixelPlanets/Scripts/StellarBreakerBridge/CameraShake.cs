using UnityEngine;

/// <summary>
/// Lightweight, self-attaching camera shake for kill feedback. Small magnitude/duration —
/// mobile-safe and never blocks gameplay (purely a transform offset restored automatically).
/// </summary>
public class CameraShake : MonoBehaviour
{
    static CameraShake _instance;

    Vector3 _basePos;
    float _t, _duration, _magnitude;

    public static void Shake(float duration = 0.18f, float magnitude = 0.06f)
    {
        if (Camera.main == null) return;
        if (_instance == null)
        {
            _instance = Camera.main.GetComponent<CameraShake>();
            if (_instance == null) _instance = Camera.main.gameObject.AddComponent<CameraShake>();
        }
        _instance.Begin(duration, magnitude);
    }

    void Begin(float duration, float magnitude)
    {
        if (_t <= 0f) _basePos = transform.localPosition;   // don't stomp base while already shaking
        _duration = duration;
        _magnitude = magnitude;
        _t = duration;
    }

    void LateUpdate()
    {
        if (_t <= 0f) return;
        _t -= Time.deltaTime;
        if (_t <= 0f) { transform.localPosition = _basePos; return; }

        float k = _t / _duration;
        Vector2 offset = UnityEngine.Random.insideUnitCircle * _magnitude * k;
        transform.localPosition = _basePos + new Vector3(offset.x, offset.y, 0f);
    }
}
