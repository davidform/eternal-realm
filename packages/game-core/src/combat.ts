import { GAME_RULES } from "@eternal-realm/game-data";
import type { AttackResult, Combatant, DamageKind } from "@eternal-realm/shared-types";
import { clamp } from "./math.js";

export type RandomSource = () => number;

export function calculateHitChance(accuracy: number, evasion: number): number {
  return clamp(
    0.75 + (accuracy - evasion) * 0.0025,
    GAME_RULES.minHitChance,
    GAME_RULES.maxHitChance
  );
}

export function calculateDamageReduction(defense: number, attackerLevel: number): number {
  const reduction = defense / (defense + 100 + attackerLevel * 10);
  return clamp(reduction, 0, GAME_RULES.maxDamageReduction);
}

export function basicAttack(
  attacker: Combatant,
  target: Combatant,
  kind: DamageKind = "PHYSICAL",
  random: RandomSource = Math.random
): AttackResult {
  return resolveAttack(attacker, target, kind, 1, 0, random);
}

export function skillAttack(
  attacker: Combatant,
  target: Combatant,
  kind: DamageKind,
  multiplier: number,
  flatDamage = 0,
  random: RandomSource = Math.random
): AttackResult {
  return resolveAttack(attacker, target, kind, Math.max(0, multiplier), Math.max(0, flatDamage), random);
}

function resolveAttack(
  attacker: Combatant,
  target: Combatant,
  kind: DamageKind,
  multiplier: number,
  flatDamage: number,
  random: RandomSource
): AttackResult {
  const hitChance = calculateHitChance(attacker.stats.accuracy, target.stats.evasion);
  const hit = random() < hitChance;

  if (!hit) {
    return {
      damage: 0,
      remainingHp: target.currentHp,
      hit: false,
      critical: false,
      killed: false,
      hitChance,
      reduction: 0
    };
  }

  const attackPower = kind === "MAGICAL" ? attacker.stats.magicAttack : attacker.stats.physicalAttack;
  const rawDamage = attackPower * multiplier + flatDamage;
  const defense = kind === "MAGICAL" ? target.stats.magicDefense : target.stats.physicalDefense;
  const reduction = calculateDamageReduction(defense, attacker.level);
  const randomDamage =
    GAME_RULES.randomDamageMin + random() * (GAME_RULES.randomDamageMax - GAME_RULES.randomDamageMin);
  const critical = random() < attacker.stats.criticalChance;
  const criticalModifier = critical ? attacker.stats.criticalDamage : 1;
  const damage = Math.max(1, Math.round(rawDamage * (1 - reduction) * randomDamage * criticalModifier));
  const remainingHp = Math.max(0, target.currentHp - damage);

  return {
    damage,
    remainingHp,
    hit: true,
    critical,
    killed: remainingHp === 0,
    hitChance,
    reduction
  };
}
