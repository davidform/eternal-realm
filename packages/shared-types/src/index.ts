export const CHARACTER_CLASSES = ["KNIGHT", "ELF", "MAGE", "DARK_ELF"] as const;

export type CharacterClass = (typeof CHARACTER_CLASSES)[number];

export interface PrimaryStats {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  luck: number;
}

export interface EquipmentStats {
  weaponAttack: number;
  weaponMagicPower: number;
  armorDefense: number;
  equipmentMagicDefense: number;
  hp: number;
  mp: number;
  flatAttack: number;
  flatSpellPower: number;
  accuracy: number;
  evasion: number;
  criticalChance: number;
  attackSpeedPercent: number;
}

export interface CharacterBuild {
  id: string;
  name: string;
  class: CharacterClass;
  level: number;
  primary: PrimaryStats;
  equipment: EquipmentStats;
}

export interface DerivedStats {
  maxHp: number;
  maxMp: number;
  physicalAttack: number;
  rangedAttack: number;
  darkElfAttack: number;
  magicAttack: number;
  physicalDefense: number;
  magicDefense: number;
  accuracy: number;
  evasion: number;
  criticalChance: number;
  criticalDamage: number;
  attacksPerSecond: number;
}

export type DamageKind = "PHYSICAL" | "MAGICAL";

export interface Combatant {
  id: string;
  name: string;
  level: number;
  currentHp: number;
  stats: Pick<
    DerivedStats,
    | "physicalAttack"
    | "magicAttack"
    | "physicalDefense"
    | "magicDefense"
    | "accuracy"
    | "evasion"
    | "criticalChance"
    | "criticalDamage"
  >;
}

export interface AttackResult {
  damage: number;
  remainingHp: number;
  hit: boolean;
  critical: boolean;
  killed: boolean;
  hitChance: number;
  reduction: number;
}

export interface HealthResponse {
  status: "ok";
  service: "eternal-realm-api";
  timestamp: string;
}

export type MonsterRank = "NORMAL" | "ELITE" | "BOSS";
export type LootQuality = "Normal" | "Fine" | "Excellent" | "Boss";

export interface MonsterDefinition {
  id: string;
  name: string;
  rank: MonsterRank;
  level: number;
  maxHp: number;
  attack: number;
  physicalDefense: number;
  magicDefense: number;
  moveSpeed: number;
  attackIntervalMs: number;
  attackRange: number;
  aggroRange: number;
  leashRange: number;
  baseExperience: number;
  goldMin: number;
  goldMax: number;
  baseRareDropChance: number;
  lootName: string;
  color: number;
}

export interface LootReward {
  id: string;
  name: string;
  quality: LootQuality;
  kind: "GOLD" | "EQUIPMENT" | "BOSS_TREASURE" | "QUEST_ITEM";
  amount: number;
  power?: number;
}

export interface ProgressionResult {
  level: number;
  experience: number;
  levelsGained: number;
  experienceToNextLevel: number | null;
}
