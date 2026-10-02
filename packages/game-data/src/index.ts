import type { CharacterClass, DamageKind, MonsterDefinition, PrimaryStats } from "@eternal-realm/shared-types";

export interface ClassDefinition {
  class: CharacterClass;
  label: string;
  role: string;
  primary: PrimaryStats;
  baseHp: number;
  hpGrowth: number;
  baseMp: number;
  mpGrowth: number;
  baseCriticalChance: number;
  criticalDamage: number;
  baseAttacksPerSecond: number;
}

export interface SignatureSkillDefinition {
  name: string;
  mpCost: number;
  cooldownMs: number;
  multiplier: number;
  flatDamage: number;
  range: number;
  damageKind: DamageKind;
  color: number;
  area: boolean;
}

export const GAME_RULES = {
  expMultiplier: 1_000,
  rareTreasureMultiplier: 100,
  bossTreasureChance: 1,
  combatTicksPerSecond: 20,
  randomDamageMin: 0.9,
  randomDamageMax: 1.1,
  maxDamageReduction: 0.75,
  minHitChance: 0.35,
  maxHitChance: 0.95,
  maxCriticalChance: 0.75,
  maxAttacksPerSecond: 2.5
} as const;

export const CLASS_DEFINITIONS: Record<CharacterClass, ClassDefinition> = {
  KNIGHT: {
    class: "KNIGHT",
    label: "Knight",
    role: "High-health melee vanguard",
    primary: { strength: 18, dexterity: 10, constitution: 18, intelligence: 6, wisdom: 8, luck: 8 },
    baseHp: 220,
    hpGrowth: 28,
    baseMp: 70,
    mpGrowth: 5,
    baseCriticalChance: 0.05,
    criticalDamage: 1.5,
    baseAttacksPerSecond: 1
  },
  ELF: {
    class: "ELF",
    label: "Elf",
    role: "Accurate ranged elemental fighter",
    primary: { strength: 10, dexterity: 18, constitution: 11, intelligence: 10, wisdom: 13, luck: 10 },
    baseHp: 150,
    hpGrowth: 20,
    baseMp: 120,
    mpGrowth: 10,
    baseCriticalChance: 0.07,
    criticalDamage: 1.5,
    baseAttacksPerSecond: 1.1
  },
  MAGE: {
    class: "MAGE",
    label: "Mage",
    role: "High-burst arcane caster",
    primary: { strength: 6, dexterity: 10, constitution: 9, intelligence: 20, wisdom: 18, luck: 8 },
    baseHp: 110,
    hpGrowth: 15,
    baseMp: 220,
    mpGrowth: 22,
    baseCriticalChance: 0.04,
    criticalDamage: 1.6,
    baseAttacksPerSecond: 0.9
  },
  DARK_ELF: {
    class: "DARK_ELF",
    label: "Dark Elf",
    role: "Fast critical melee assassin",
    primary: { strength: 13, dexterity: 20, constitution: 10, intelligence: 8, wisdom: 10, luck: 14 },
    baseHp: 140,
    hpGrowth: 18,
    baseMp: 100,
    mpGrowth: 8,
    baseCriticalChance: 0.1,
    criticalDamage: 1.75,
    baseAttacksPerSecond: 1.2
  }
};

export const CLASS_SIGNATURE_SKILLS: Record<CharacterClass, SignatureSkillDefinition> = {
  KNIGHT: {
    name: "Shield Bash",
    mpCost: 12,
    cooldownMs: 4_000,
    multiplier: 1.65,
    flatDamage: 12,
    range: 125,
    damageKind: "PHYSICAL",
    color: 0xf1d27f,
    area: false
  },
  ELF: {
    name: "Piercing Arrow",
    mpCost: 16,
    cooldownMs: 3_500,
    multiplier: 1.75,
    flatDamage: 8,
    range: 330,
    damageKind: "PHYSICAL",
    color: 0x78e5a5,
    area: false
  },
  MAGE: {
    name: "Arcane Burst",
    mpCost: 24,
    cooldownMs: 4_500,
    multiplier: 1.9,
    flatDamage: 18,
    range: 300,
    damageKind: "MAGICAL",
    color: 0x9c8cff,
    area: false
  },
  DARK_ELF: {
    name: "Shadow Strike",
    mpCost: 18,
    cooldownMs: 3_000,
    multiplier: 1.85,
    flatDamage: 10,
    range: 145,
    damageKind: "PHYSICAL",
    color: 0xd575ff,
    area: false
  }
};

