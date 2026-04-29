let _ctx: AudioContext | null = null;
function ctx() {
  if (typeof window === "undefined") return null;
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return _ctx;
}

/**
 * Browsers (especially iOS Safari) block AudioContext until a user gesture.
 * Call this once on the first user interaction (tap/click) to "unlock" audio
 * so subsequent playDing() calls (triggered by realtime events) actually play.
 */
let _unlocked = false;
export function unlockAudio() {
  if (_unlocked) return;
  const c = ctx();
  if (!c) return;
  // Resume if suspended (autoplay policy)
  if (c.state === "suspended") {
    void c.resume().catch(() => {});
  }
  // Play a near-silent buffer to fully unlock on iOS
  try {
    const buffer = c.createBuffer(1, 1, 22050);
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    source.start(0);
  } catch {}
  _unlocked = true;
}

export function playDing() {
  const c = ctx();
  if (!c) return;
  if (c.state === "suspended") {
    void c.resume().catch(() => {});
  }
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.frequency.value = 800;
  gain.gain.setValueAtTime(0.3, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.8);
  osc.start();
  osc.stop(c.currentTime + 0.8);
  // Vibration fallback on mobile
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(150);
    }
  } catch {}
}

export function playReviewDing() {
  const c = ctx();
  if (!c) return;
  if (c.state === "suspended") {
    void c.resume().catch(() => {});
  }
  const play = (freq: number, start: number, dur: number) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.25, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.start(start);
    osc.stop(start + dur);
  };
  play(600, c.currentTime, 0.6);
  play(900, c.currentTime + 0.15, 0.5);
}
