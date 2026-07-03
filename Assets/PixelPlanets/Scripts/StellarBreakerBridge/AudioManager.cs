using UnityEngine;

/// <summary>
/// Minimal SFX hub. Generates short procedural tones at runtime (no audio files required),
/// so hooks are always safe even with no assets. Singleton; created by the bootstrap.
/// </summary>
public class AudioManager : MonoBehaviour
{
    public static AudioManager Instance { get; private set; }

    [SerializeField] private bool muted = false;
    public bool Muted { get => muted; set => muted = value; }
    public void ToggleMute() => muted = !muted;

    AudioSource _src;
    AudioClip _tap, _death, _click, _skill, _prestige, _explosion;
    AudioClip _bossStart, _bossTick, _bossFail, _bossDown;

    void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(this); return; }   // component only (shared GO)
        Instance = this;

        _src = gameObject.AddComponent<AudioSource>();
        _src.playOnAwake = false;

        _tap      = Tone(880f, 0.05f);
        _death    = Tone(196f, 0.20f);
        _click    = Tone(620f, 0.04f);
        _skill    = Tone(1320f, 0.12f);
        _prestige = Tone(330f, 0.45f);
        _explosion = Boom(0.30f);

        _bossStart = Sweep(420f, 900f, 0.30f);   // rising — "incoming"
        _bossTick  = Tone(1046f, 0.05f);         // short high blip — urgency beep
        _bossFail  = Sweep(520f, 160f, 0.35f);   // falling — "failed"
        _bossDown  = Boom(0.55f);                // bigger boom than a normal kill
    }

    static AudioClip Tone(float freq, float dur, int rate = 44100)
    {
        int n = Mathf.Max(1, (int)(rate * dur));
        var data = new float[n];
        for (int i = 0; i < n; i++)
        {
            float t = (float)i / rate;
            float env = Mathf.Clamp01(1f - t / dur);             // linear decay
            data[i] = Mathf.Sin(2f * Mathf.PI * freq * t) * env * 0.6f;
        }
        var clip = AudioClip.Create("tone_" + freq, n, 1, rate, false);
        clip.SetData(data, 0);
        return clip;
    }

    // Layered low thump + filtered noise burst — a punchier "boom" for planet destruction,
    // distinct from the plain tones above. Still fully procedural, no assets required.
    static AudioClip Boom(float dur, int rate = 44100)
    {
        int n = Mathf.Max(1, (int)(rate * dur));
        var data = new float[n];
        var rng = new System.Random(12345);
        for (int i = 0; i < n; i++)
        {
            float t = (float)i / rate;
            float env = Mathf.Pow(Mathf.Clamp01(1f - t / dur), 1.6f);   // fast-ish decay
            float thump = Mathf.Sin(2f * Mathf.PI * 90f * t) * 0.8f;
            float noise = ((float)rng.NextDouble() * 2f - 1f) * 0.5f;
            data[i] = (thump + noise) * env * 0.55f;
        }
        var clip = AudioClip.Create("boom", n, 1, rate, false);
        clip.SetData(data, 0);
        return clip;
    }

    // Linear frequency sweep — used for boss start (rising, "incoming") and boss fail
    // (falling, "failed"). Same procedural approach as Tone/Boom, no assets required.
    static AudioClip Sweep(float fromFreq, float toFreq, float dur, int rate = 44100)
    {
        int n = Mathf.Max(1, (int)(rate * dur));
        var data = new float[n];
        float phase = 0f;
        for (int i = 0; i < n; i++)
        {
            float u = (float)i / n;
            float freq = Mathf.Lerp(fromFreq, toFreq, u);
            phase += freq / rate;
            float env = Mathf.Clamp01(1f - u) * Mathf.Clamp01(u * 12f);   // quick fade-in, linear fade-out
            data[i] = Mathf.Sin(2f * Mathf.PI * phase) * env * 0.6f;
        }
        var clip = AudioClip.Create("sweep_" + fromFreq + "_" + toFreq, n, 1, rate, false);
        clip.SetData(data, 0);
        return clip;
    }

    void Play(AudioClip c, float vol)
    {
        if (!muted && c != null && _src != null) _src.PlayOneShot(c, vol);
    }

    public void Tap()      => Play(_tap, 0.20f);
    public void Death()    => Play(_death, 0.45f);
    public void Click()    => Play(_click, 0.30f);
    public void Skill()    => Play(_skill, 0.40f);
    public void Prestige() => Play(_prestige, 0.55f);
    public void Explosion() => Play(_explosion, 0.55f);
    public void BossStart() => Play(_bossStart, 0.60f);
    public void BossTick()  => Play(_bossTick, 0.35f);
    public void BossFail()  => Play(_bossFail, 0.55f);
    public void BossDown()  => Play(_bossDown, 0.70f);
}
