import { CLASS_FIRST_KILL_WEAPONS, GAME_RULES } from "@eternal-realm/game-data";
import type { CharacterClass, LootQuality, LootReward, MonsterDefinition } from "@eternal-realm/shared-types";
import type { RandomSource } from "./combat.js";

export function createBossTreasureRolls(randomBonusRolls = 0): number {
  return 1 + Math.max(0, Math.floor(randomBonusRolls));
}

export function scaleRareTreasureWeight(baseWeight: number): number {
  return baseWeight * GAME_RULES.rareTreasureMultiplier;
}

export function rollMonsterRewards(
  monster: MonsterDefinition,
  characterClass: CharacterClass,
  random: RandomSource = Math.random
): LootReward[] {
  const gold = Math.round(monster.goldMin + random() * (monster.goldMax - monster.goldMin));
  const rewards: LootReward[] = [{
    id: `${monster.id}-gold`,
    name: `${gold} Gold`,
    quality: "Normal",
    kind: "GOLD",
    amount: gold
  }];

  if (monster.rank === "BOSS") {
    rewards.push({
      id: `${monster.id}-treasure`,
      name: monster.lootName,
      quality: "Boss",
      kind: "BOSS_TREASURE",
      amount: 1
    });
    rewards.push({
      id: `${monster.id}-class-weapon`,
      name: CLASS_FIRST_KILL_WEAPONS[characterClass],
      quality: "Boss",
      kind: "EQUIPMENT",
      amount: 1,
      power: 24
    });
    return rewards;
  }

  const rareChance = Math.min(1, scaleRareTreasureWeight(monster.baseRareDropChance));
  if (random() < rareChance) {
    const quality = rollQuality(random());
    rewards.push({
      id: `${monster.id}-equipment`,
      name: monster.lootName,
      quality,
      kind: "EQUIPMENT",
      amount: 1,
      power: { Normal: 4, Fine: 8, Excellent: 14, Boss: 24 }[quality]
    });
  }

  return rewards;
}

function rollQuality(roll: number): LootQuality {
  if (roll < 0.08) return "Excellent";
  if (roll < 0.35) return "Fine";
  return "Normal";
}
