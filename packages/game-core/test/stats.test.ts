import { describe, expect, it } from "vitest";
import { createCharacter, deriveStats } from "../src/index.js";

describe("character stats", () => {
  it("creates all four classes", () => {
    expect(createCharacter("KNIGHT").class).toBe("KNIGHT");
    expect(createCharacter("ELF").class).toBe("ELF");
    expect(createCharacter("MAGE").class).toBe("MAGE");
    expect(createCharacter("DARK_ELF").class).toBe("DARK_ELF");
  });

  it("matches the Stage 03 level-one Knight formulas", () => {
    const stats = deriveStats(createCharacter("KNIGHT"));

    expect(stats.maxHp).toBe(364);
    expect(stats.maxMp).toBe(146);
    expect(stats.physicalAttack).toBe(54.5);
    expect(stats.physicalDefense).toBe(35.8);
    expect(stats.criticalChance).toBe(0.062);
    expect(stats.attacksPerSecond).toBe(1.03);
  });

  it("matches the Stage 03 level-one Mage MP example", () => {
    expect(deriveStats(createCharacter("MAGE")).maxMp).toBe(404);
  });
});
