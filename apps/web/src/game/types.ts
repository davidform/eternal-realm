import type { DerivedStats, LootReward } from "@eternal-realm/shared-types";

export type RunStatus = "READY" | "PLAYING" | "DEFEATED" | "VICTORY";

export interface GameSkillSnapshot {
  name: string;
  mpCost: number;
  ready: boolean;
  area: boolean;
}

export interface QuestStepSnapshot {
  label: string;
  status: "COMPLETE" | "CURRENT" | "LOCKED";
}

export type GameCommand =
  | { id: number; type: "ATTACK" }
  | { id: number; type: "SKILL"; skillIndex: number }
  | { id: number; type: "POTION" }
  | { id: number; type: "EQUIP"; inventoryIndex: number };

export interface GameSnapshot {
  status: RunStatus;
  playerHp: number;
  playerMaxHp: number;
  playerMp: number;
  playerMaxMp: number;
  level: number;
  experience: number;
  experienceToNextLevel: number | null;
  gold: number;
  kills: number;
  stats: DerivedStats;
  objective: string;
  bossHp: number;
  bossMaxHp: number;
  bossUnlocked: boolean;
  bossDefeated: boolean;
  bossPhase: 1 | 2;
  inventory: LootReward[];
  equipped: LootReward | null;
  potions: number;
  skills: GameSkillSnapshot[];
  questAccepted: boolean;
  questSteps: QuestStepSnapshot[];
  storyTitle: string;
  storyText: string;
  combatLog: string[];
}
