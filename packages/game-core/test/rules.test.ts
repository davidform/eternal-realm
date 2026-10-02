import { describe, expect, it } from "vitest";
import { CLASS_SKILLS, GAME_RULES, GREEN_MEADOW_ENCOUNTER } from "@eternal-realm/game-data";
import {
  applyExperience,
  calculateMonsterExperience,
  createBossTreasureRolls,
  experienceToNextLevel,
  rollMonsterRewards,
  scaleRareTreasureWeight
} from "../src/index.js";
import { MONSTER_DEFINITIONS } from "@eternal-realm/game-data";

describe("locked game rules", () => {
  it("keeps EXP x1000", () => {
    expect(calculateMonsterExperience(35)).toBe(35_000);
    expect(GAME_RULES.expMultiplier).toBe(1_000);
  });

  it("keeps rare treasure x100 and at least one boss treasure", () => {
    expect(scaleRareTreasureWeight(0.01)).toBe(1);
    expect(createBossTreasureRolls()).toBe(1);
    expect(GAME_RULES.bossTreasureChance).toBe(1);
  });

  it("uses the level curve from Stage 03", () => {
    expect(experienceToNextLevel(1)).toBe(100_000);
    expect(experienceToNextLevel(10)).toBe(2_238_721);
  });

  it("carries excess experience across level-ups", () => {
    expect(applyExperience(1, 90_000, 45_000)).toEqual({
      level: 2,
      experience: 35_000,
      levelsGained: 1,
      experienceToNextLevel: 254_912
    });
  });

  it("always awards boss treasure and a class weapon", () => {
    const rewards = rollMonsterRewards(MONSTER_DEFINITIONS.GOBLIN_KING, "MAGE", () => 0.99);

    expect(rewards.some((reward) => reward.kind === "BOSS_TREASURE")).toBe(true);
    expect(rewards.some((reward) => reward.name === "Gorvak's Ember Staff")).toBe(true);
    expect(rewards.find((reward) => reward.kind === "EQUIPMENT")?.power).toBe(24);
  });

  it("gives every class three active skills including an area skill", () => {
    for (const skills of Object.values(CLASS_SKILLS)) {
      expect(skills).toHaveLength(3);
      expect(skills.some((skill) => skill.area)).toBe(true);
      expect(new Set(skills.map((skill) => skill.name)).size).toBe(3);
    }
  });

  it("builds the Green Meadow quest chain with staged encounters", () => {
    expect(GREEN_MEADOW_ENCOUNTER.filter((spawn) => spawn.role === "HUNT")).toHaveLength(4);
    expect(GREEN_MEADOW_ENCOUNTER.filter((spawn) => spawn.role === "SHARD")).toHaveLength(3);
    expect(GREEN_MEADOW_ENCOUNTER.filter((spawn) => spawn.role === "ELITE")).toHaveLength(1);
    expect(GREEN_MEADOW_ENCOUNTER.filter((spawn) => spawn.role === "BOSS_GUARD")).toHaveLength(2);
    expect(GREEN_MEADOW_ENCOUNTER.filter((spawn) => spawn.role === "BOSS")).toHaveLength(1);
  });
});
