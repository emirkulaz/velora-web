/**
 * Original cinematic login sting for the post-auth startup screen.
 * Inspired by the feel of game client boot sounds — not a copy of any
 * third-party asset (including League of Legends / Riot Games audio).
 */

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext
}

let sharedContext: AudioContext | null = null
let playedForSession = false

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (sharedContext) return sharedContext

  const Win = window as WindowWithWebkitAudio
  const Ctor = window.AudioContext ?? Win.webkitAudioContext
  if (!Ctor) return null

  sharedContext = new Ctor()
  return sharedContext
}

/** Call synchronously inside a user gesture (login submit / MFA / quick login). */
export function unlockStartupSound(): void {
  playedForSession = false
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined)
  }
}

function createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

/**
 * Soft whoosh + low swell + bright harmonic bloom — LoL-client-adjacent vibe.
 * Plays at most once per browser tab session.
 */
export function playStartupSound(): void {
  if (playedForSession) return
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  const ctx = getAudioContext()
  if (!ctx) return

  playedForSession = true
  const startAt = ctx.currentTime + 0.02

  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, startAt)
  master.gain.exponentialRampToValueAtTime(0.55, startAt + 0.18)
  master.gain.exponentialRampToValueAtTime(0.0001, startAt + 3.4)
  master.connect(ctx.destination)

  // Low cinematic bed
  const bass = ctx.createOscillator()
  const bassGain = ctx.createGain()
  bass.type = 'sine'
  bass.frequency.setValueAtTime(55, startAt)
  bass.frequency.exponentialRampToValueAtTime(72, startAt + 1.6)
  bassGain.gain.setValueAtTime(0.0001, startAt)
  bassGain.gain.exponentialRampToValueAtTime(0.28, startAt + 0.45)
  bassGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 2.8)
  bass.connect(bassGain)
  bassGain.connect(master)
  bass.start(startAt)
  bass.stop(startAt + 3)

  // Rising whoosh (filtered noise)
  const noise = ctx.createBufferSource()
  noise.buffer = createNoiseBuffer(ctx, 2.4)
  const noiseFilter = ctx.createBiquadFilter()
  noiseFilter.type = 'bandpass'
  noiseFilter.Q.value = 0.7
  noiseFilter.frequency.setValueAtTime(280, startAt)
  noiseFilter.frequency.exponentialRampToValueAtTime(2400, startAt + 1.1)
  noiseFilter.frequency.exponentialRampToValueAtTime(600, startAt + 2.2)
  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.0001, startAt)
  noiseGain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.35)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 2.2)
  noise.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(master)
  noise.start(startAt)
  noise.stop(startAt + 2.4)

  // Bright “portal open” harmonics
  const partials: Array<{ freq: number; delay: number; peak: number }> = [
    { freq: 392, delay: 0.12, peak: 0.12 },
    { freq: 523.25, delay: 0.28, peak: 0.14 },
    { freq: 659.25, delay: 0.48, peak: 0.1 },
    { freq: 784, delay: 0.72, peak: 0.07 },
  ]

  for (const partial of partials) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const t0 = startAt + partial.delay
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(partial.freq, t0)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(partial.peak, t0 + 0.12)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6)
    osc.connect(gain)
    gain.connect(master)
    osc.start(t0)
    osc.stop(t0 + 1.8)
  }

  void ctx.resume().catch(() => undefined)
}
