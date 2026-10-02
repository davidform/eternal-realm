import type { CharacterClass, LootReward } from "@eternal-realm/shared-types";

export class GameAudio {
  private context: AudioContext | null = null;

  attack(characterClass: CharacterClass) {
    const frequency = { KNIGHT: 150, ELF: 430, MAGE: 620, DARK_ELF: 230 }[characterClass];
    this.tone(frequency, frequency * 0.72, 0.08, characterClass === "MAGE" ? "sine" : "triangle", 0.045);
  }

  skill(characterClass: CharacterClass) {
    const frequency = { KNIGHT: 190, ELF: 520, MAGE: 760, DARK_ELF: 280 }[characterClass];
    this.tone(frequency, frequency * 1.55, 0.2, "sawtooth", 0.055);
    this.tone(frequency * 1.5, frequency * 0.9, 0.24, "sine", 0.035, 0.04);
  }

  hit(critical = false) {
    this.tone(critical ? 210 : 120, 58, critical ? 0.16 : 0.1, "square", critical ? 0.055 : 0.035);
  }

  playerHit() {
    this.tone(105, 46, 0.14, "sawtooth", 0.045);
  }

  pickup(reward: LootReward) {
    const frequency = reward.kind === "GOLD" ? 740 : reward.kind === "BOSS_TREASURE" ? 480 : 560;
    this.tone(frequency, frequency * 1.35, 0.11, "sine", 0.04);
  }

  heal() {
    this.tone(420, 720, 0.24, "sine", 0.04);
  }

  equip() {
    this.tone(260, 390, 0.09, "square", 0.035);
    this.tone(390, 520, 0.12, "triangle", 0.03, 0.06);
  }

  questAccepted() {
    [330, 440, 660].forEach((frequency, index) => this.tone(frequency, frequency, 0.13, "sine", 0.035, index * 0.08));
  }

  levelUp() {
    [392, 523, 659, 784].forEach((frequency, index) => this.tone(frequency, frequency * 1.02, 0.18, "triangle", 0.045, index * 0.07));
  }

  bossSlam() {
    this.tone(82, 34, 0.34, "sawtooth", 0.075);
  }

  bossAwaken() {
    this.tone(110, 42, 0.55, "sawtooth", 0.065);
  }

  victory() {
    [392, 494, 587, 784].forEach((frequency, index) => this.tone(frequency, frequency, 0.28, "triangle", 0.05, index * 0.1));
  }

  private tone(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0
  ) {
    const context = this.getContext();
    if (!context) return;

    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private getContext(): AudioContext | null {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended") void this.context.resume();
      return this.context;
    } catch {
      return null;
    }
  }
}
