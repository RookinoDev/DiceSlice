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
    AudioClip _tap, _death, _click, _skill, _prestige;

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

    void Play(AudioClip c, float vol)
    {
        if (!muted && c != null && _src != null) _src.PlayOneShot(c, vol);
    }

    public void Tap()      => Play(_tap, 0.20f);
    public void Death()    => Play(_death, 0.45f);
    public void Click()    => Play(_click, 0.30f);
    public void Skill()    => Play(_skill, 0.40f);
    public void Prestige() => Play(_prestige, 0.55f);
}
