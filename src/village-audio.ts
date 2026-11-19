import type { World } from "./core/types";
import { daylight } from "./daylight";

const unit = (value: number) => Math.min(1, Math.max(0, value));

export function audioProfile(
  w: Pick<World, "pressure" | "water" | "tick" | "disasters">,
) {
  const strain = unit(Math.max(w.pressure / 100, (1 - w.water / 100) * 0.7));
  const danger = unit((strain - 0.45) / 0.55);
  const events = (w.disasters ?? []).filter((event) => event.life > 0);
  return {
    wind: 0.12 + 0.33 * strain,
    windCutoff: 330 + 750 * strain,
    drone: 0.22 * danger,
    birds: daylight(w.tick) * (1 - unit(strain / 0.55)),
    fire: events.filter((event) => event.kind === "fire").length,
    quake: events.filter((event) => event.kind === "quake").length,
    combat: events.filter((event) => event.kind === "fight").length,
    strike: Math.max(
      -1,
      ...events
        .filter((event) => event.kind === "monster")
        .map((event) => event.attackAt ?? -1),
    ),
  };
}

const initialProfile = {
  wind: 0,
  windCutoff: 330,
  drone: 0,
  birds: 0,
  fire: 0,
  quake: 0,
  combat: 0,
  strike: -1,
};
type AudioProfile = ReturnType<typeof audioProfile>;

export class VillageAudio {
  private readonly master: GainNode;
  private readonly wind: GainNode;
  private readonly windFilter: BiquadFilterNode;
  private readonly drone: GainNode;
  private readonly noise: AudioBuffer;
  private readonly timer: ReturnType<typeof setInterval>;
  private profile: AudioProfile = initialProfile;
  private audible = false;
  private nextBird = 0;
  private nextCrackle = 0;

  private readonly context: AudioContext;

  constructor(c: AudioContext) {
    this.context = c;
    this.master = c.createGain();
    this.master.gain.value = 0;
    this.master.connect(c.destination);

    this.noise = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
    const samples = this.noise.getChannelData(0);
    let smooth = 0;
    for (let i = 0; i < samples.length; i++) {
      smooth = smooth * 0.84 + (Math.random() * 2 - 1) * 0.16;
      samples[i] = smooth;
    }

    const air = c.createBufferSource();
    air.buffer = this.noise;
    air.loop = true;
    this.windFilter = c.createBiquadFilter();
    this.windFilter.type = "lowpass";
    this.windFilter.frequency.value = 330;
    this.wind = c.createGain();
    this.wind.gain.value = 0;
    air.connect(this.windFilter).connect(this.wind).connect(this.master);
    air.start();

    const rumble = c.createOscillator();
    rumble.type = "sine";
    rumble.frequency.value = 49;
    this.drone = c.createGain();
    this.drone.gain.value = 0;
    rumble.connect(this.drone).connect(this.master);
    rumble.start();
    this.timer = setInterval(() => this.playBedDetails(), 170);
  }

  resume() {
    return this.context.resume();
  }

  setMix(volume: number, active: boolean) {
    if (this.context.state === "closed") return;
    this.audible = active && volume > 0;
    this.master.gain.setTargetAtTime(
      this.audible ? unit(volume) * 0.42 : 0,
      this.context.currentTime,
      0.045,
    );
  }

  setWorld(w: World) {
    const next = audioProfile(w);
    const previous = this.profile;
    const now = this.context.currentTime;
    this.wind.gain.setTargetAtTime(next.wind, now, 0.6);
    this.windFilter.frequency.setTargetAtTime(next.windCutoff, now, 0.6);
    this.drone.gain.setTargetAtTime(next.drone, now, 0.9);
    this.profile = next;
    if (!this.audible || this.context.state !== "running") return;
    if (next.quake > previous.quake) this.tone(62, 29, 0.85, 0.24);
    if (next.combat > previous.combat || next.strike > previous.strike)
      this.crackle(170, 0.19, 0.35);
  }

  private playBedDetails() {
    if (!this.audible || this.context.state !== "running") return;
    const now = this.context.currentTime;
    if (this.profile.birds > 0.12 && now >= this.nextBird) {
      this.nextBird = now + 3 + Math.random() * 6;
      const pitch = 1450 + Math.random() * 600;
      this.tone(pitch, pitch * 1.3, 0.12, this.profile.birds * 0.07);
      this.tone(
        pitch * 1.2,
        pitch * 0.95,
        0.15,
        this.profile.birds * 0.045,
        0.15,
      );
    }
    if (this.profile.fire && now >= this.nextCrackle) {
      this.nextCrackle = now + 0.18 + Math.random() * 1.25;
      this.crackle(
        380 + Math.random() * 1150,
        0.08 + Math.random() * 0.07,
        Math.min(0.36, this.profile.fire * 0.16),
      );
    }
  }

  private tone(
    from: number,
    to: number,
    length: number,
    gain: number,
    offset = 0,
  ) {
    const c = this.context;
    const start = c.currentTime + offset;
    const end = start + length;
    const osc = c.createOscillator();
    const envelope = c.createGain();
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(to, end);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(
      gain,
      start + Math.min(0.055, length / 3),
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(envelope).connect(this.master);
    osc.onended = () => {
      osc.disconnect();
      envelope.disconnect();
    };
    osc.start(start);
    osc.stop(end);
  }

  private crackle(frequency: number, length: number, gain: number) {
    const c = this.context;
    const now = c.currentTime;
    const source = c.createBufferSource();
    source.buffer = this.noise;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    const envelope = c.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.linearRampToValueAtTime(gain, now + 0.009);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + length);
    source.connect(filter).connect(envelope).connect(this.master);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
    source.start(now, Math.random() * 2, length);
  }

  dispose() {
    clearInterval(this.timer);
    this.audible = false;
    void this.context.close().catch(() => {});
  }
}
