import { describe, expect, it } from "vitest";
import type { Combatant } from "@eternal-realm/shared-types";
import { basicAttack, calculateDamageReduction, calculateHitChance, skillAttack } from "../src/index.js";

const attacker: Combatant = {
  id: "hero",
  name: "Hero",
  level: 10,
  currentHp: 100,
  stats: {
    physicalAttack: 100,
    magicAttack: 80,
    physicalDefense: 20,
    magicDefense: 20,
    accuracy: 120,
    evasion: 10,
    criticalChance: 0.5,
    criticalDamage: 1.5
  }
};

const target: Combatant = {
  id: "dummy",
  name: "Training Dummy",
  level: 1,
  currentHp: 180,
  stats: {
    physicalAttack: 0,
    magicAttack: 0,
    physicalDefense: 50,
    magicDefense: 50,
    accuracy: 0,
    evasion: 0,
    criticalChance: 0,
    criticalDamage: 1.5
  }
};

function sequence(...values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe("combat engine", () => {
  it("clamps hit chance to 35%-95%", () => {
    expect(calculateHitChance(10_000, 0)).toBe(0.95);
    expect(calculateHitChance(0, 10_000)).toBe(0.35);
  });

  it("caps defense reduction at 75%", () => {
    expect(calculateDamageReduction(1_000_000, 1)).toBe(0.75);
  });

  it("applies defense, random spread, and critical damage", () => {
    const result = basicAttack(attacker, target, "PHYSICAL", sequence(0, 0.5, 0));

    expect(result.hit).toBe(true);
    expect(result.critical).toBe(true);
    expect(result.damage).toBe(120);
    expect(result.remainingHp).toBe(60);
    expect(result.killed).toBe(false);
  });

  it("reports misses without changing health", () => {
    const result = basicAttack(attacker, target, "PHYSICAL", () => 0.99);

    expect(result.hit).toBe(false);
    expect(result.damage).toBe(0);
    expect(result.remainingHp).toBe(180);
  });

  it("marks a target dead at zero health", () => {
    const weakenedTarget = { ...target, currentHp: 50 };
    const result = basicAttack(attacker, weakenedTarget, "PHYSICAL", sequence(0, 0.5, 0));

    expect(result.remainingHp).toBe(0);
    expect(result.killed).toBe(true);
  });

  it("applies skill multiplier and flat damage before defense", () => {
    const result = skillAttack(attacker, target, "MAGICAL", 1.5, 20, sequence(0, 0.5, 0.9));

    expect(result.hit).toBe(true);
    expect(result.critical).toBe(false);
    expect(result.damage).toBe(112);
    expect(result.remainingHp).toBe(68);
  });
});