export const CLASS_SKILLS: Record<CharacterClass, readonly SignatureSkillDefinition[]> = {
  KNIGHT: [
    CLASS_SIGNATURE_SKILLS.KNIGHT,
    { name: "Whirlwind", mpCost: 22, cooldownMs: 6_000, multiplier: 1.4, flatDamage: 8, range: 155, damageKind: "PHYSICAL", color: 0xffb85c, area: true },
    { name: "Heroic Cleave", mpCost: 30, cooldownMs: 8_000, multiplier: 2.35, flatDamage: 24, range: 135, damageKind: "PHYSICAL", color: 0xffe2a1, area: false }
  ],
  ELF: [
    CLASS_SIGNATURE_SKILLS.ELF,
    { name: "Arrow Rain", mpCost: 28, cooldownMs: 7_000, multiplier: 1.35, flatDamage: 7, range: 280, damageKind: "PHYSICAL", color: 0x7ff0a6, area: true },
    { name: "Gale Shot", mpCost: 32, cooldownMs: 8_500, multiplier: 2.2, flatDamage: 18, range: 390, damageKind: "PHYSICAL", color: 0xc5ffd2, area: false }
  ],
  MAGE: [
    CLASS_SIGNATURE_SKILLS.MAGE,
    { name: "Frost Nova", mpCost: 34, cooldownMs: 7_500, multiplier: 1.5, flatDamage: 16, range: 190, damageKind: "MAGICAL", color: 0x79d8ff, area: true },
    { name: "Meteor", mpCost: 46, cooldownMs: 10_000, multiplier: 2.65, flatDamage: 32, range: 330, damageKind: "MAGICAL", color: 0xff795c, area: true }
  ],
  DARK_ELF: [
    CLASS_SIGNATURE_SKILLS.DARK_ELF,
    { name: "Fan of Knives", mpCost: 26, cooldownMs: 5_500, multiplier: 1.45, flatDamage: 9, range: 165, damageKind: "PHYSICAL", color: 0xc679ff, area: true },
    { name: "Nightfall", mpCost: 36, cooldownMs: 8_000, multiplier: 2.45, flatDamage: 20, range: 175, damageKind: "PHYSICAL", color: 0x8d5cff, area: false }
  ]
};

export const DEFAULT_EQUIPMENT = {
  weaponAttack: 12,
  weaponMagicPower: 12,
  armorDefense: 8,
  equipmentMagicDefense: 4,
  hp: 0,
  mp: 0,
  flatAttack: 0,
  flatSpellPower: 0,
  accuracy: 0,
  evasion: 0,
  criticalChance: 0,
  attackSpeedPercent: 0
} as const;

export const TRAINING_DUMMY = {
  id: "training-dummy",
  name: "Training Dummy",
  level: 1,
  maxHp: 180,
  physicalDefense: 10,
  magicDefense: 10,
  evasion: 0
} as const;

export const MONSTER_DEFINITIONS = {
  SLIME: {
    id: "slime",
    name: "Meadow Slime",
    rank: "NORMAL",
    level: 1,
    maxHp: 90,
    attack: 13,
    physicalDefense: 4,
    magicDefense: 3,
    moveSpeed: 72,
    attackIntervalMs: 1_400,
    attackRange: 54,
    aggroRange: 250,
    leashRange: 430,
    baseExperience: 20,
    goldMin: 3,
    goldMax: 8,
    baseRareDropChance: 0.001,
    lootName: "Slime Charm",
    color: 0x58d68d
  },
  GOBLIN: {
    id: "goblin",
    name: "Meadow Goblin",
    rank: "NORMAL",
    level: 2,
    maxHp: 125,
    attack: 18,
    physicalDefense: 8,
    magicDefense: 5,
    moveSpeed: 95,
    attackIntervalMs: 1_150,
    attackRange: 58,
    aggroRange: 310,
    leashRange: 500,
    baseExperience: 35,
    goldMin: 6,
    goldMax: 16,
    baseRareDropChance: 0.002,
    lootName: "Goblin Blade",
    color: 0xb6c94b
  },
  WOLF: {
    id: "wolf",
    name: "Grey Wolf",
    rank: "NORMAL",
    level: 3,
    maxHp: 145,
    attack: 21,
    physicalDefense: 7,
    magicDefense: 7,
    moveSpeed: 132,
    attackIntervalMs: 950,
    attackRange: 60,
    aggroRange: 360,
    leashRange: 560,
    baseExperience: 40,
    goldMin: 9,
    goldMax: 24,
    baseRareDropChance: 0.0015,
    lootName: "Wolf Fang Pendant",
    color: 0x9ba7b4
  },
  GOBLIN_CAPTAIN: {
    id: "goblin-captain",
    name: "Goblin Captain — Ruk",
    rank: "ELITE",
    level: 4,
    maxHp: 360,
    attack: 25,
    physicalDefense: 14,
    magicDefense: 10,
    moveSpeed: 104,
    attackIntervalMs: 1_050,
    attackRange: 66,
    aggroRange: 420,
    leashRange: 620,
    baseExperience: 110,
    goldMin: 500,
    goldMax: 800,
    baseRareDropChance: 0.02,
    lootName: "Captain's Warblade",
    color: 0xd77a43
  },
  GOBLIN_KING: {
    id: "goblin-king",
    name: "Goblin King — Gorvak",
    rank: "BOSS",
    level: 5,
    maxHp: 680,
    attack: 28,
    physicalDefense: 18,
    magicDefense: 14,
    moveSpeed: 88,
    attackIntervalMs: 1_300,
    attackRange: 74,
    aggroRange: 520,
    leashRange: 760,
    baseExperience: 250,
    goldMin: 2_000,
    goldMax: 3_500,
    baseRareDropChance: 1,
    lootName: "Gorvak's Royal Treasure",
    color: 0xe2a93b
  }
} as const satisfies Record<string, MonsterDefinition>;

