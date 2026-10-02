import { CLASS_DEFINITIONS, DEFAULT_EQUIPMENT, GAME_RULES } from "@eternal-realm/game-data";
import type {
  CharacterBuild,
  CharacterClass,
  DerivedStats,
  EquipmentStats,
  PrimaryStats
} from "@eternal-realm/shared-types";
import { clamp, round } from "./math.js";

export function createCharacter(
  characterClass: CharacterClass,
  name = CLASS_DEFINITIONS[characterClass].label,
  level = 1
): CharacterBuild {
  const definition = CLASS_DEFINITIONS[characterClass];

  return {
    id: "local-player",
    name,
    class: characterClass,
    level,
    primary: { ...definition.primary },
    equipment: { ...DEFAULT_EQUIPMENT }
  };
}

export function deriveStats(character: CharacterBuild): DerivedStats {
  const definition = CLASS_DEFINITIONS[character.class];
  const { level, primary, equipment } = character;

  return {
    maxHp: calculateMaxHp(definition.baseHp, definition.hpGrowth, level, primary, equipment),
    maxMp: calculateMaxMp(definition.baseMp, definition.mpGrowth, level, primary, equipment),
    physicalAttack: round(
      equipment.weaponAttack + primary.strength * 2 + primary.dexterity * 0.5 + level * 1.5 + equipment.flatAttack
    ),
    rangedAttack: round(
      equipment.weaponAttack + primary.dexterity * 2.2 + primary.strength * 0.3 + level * 1.5 + equipment.flatAttack
    ),
    darkElfAttack: round(
      equipment.weaponAttack + primary.dexterity * 1.4 + primary.strength * 1.2 + level * 1.5 + equipment.flatAttack
    ),
    magicAttack: round(
      equipment.weaponMagicPower + primary.intelligence * 3 + primary.wisdom * 0.6 + level * 1.8 + equipment.flatSpellPower
    ),
    physicalDefense: round(equipment.armorDefense + primary.constitution * 1.5 + level * 0.8),
    magicDefense: round(
      equipment.equipmentMagicDefense + primary.wisdom * 1.5 + primary.intelligence * 0.4 + level * 0.8
    ),
    accuracy: round(100 + level * 2 + primary.dexterity * 2 + equipment.accuracy),
    evasion: round(level * 1.5 + primary.dexterity * 1.5 + equipment.evasion),
    criticalChance: round(
      clamp(
        definition.baseCriticalChance +
          primary.dexterity * 0.0008 +
          primary.luck * 0.0005 +
          equipment.criticalChance,
        0,
        GAME_RULES.maxCriticalChance
      ),
      4
    ),
    criticalDamage: definition.criticalDamage,
    attacksPerSecond: round(
      Math.min(
        GAME_RULES.maxAttacksPerSecond,
        definition.baseAttacksPerSecond * (1 + primary.dexterity * 0.003 + equipment.attackSpeedPercent)
      ),
      3
    )
  };
}

function calculateMaxHp(
  baseHp: number,
  hpGrowth: number,
  level: number,
  primary: PrimaryStats,
  equipment: EquipmentStats
): number {
  return Math.round(baseHp + hpGrowth * (level - 1) + primary.constitution * 8 + equipment.hp);
}

function calculateMaxMp(
  baseMp: number,
  mpGrowth: number,
  level: number,
  primary: PrimaryStats,
  equipment: EquipmentStats
): number {
  return Math.round(
    baseMp + mpGrowth * (level - 1) + primary.wisdom * 8 + primary.intelligence * 2 + equipment.mp
  );
}
