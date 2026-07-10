// Ported from Assets/PixelPlanets/Scripts/StellarBreakerBridge/AudioManager.cs.
// Same procedural synthesis approach (Tone/Boom/Sweep, no audio files) via Web Audio API
// instead of AudioClip.Create/AudioSource.PlayOneShot.
import { prefs } from '../prefs'

let ctx: AudioContext | null = null
let muted = prefs.sfxMuted
let musicMuted = prefs.musicMuted

// Death Silence / Calm Before Destruction (#46, #64): a brief hush before a big finisher sound
// lands, so the boom actually reads as an impact instead of blending into constant tap/impact
// chatter. Everything is suppressed except the whitelisted "finisher" clips.
let silencedUntil = 0
const FINISHER_CLIPS = new Set(['bossDown', 'explosion', 'overdriveEnd', 'prestige'])

interface Clip {
  buffer: Float32Array<ArrayBuffer>
  sampleRate: number
}

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, dur: number, sampleRate = 44100): Clip {
  const n = Math.max(1, Math.floor(sampleRate * dur))
  const data = new Float32Array(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.min(1, Math.max(0, 1 - t / dur)) // linear decay
    data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.6
  }
  return { buffer: data, sampleRate }
}

// Layered low thump + filtered noise burst - a punchier "boom" for planet destruction.
function boom(dur: number, sampleRate = 44100): Clip {
  const n = Math.max(1, Math.floor(sampleRate * dur))
  const data = new Float32Array(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.pow(Math.min(1, Math.max(0, 1 - t / dur)), 1.6) // fast-ish decay
    const thump = Math.sin(2 * Math.PI * 90 * t) * 0.8
    const noise = (Math.random() * 2 - 1) * 0.5
    data[i] = (thump + noise) * env * 0.55
  }
  return { buffer: data, sampleRate }
}

// Linear frequency sweep - used for boss start (rising, "incoming") and boss fail (falling).
function sweep(fromFreq: number, toFreq: number, dur: number, sampleRate = 44100): Clip {
  const n = Math.max(1, Math.floor(sampleRate * dur))
  const data = new Float32Array(new ArrayBuffer(n * 4))
  let phase = 0
  for (let i = 0; i < n; i++) {
    const u = i / n
    const freq = fromFreq + (toFreq - fromFreq) * u
    phase += freq / sampleRate
    const env = Math.min(1, Math.max(0, 1 - u)) * Math.min(1, Math.max(0, u * 12)) // quick fade-in, linear fade-out
    data[i] = Math.sin(2 * Math.PI * phase) * env * 0.6
  }
  return { buffer: data, sampleRate }
}

// Filtered-ish white noise (decayPow shapes the envelope: higher = punchier/shorter feeling
// hiss, lower = a softer, longer breath) - the base for gas/lava material impact variants.
function noise(dur: number, decayPow: number, sampleRate = 44100): Clip {
  const n = Math.max(1, Math.floor(sampleRate * dur))
  const data = new Float32Array(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.pow(Math.min(1, Math.max(0, 1 - t / dur)), decayPow)
    data[i] = (Math.random() * 2 - 1) * env * 0.5
  }
  return { buffer: data, sampleRate }
}

// Two close, slightly detuned sines - the inharmonic beating reads as metallic/clangy.
function metallic(freq: number, dur: number, sampleRate = 44100): Clip {
  const n = Math.max(1, Math.floor(sampleRate * dur))
  const data = new Float32Array(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const env = Math.pow(Math.min(1, Math.max(0, 1 - t / dur)), 0.6)
    const a = Math.sin(2 * Math.PI * freq * t)
    const b = Math.sin(2 * Math.PI * freq * 1.5 * t)
    data[i] = (a * 0.6 + b * 0.4) * env * 0.5
  }
  return { buffer: data, sampleRate }
}

// Two short notes back to back, each with its own quick decay - an ascending "cha-ching"
// for purchases/upgrades, distinct from the single-note click/skill/tap tones.
function twoTone(freq1: number, freq2: number, noteDur: number, sampleRate = 44100): Clip {
  const n = Math.max(1, Math.floor(sampleRate * noteDur * 2))
  const data = new Float32Array(new ArrayBuffer(n * 4))
  const noteSamples = Math.floor(sampleRate * noteDur)
  for (let i = 0; i < n; i++) {
    const noteIndex = i < noteSamples ? 0 : 1
    const freq = noteIndex === 0 ? freq1 : freq2
    const t = (i - noteIndex * noteSamples) / sampleRate
    const env = Math.min(1, Math.max(0, 1 - t / noteDur))
    data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.6
  }
  return { buffer: data, sampleRate }
}

/** Ascending combo-ladder tones, one per tier (5-tap steps) - every few combo levels adds a
 *  new note, capped at COMBO_TIER_CLIPS.length so pitch doesn't climb forever. */
const COMBO_TIER_CLIPS = 8
function comboTierClipName(tier: number): string {
  return `comboTier${Math.min(Math.max(1, tier), COMBO_TIER_CLIPS)}`
}

let clips: Record<string, Clip> | null = null

