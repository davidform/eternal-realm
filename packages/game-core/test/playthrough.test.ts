import { describe, expect, it } from "vitest";
import { MONSTER_DEFINITIONS } from "@eternal-realm/game-data";
import type { MonsterDefinition } from "@eternal-realm/shared-types";
import { applyExperience, calculateMonsterExperience, rollMonsterRewards } from "../src/index.js";

describe("Green Meadow playthrough", () => {
  it("levels the player and ends with guaranteed boss rewards", () => {
    const meadowMonsters: MonsterDefinition[] = [
      MONSTER_DEFINITIONS.SLIME,
      MONSTER_DEFINITIONS.SLIME,
      MONSTER_DEFINITIONS.SLIME,
      MONSTER_DEFINITIONS.GOBLIN,
      MONSTER_DEFINITIONS.GOBLIN,
      MONSTER_DEFINITIONS.WOLF
    ];
    let level = 1;
    let experience = 0;

    for (const monster of meadowMonsters) {
      const progress = applyExperience(level, experience, calculateMonsterExperience(monster.baseExperience));
      level = progress.level;
      experience = progress.experience;
    }

    expect({ level, experience }).toEqual({ level: 2, experience: 70_000 });

    const bossProgress = applyExperience(
      level,
      experience,
      calculateMonsterExperience(MONSTER_DEFINITIONS.GOBLIN_KING.baseExperience)
    );
    const rewards = rollMonsterRewards(MONSTER_DEFINITIONS.GOBLIN_KING, "KNIGHT", () => 0.5);

    expect(bossProgress.level).toBe(3);
    expect(rewards.map((reward) => reward.kind)).toEqual(["GOLD", "BOSS_TREASURE", "EQUIPMENT"]);
    expect(rewards[2]?.name).toBe("Gorvak's Kingslayer");
  });
});