export type MonsterKey = keyof typeof MONSTER_DEFINITIONS;

export type EncounterRole = "HUNT" | "SHARD" | "ELITE" | "BOSS_GUARD" | "BOSS";

export const GREEN_MEADOW_ENCOUNTER = [
  { monster: "SLIME", role: "HUNT", x: 700, y: 430 },
  { monster: "SLIME", role: "HUNT", x: 820, y: 610 },
  { monster: "SLIME", role: "HUNT", x: 980, y: 350 },
  { monster: "GOBLIN", role: "HUNT", x: 1_180, y: 680 },
  { monster: "GOBLIN", role: "SHARD", x: 1_330, y: 420 },
  { monster: "WOLF", role: "SHARD", x: 1_520, y: 720 },
  { monster: "WOLF", role: "SHARD", x: 1_680, y: 470 },
  { monster: "GOBLIN_CAPTAIN", role: "ELITE", x: 1_790, y: 790 },
  { monster: "GOBLIN", role: "BOSS_GUARD", x: 1_900, y: 430 },
  { monster: "GOBLIN", role: "BOSS_GUARD", x: 2_160, y: 720 },
  { monster: "GOBLIN_KING", role: "BOSS", x: 2_020, y: 580 }
] as const satisfies ReadonlyArray<{ monster: MonsterKey; role: EncounterRole; x: number; y: number }>;

export const CLASS_FIRST_KILL_WEAPONS: Record<CharacterClass, string> = {
  KNIGHT: "Gorvak's Kingslayer",
  ELF: "Gorvak's Thorn Bow",
  MAGE: "Gorvak's Ember Staff",
  DARK_ELF: "Gorvak's Twin Fangs"
};

export const GREEN_MEADOW_STORY = {
  chapter: "Chapter I — The First Fracture",
  prologue:
    "For a thousand years, the Eternal Gate kept Eryndor in balance. Tonight, its golden heart cracked—and every creature in Green Meadow heard the same command: claim the shards.",
  opening:
    "You wake near Oakvale with a splinter of golden light beneath your skin. Scout Lyra's last flare burns beyond the meadow, where goblins are gathering around a fallen shard.",
  questAccepted:
    "Lyra points toward Gorvak's camp. Hunt the shard-touched beasts, break the false king's guard, and bring back whatever answers the light beneath your skin.",
  shardHunt:
    "The first creatures fall, revealing three stronger pulses deeper in the meadow. Their fragments must be gathered before Gorvak can bind them to his crown.",
  eliteAwakens:
    "The fragments resonate and expose Captain Ruk, keeper of the camp gate. Defeat him to draw the false king from his throne.",
  midpoint:
    "The beasts carry flecks of the same light. With every victory, the shard inside you remembers a life you have never lived.",
  bossAwakens:
    "Gorvak drives the largest fragment into his armor. The meadow bends around him as the Eternal Gate answers his stolen crown.",
  treasure:
    "The king falls, but his fragment refuses to fade. It waits for a bearer—and recognizes you.",
  victory:
    "A memory returns: you have crossed this meadow before. In every forgotten age, the road ended at the Gate. This time, you will learn who keeps resetting the world.",
  epilogue:
    "Lyra carries Gorvak's fragment back through Oakvale's eastern gate. The village bells ring once for the fallen and twice for the living. Beyond the walls, the Iron March has begun to glow."
} as const;