function getClips(): Record<string, Clip> {
  if (clips) return clips
  clips = {
    tap: tone(880, 0.05),
    death: tone(196, 0.2),
    click: tone(620, 0.04),
    skill: tone(1320, 0.12),
    prestige: tone(330, 0.45),
    explosion: boom(0.3),
    bossStart: sweep(420, 900, 0.3), // rising - "incoming"
    bossTick: tone(1046, 0.05), // short high blip - urgency beep
    bossFail: sweep(520, 160, 0.35), // falling - "failed"
    bossDown: boom(0.55), // bigger boom than a normal kill
    purchase: twoTone(660, 990, 0.07), // ascending "cha-ching" for ship/artifact buys
    // Material-based tap impact variants (see planet/planetProfiles.ts's 6 kinds) - short
    // (<80ms) so rapid tapping doesn't smear into mush.
    impactRock: boom(0.07), // noAtmosphere - thump + crunch
    impactWet: tone(520, 0.06), // terranWet - duller, softer thud
    impactIce: tone(1700, 0.045), // iceWorld - high, brief, crystalline
    impactGas: noise(0.09, 2.2), // gasGiant - soft airy whoosh, no tone
    impactLava: noise(0.08, 0.9), // lavaWorld - hissier/crackly, slower decay
    impactMetal: metallic(700, 0.06), // asteroid - inharmonic clank
    // Overdrive Barrage juice (rides the real skill buff window, not a fake mechanic).
    overdriveStart: sweep(500, 1500, 0.22), // fast rising sweep on activation
    overdriveBeat: tone(900, 0.06), // 3-2-1 countdown pip
    overdriveGo: twoTone(1100, 1650, 0.08), // "OVERDRIVE" text landing
    overdriveEnd: boom(0.35), // final-blast on natural expiry
    packTear: noise(0.24, 1.3), // foil-wrapper rip for the pack-opening ceremony
    packBurst: boom(0.5), // the wrapper explodes
    dealWhoosh: sweep(300, 950, 0.11), // a card flying into position
    cardLift: tone(1250, 0.035), // picking a card up off the stack
    cardLand: tone(190, 0.07), // the card thumping back down
  }
  for (let tier = 1; tier <= COMBO_TIER_CLIPS; tier++) {
    // ~12% frequency step per tier - a pleasant ascending run, not a harsh chromatic climb.
    clips[comboTierClipName(tier)] = tone(660 * Math.pow(1.12, tier - 1), 0.05)
  }
  return clips
}

function play(name: keyof ReturnType<typeof getClips>, volume: number): void {
  if (muted) return
  if (performance.now() < silencedUntil && !FINISHER_CLIPS.has(name)) return
  const clip = getClips()[name]
  const audioCtx = getContext()
  const buffer = audioCtx.createBuffer(1, clip.buffer.length, clip.sampleRate)
  buffer.copyToChannel(clip.buffer, 0)

  const source = audioCtx.createBufferSource()
  source.buffer = buffer
  const gain = audioCtx.createGain()
  gain.gain.value = volume
  source.connect(gain)
  gain.connect(audioCtx.destination)
  source.start()
}

export const audio = {
  get muted() {
    return muted
  },
  set muted(value: boolean) {
    muted = value
    prefs.sfxMuted = value
  },
  get musicMuted() {
    return musicMuted
  },
  set musicMuted(value: boolean) {
    musicMuted = value
    prefs.musicMuted = value
  },

  tap: () => play('tap', 0.2),
  death: () => play('death', 0.45),
  click: () => play('click', 0.3),
  skill: () => play('skill', 0.4),
  prestige: () => play('prestige', 0.55),
  explosion: () => play('explosion', 0.55),
  bossStart: () => play('bossStart', 0.6),
  bossTick: () => play('bossTick', 0.35),
  bossFail: () => play('bossFail', 0.55),
  bossDown: () => play('bossDown', 0.7),
  purchase: () => play('purchase', 0.45),
  impactRock: () => play('impactRock', 0.35),
  impactWet: () => play('impactWet', 0.3),
  impactIce: () => play('impactIce', 0.28),
  impactGas: () => play('impactGas', 0.3),
  impactLava: () => play('impactLava', 0.32),
  impactMetal: () => play('impactMetal', 0.3),
  combo: (tier: number) => play(comboTierClipName(tier), 0.22),
  overdriveStart: () => play('overdriveStart', 0.55),
  overdriveBeat: () => play('overdriveBeat', 0.4),
  overdriveGo: () => play('overdriveGo', 0.55),
  overdriveEnd: () => play('overdriveEnd', 0.5),
  packTear: () => play('packTear', 0.5),
  packBurst: () => play('packBurst', 0.65),
  dealWhoosh: () => play('dealWhoosh', 0.3),
  cardLift: () => play('cardLift', 0.3),
  cardLand: () => play('cardLand', 0.4),
  /** Hushes every non-finisher sound for `ms` - call right before a finisher clip for a beat of silence first. */
  silence: (ms: number) => {
    silencedUntil = performance.now() + ms
  },
}
