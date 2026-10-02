import { GAME_RULES } from "@eternal-realm/game-data";
import type { ProgressionResult } from "@eternal-realm/shared-types";

export function experienceToNextLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level >= 100) {
    throw new RangeError("Level must be an integer from 1 to 99.");
  }

  return Math.round(100_000 * level ** 1.35);
}

export function calculateMonsterExperience(baseExperience: number): number {
  return Math.round(baseExperience * GAME_RULES.expMultiplier);
}

export function applyExperience(level: number, experience: number, gainedExperience: number): ProgressionResult {
  let nextLevel = level;
  let nextExperience = experience + Math.max(0, gainedExperience);
  let levelsGained = 0;

  while (nextLevel < 100) {
    const required = experienceToNextLevel(nextLevel);
    if (nextExperience < required) break;

    nextExperience -= required;
    nextLevel += 1;
    levelsGained += 1;
  }

  if (nextLevel === 100) {
    nextExperience = 0;
  }

  return {
    level: nextLevel,
    experience: nextExperience,
    levelsGained,
    experienceToNextLevel: nextLevel === 100 ? null : experienceToNextLevel(nextLevel)
  };
}
