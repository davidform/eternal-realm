import Phaser from "phaser";
import {
  applyExperience,
  basicAttack,
  calculateMonsterExperience,
  createCharacter,
  deriveStats,
  experienceToNextLevel,
  rollMonsterRewards,
  skillAttack
} from "@eternal-realm/game-core";
import {
  CLASS_DEFINITIONS,
  CLASS_SKILLS,
  GREEN_MEADOW_ENCOUNTER,
  GREEN_MEADOW_STORY,
  MONSTER_DEFINITIONS,
  type EncounterRole,
  type MonsterKey
} from "@eternal-realm/game-data";
import type {
  CharacterClass,
  Combatant,
  DerivedStats,
  LootReward,
  MonsterDefinition
} from "@eternal-realm/shared-types";
import { GameAudio } from "./GameAudio.js";
import type { GameCommand, GameSnapshot, RunStatus } from "./types.js";

const WORLD_WIDTH = 2_400;
const WORLD_HEIGHT = 1_200;
const PLAYER_START = { x: 330, y: 600 };
const LYRA_POSITION = { x: 470, y: 600 };
const PLAYER_SPEED = 245;
const HUNT_TARGET = 4;
const SHARD_TARGET = 3;
const SIMULATION_STEP_MS = 50;

const HERO_ART: Record<CharacterClass, string> = {
  KNIGHT: `${import.meta.env.BASE_URL}art/hero-knight.png`,
  ELF: `${import.meta.env.BASE_URL}art/hero-elf.png`,
  MAGE: `${import.meta.env.BASE_URL}art/hero-mage.png`,
  DARK_ELF: `${import.meta.env.BASE_URL}art/hero-dark-elf.png`
};

const MONSTER_ART: Record<MonsterKey, string> = {
  SLIME: `${import.meta.env.BASE_URL}art/monster-slime.png`,
  GOBLIN: `${import.meta.env.BASE_URL}art/monster-goblin.png`,
  WOLF: `${import.meta.env.BASE_URL}art/monster-wolf.png`,
  GOBLIN_CAPTAIN: `${import.meta.env.BASE_URL}art/monster-goblin.png`,
  GOBLIN_KING: `${import.meta.env.BASE_URL}art/boss-gorvak.png`
};

const ATTACK_RANGES: Record<CharacterClass, number> = {
  KNIGHT: 112,
  ELF: 265,
  MAGE: 245,
  DARK_ELF: 118
};

type MonsterState = "IDLE" | "CHASE" | "ATTACK" | "RETURN" | "DEAD";
type QuestStage = "MEET_LYRA" | "HUNT" | "SHARDS" | "ELITE" | "BOSS" | "CLAIM" | "COMPLETE";

interface MonsterActor {
  definition: MonsterDefinition;
  role: EncounterRole;
  sprite: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  hpTrack: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  spawnX: number;
  spawnY: number;
  currentHp: number;
  nextAttackAt: number;
  state: MonsterState;
  unlocked: boolean;
  specialReadyAt: number;
  casting: boolean;
  enraged: boolean;
  baseScaleX: number;
  baseScaleY: number;
  actionUntil: number;
}

interface LootActor {
  reward: LootReward;
  sprite: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

interface GameSceneOptions {
  characterClass: CharacterClass;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onRestart: () => void;
}

export class GameScene extends Phaser.Scene {
  private readonly characterClass: CharacterClass;
  private readonly onSnapshot: (snapshot: GameSnapshot) => void;
  private readonly onRestart: () => void;
  private readonly audio = new GameAudio();
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private playerAura!: Phaser.GameObjects.Arc;
  private playerLabel!: Phaser.GameObjects.Text;
  private playerScaleX = 1;
  private playerScaleY = 1;
  private playerActionUntil = 0;
  private keys!: Record<
    "up" | "down" | "left" | "right" | "attack" | "skill1" | "skill2" | "skill3" | "potion" | "interact" | "equip" | "restart",
    Phaser.Input.Keyboard.Key
  >;
  private monsters: MonsterActor[] = [];
  private loot: LootActor[] = [];
  private mapObstacles: Phaser.GameObjects.Rectangle[] = [];
  private boss!: MonsterActor;
  private playerStats!: DerivedStats;
  private playerHp = 0;
  private playerMp = 0;
  private level = 1;
  private experience = 0;
  private gold = 0;
  private kills = 0;
  private huntKills = 0;
  private shardFragments = 0;
  private questStage: QuestStage = "MEET_LYRA";
  private inventory: LootReward[] = [];
  private equipped: LootReward | null = null;
  private equipmentPower = 0;
  private potions = 3;
  private skillReady = [true, true, true];
  private questAccepted = false;
  private lyra!: Phaser.GameObjects.Container;
  private lyraPrompt!: Phaser.GameObjects.Text;
  private nextPlayerAttackAt = 0;
  private lastCombatAt = 0;
  private recoveryPool = 0;
  private manaRecoveryPool = 0;
  private simulationAccumulator = 0;
  private status: RunStatus = "PLAYING";
  private bossDefeated = false;
  private bossTreasureCollected = false;
  private combatLog: string[] = [];

  constructor({ characterClass, onSnapshot, onRestart }: GameSceneOptions) {
    super({ key: "GameScene" });
    this.characterClass = characterClass;
    this.onSnapshot = onSnapshot;
    this.onRestart = onRestart;
  }

  preload() {
    this.load.on("filecomplete", (key: string) => console.info(`[Eternal Realm] loaded ${key}`));
    this.load.on("loaderror", (file: Phaser.Loader.File) => console.error(`[Eternal Realm] failed ${file.key}: ${file.src}`));
    this.load.on("complete", () => console.info("[Eternal Realm] scene assets complete"));
    this.load.image("meadow-ground", `${import.meta.env.BASE_URL}art/green-meadow-ground-v2.png`);
    this.load.image("player-art", HERO_ART[this.characterClass]);
    for (const [monster, path] of Object.entries(MONSTER_ART)) {
      this.load.image(`monster-art-${monster}`, path);
    }
  }

  create() {
    this.createMap();
    this.createPlayer();
    this.createQuestGiver();
    this.createMonsters();
    this.createInput();
    this.configureCamera();
    this.pushLog(`${CLASS_DEFINITIONS[this.characterClass].label} entered Green Meadow.`);
    this.pushLog("Scout Lyra is waiting nearby. Press E to begin the quest chain.");
  }

  update(time: number, delta: number) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.restart) && this.status !== "PLAYING") {
      this.onRestart();
      return;
    }

    if (this.status === "PLAYING") {
      this.updateMovement(time);
      if (Phaser.Input.Keyboard.JustDown(this.keys.attack)) this.attackNearestMonster(time);
      if (Phaser.Input.Keyboard.JustDown(this.keys.skill1)) this.useSkill(0, time);
      if (Phaser.Input.Keyboard.JustDown(this.keys.skill2)) this.useSkill(1, time);
      if (Phaser.Input.Keyboard.JustDown(this.keys.skill3)) this.useSkill(2, time);
      if (Phaser.Input.Keyboard.JustDown(this.keys.potion)) this.usePotion();
      if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) this.interactWithLyra();
      if (Phaser.Input.Keyboard.JustDown(this.keys.equip)) this.equipNewestItem();
    } else {
      this.player.setVelocity(0, 0);
    }

    this.simulationAccumulator += delta;
    while (this.simulationAccumulator >= SIMULATION_STEP_MS) {
      this.updateMonsters(time);
      this.updateLootPickup();
      this.updateRecovery(time);
      this.simulationAccumulator -= SIMULATION_STEP_MS;
    }

    this.updateWorldLabels();
    this.updateQuestPrompt();
  }

  runCommand(command: GameCommand) {
    if (this.status !== "PLAYING") return;
    if (command.type === "ATTACK") this.attackNearestMonster(this.time.now);
    else if (command.type === "SKILL") this.useSkill(command.skillIndex, this.time.now);
    else if (command.type === "POTION") this.usePotion();
    else this.equipItemAt(command.inventoryIndex);
  }

  private createMap() {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor("#101b22");

    this.add.tileSprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, "meadow-ground")
      .setTint(0xa2cbb2)
      .setDepth(-10);
    this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 0x061119, 0.2)
      .setDepth(-9);

    const graphics = this.add.graphics();
    graphics.fillStyle(0x17382d, 0.14);
    graphics.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const drawRoad = (width: number, color: number, alpha: number) => {
      graphics.lineStyle(width, color, alpha);
      graphics.beginPath();
      graphics.moveTo(120, 630);
      graphics.lineTo(720, 580);
      graphics.lineTo(1_240, 610);
      graphics.lineTo(1_720, 560);
      graphics.lineTo(2_160, 580);
      graphics.strokePath();
    };
    drawRoad(124, 0x07100d, 0.3);
    drawRoad(104, 0x8d7448, 0.38);
    drawRoad(4, 0xf2d99c, 0.16);

    graphics.fillStyle(0x23604d, 0.72);
    for (const [x, y, radius] of [
      [210, 260, 150], [520, 980, 180], [890, 170, 190], [1_290, 1_030, 210],
      [1_620, 170, 190], [2_260, 980, 210], [2_330, 170, 160]
    ] as const) graphics.fillCircle(x, y, radius);

    graphics.fillStyle(0x163d43, 0.9);
    graphics.fillEllipse(1_040, 890, 330, 150);
    graphics.lineStyle(4, 0x4c8b78, 0.65);
    graphics.strokeEllipse(1_040, 890, 330, 150);

    graphics.fillStyle(0x244b32, 1);
    for (const [x, y] of [
      [130, 160], [250, 180], [410, 160], [720, 120], [1_040, 150], [1_360, 120],
      [1_590, 150], [1_860, 130], [2_180, 150], [180, 1_030], [410, 1_060],
      [730, 1_020], [1_450, 1_050], [1_790, 1_030], [2_100, 1_050], [2_300, 1_000]
    ] as const) {
      graphics.fillCircle(x, y, 48);
      graphics.fillCircle(x + 34, y + 10, 38);
      graphics.fillRect(x + 12, y + 28, 15, 55);
    }

    graphics.fillStyle(0x4b3024, 0.42);
    graphics.fillCircle(2_020, 580, 270);
    graphics.lineStyle(5, 0xe2a93b, 0.7);
    graphics.strokeCircle(2_020, 580, 270);
    graphics.lineStyle(5, 0xd6b468, 0.82);
    graphics.strokeRect(3, 3, WORLD_WIDTH - 6, WORLD_HEIGHT - 6);

    graphics.fillStyle(0xe27834, 0.9);
    graphics.fillCircle(2_020, 580, 15);
    graphics.lineStyle(3, 0xffc15c, 0.9);
    graphics.strokeCircle(2_020, 580, 34);

    this.add.text(100, 350, "OAKVALE OUTSKIRTS", {
      color: "#b8d9b9",
      fontFamily: "Georgia, serif",
      fontSize: "22px"
    }).setAlpha(0.5);
    this.add.text(810, 760, "MOONMERE POND", {
      color: "#8cc8ca",
      fontFamily: "Georgia, serif",
      fontSize: "18px"
    }).setAlpha(0.5);
    this.add.text(120, 110, "GREEN MEADOW", {
      color: "#92d5a8",
      fontFamily: "Georgia, serif",
      fontSize: "38px"
    }).setAlpha(0.55);
    this.add.text(1_865, 250, "GORVAK'S CAMP", {
      color: "#efc66d",
      fontFamily: "Georgia, serif",
      fontSize: "24px"
    }).setAlpha(0.72);

    this.createAmbientEffects();

    this.createMapObstacle(1_040, 890, 275, 92, 0x163d43, 0.001);
    this.createMapObstacle(705, 315, 150, 30, 0x60442e, 1, -12);
    this.createMapObstacle(1_360, 875, 140, 30, 0x60442e, 1, 14);
    this.createMapObstacle(1_610, 300, 92, 66, 0x696c63);
    this.createMapObstacle(390, 900, 104, 70, 0x696c63);
    this.createMapObstacle(1_900, 790, 155, 28, 0x6b4328, 1, -8);
  }

  private createAmbientEffects() {
    for (const [x, y, width, height] of [
      [420, 320, 330, 110], [850, 970, 420, 120], [1_330, 290, 360, 100], [1_710, 900, 440, 130]
    ] as const) {
      const mist = this.add.ellipse(x, y, width, height, 0xc8f7e8, 0.035)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(1);
      this.tweens.add({
        targets: mist,
        x: x + 55,
        alpha: 0.075,
        scaleX: 1.16,
        duration: 5_400 + x,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut"
      });
    }

    for (let index = 0; index < 24; index += 1) {
      const x = 80 + ((index * 353) % (WORLD_WIDTH - 160));
      const y = 90 + ((index * 197) % (WORLD_HEIGHT - 180));
      const firefly = this.add.circle(x, y, index % 3 === 0 ? 2.1 : 1.4, 0xffe7a1, 0.58)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(2);
      this.tweens.add({
        targets: firefly,
        x: x + 18 + (index % 4) * 9,
        y: y - 14 - (index % 5) * 5,
        alpha: 0.08,
        duration: 1_700 + (index % 7) * 280,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut"
      });
    }

    for (let index = 0; index < 4; index += 1) {
      const ripple = this.add.ellipse(1_040, 890, 85 + index * 42, 28 + index * 14)
        .setStrokeStyle(2, 0x8ae6e1, 0.28 - index * 0.04)
        .setDepth(1);
      this.tweens.add({
        targets: ripple,
        scaleX: 1.22,
        scaleY: 1.22,
        alpha: 0.04,
        duration: 2_200 + index * 380,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut"
      });
    }

    const campGlow = this.add.circle(0, 0, 172, 0xe07832, 0.08)
      .setStrokeStyle(3, 0xffc45f, 0.4);
    const campRing = this.add.circle(0, 0, 118, 0x000000, 0)
      .setStrokeStyle(3, 0xffd477, 0.34);
    const campRunes = this.add.graphics();
    campRunes.lineStyle(3, 0xffbc5c, 0.38);
    for (let index = 0; index < 12; index += 1) {
      const angle = Phaser.Math.DegToRad(index * 30);
      campRunes.lineBetween(Math.cos(angle) * 132, Math.sin(angle) * 132, Math.cos(angle) * 156, Math.sin(angle) * 156);
    }
    this.add.container(2_020, 580, [campGlow, campRing, campRunes])
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(1);
    this.tweens.add({ targets: campRunes, angle: 360, duration: 18_000, repeat: -1 });
    this.tweens.add({ targets: campGlow, alpha: 0.18, scale: 1.08, duration: 1_900, yoyo: true, repeat: -1 });
  }

  private createMapObstacle(x: number, y: number, width: number, height: number, color: number, alpha = 1, angle = 0) {
    const obstacle = this.add.rectangle(x, y, width, height, color, alpha)
      .setStrokeStyle(alpha < 0.01 ? 0 : 3, 0xb69b71, 0.55)
      .setAngle(angle)
      .setDepth(2);
    this.physics.add.existing(obstacle, true);
    (obstacle.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    this.mapObstacles.push(obstacle);
  }

  private createPlayer() {
    this.refreshPlayerStats();
    this.playerHp = this.playerStats.maxHp;
    this.playerMp = this.playerStats.maxMp;
    this.textures.get("player-art").setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.playerShadow = this.add.ellipse(PLAYER_START.x, PLAYER_START.y + 28, 54, 18, 0x020608, 0.5).setDepth(3);
    this.playerAura = this.add.circle(PLAYER_START.x, PLAYER_START.y, 34, 0x6ec8ff, 0.055)
      .setStrokeStyle(2, 0x83d4ff, 0.22)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(3);
    this.tweens.add({ targets: this.playerAura, scale: 1.13, alpha: 0.11, duration: 1_400, yoyo: true, repeat: -1 });
    this.player = this.physics.add.sprite(PLAYER_START.x, PLAYER_START.y, "player-art");
    this.player.setDisplaySize(76, 76).setCollideWorldBounds(true).setDepth(4);
    this.playerScaleX = this.player.scaleX;
    this.playerScaleY = this.player.scaleY;
    for (const obstacle of this.mapObstacles) this.physics.add.collider(this.player, obstacle);
    this.playerLabel = this.add.text(0, 0, CLASS_DEFINITIONS[this.characterClass].label, {
      color: "#f5f7ff",
      fontFamily: "system-ui",
      fontSize: "14px",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(5);
  }

  private createQuestGiver() {
    const glow = this.add.circle(0, 0, 28, 0x69b7ff, 0.16).setStrokeStyle(2, 0x8fd0ff, 0.75);
    const body = this.add.rectangle(0, 3, 18, 34, 0x315b82).setStrokeStyle(2, 0xd8efff, 0.9);
    const head = this.add.circle(0, -20, 9, 0xe8c6a7).setStrokeStyle(1, 0xffffff, 0.8);
    const marker = this.add.text(0, -62, "!", {
      color: "#ffe07e",
      fontFamily: "Georgia, serif",
      fontSize: "30px",
      fontStyle: "bold",
      stroke: "#211b10",
      strokeThickness: 4
    }).setOrigin(0.5);
    const name = this.add.text(0, 35, "Scout Lyra", {
      color: "#bfe4ff",
      fontFamily: "system-ui",
      fontSize: "13px",
      fontStyle: "bold"
    }).setOrigin(0.5, 0);
    this.lyra = this.add.container(LYRA_POSITION.x, LYRA_POSITION.y, [glow, body, head, marker, name]).setDepth(4);
    this.tweens.add({ targets: marker, y: -69, yoyo: true, repeat: -1, duration: 620 });
    this.lyraPrompt = this.add.text(LYRA_POSITION.x, LYRA_POSITION.y - 92, "Press E to speak", {
      color: "#ffffff",
      fontFamily: "system-ui",
      fontSize: "14px",
      fontStyle: "bold",
      backgroundColor: "#0b1424dd",
      padding: { x: 9, y: 5 }
    }).setOrigin(0.5).setDepth(8).setVisible(false);
  }

  private createMonsters() {
    this.monsters = GREEN_MEADOW_ENCOUNTER.map((spawn) => {
      const monsterKey = spawn.monster as MonsterKey;
      const definition = MONSTER_DEFINITIONS[monsterKey];
      const textureKey = `monster-art-${monsterKey}`;
      const spriteSize = definition.rank === "BOSS" ? 142 : definition.rank === "ELITE" ? 106 : monsterKey === "WOLF" ? 88 : 76;
      this.textures.get(textureKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const shadow = this.add.ellipse(spawn.x, spawn.y + spriteSize * 0.32, spriteSize * 0.62, spriteSize * 0.2, 0x020506, 0.46).setDepth(2);
      const sprite = this.physics.add.sprite(spawn.x, spawn.y, textureKey).setDepth(3);
      sprite.setDisplaySize(spriteSize, spriteSize);
      sprite.setCollideWorldBounds(true);
      const unlocked = spawn.role === "HUNT";
      const dormantBoss = spawn.role === "BOSS";
      if (!unlocked) {
        sprite.setAlpha(dormantBoss ? 0.3 : 0).setVisible(dormantBoss);
        shadow.setAlpha(dormantBoss ? 0.16 : 0).setVisible(dormantBoss);
      }

      const label = this.add.text(spawn.x, spawn.y - 45, dormantBoss ? "Dormant Goblin King" : definition.name, {
        color: definition.rank === "BOSS" ? "#ffd477" : definition.rank === "ELITE" ? "#ffae78" : "#e6edf7",
        fontFamily: "system-ui",
        fontSize: definition.rank === "BOSS" ? "16px" : definition.rank === "ELITE" ? "14px" : "12px",
        fontStyle: "bold"
      }).setOrigin(0.5).setDepth(5).setVisible(unlocked || dormantBoss);
      const hpTrack = this.add.rectangle(spawn.x - 30, spawn.y - 31, 60, 5, 0x28151a).setOrigin(0, 0.5).setDepth(5);
      const hpFill = this.add.rectangle(spawn.x - 30, spawn.y - 31, 60, 5, 0xd95162).setOrigin(0, 0.5).setDepth(6);
      hpTrack.setVisible(unlocked);
      hpFill.setVisible(unlocked);

      const actor: MonsterActor = {
        definition,
        role: spawn.role,
        sprite,
        shadow,
        label,
        hpTrack,
        hpFill,
        spawnX: spawn.x,
        spawnY: spawn.y,
        currentHp: definition.maxHp,
        nextAttackAt: 0,
        state: "IDLE",
        unlocked,
        specialReadyAt: 0,
        casting: false,
        enraged: false,
        baseScaleX: sprite.scaleX,
        baseScaleY: sprite.scaleY,
        actionUntil: 0
      };
      if (spawn.role === "BOSS") this.boss = actor;
      return actor;
    });
  }

  private createInput() {
    if (!this.input.keyboard) throw new Error("Keyboard input is unavailable.");
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      attack: Phaser.Input.Keyboard.KeyCodes.SPACE,
      skill1: Phaser.Input.Keyboard.KeyCodes.ONE,
      skill2: Phaser.Input.Keyboard.KeyCodes.TWO,
      skill3: Phaser.Input.Keyboard.KeyCodes.THREE,
      potion: Phaser.Input.Keyboard.KeyCodes.Q,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
      equip: Phaser.Input.Keyboard.KeyCodes.F,
      restart: Phaser.Input.Keyboard.KeyCodes.R
    }) as typeof this.keys;
  }

  private configureCamera() {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(1.08);
  }

  private updateMovement(time: number) {
    const horizontal = Number(this.keys.right.isDown) - Number(this.keys.left.isDown);
    const vertical = Number(this.keys.down.isDown) - Number(this.keys.up.isDown);
    const velocity = new Phaser.Math.Vector2(horizontal, vertical);
    if (velocity.lengthSq() > 0) velocity.normalize().scale(PLAYER_SPEED);
    this.player.setVelocity(velocity.x, velocity.y);
    if (horizontal !== 0) this.player.setFlipX(horizontal < 0);
    if (time < this.playerActionUntil) return;

    const moving = velocity.lengthSq() > 0;
    const phase = Math.sin(time / (moving ? 85 : 420));
    this.player.setAngle(moving ? phase * 2.5 : phase * 0.6);
    this.player.setScale(
      this.playerScaleX * (1 + Math.abs(phase) * (moving ? 0.035 : 0.012)),
      this.playerScaleY * (1 - Math.abs(phase) * (moving ? 0.02 : 0.008))
    );
  }

  private updateMonsters(time: number) {
    for (const actor of this.monsters) {
      if (actor.state === "DEAD" || !actor.unlocked) continue;
      if (this.status !== "PLAYING" || !this.questAccepted) {
        actor.sprite.setVelocity(0, 0);
        this.animateMonster(actor, time);
        continue;
      }

      const distanceToPlayer = Phaser.Math.Distance.Between(actor.sprite.x, actor.sprite.y, this.player.x, this.player.y);
      const distanceFromSpawn = Phaser.Math.Distance.Between(actor.sprite.x, actor.sprite.y, actor.spawnX, actor.spawnY);

      if (actor.definition.rank === "BOSS") {
        if (!actor.enraged && actor.currentHp <= actor.definition.maxHp / 2) {
          actor.enraged = true;
          actor.sprite.setTint(0xff9866);
          this.unlockActors("BOSS_GUARD");
          this.cameras.main.shake(220, 0.003);
          this.pushLog("PHASE II — Gorvak summons two guards and gains Crown Charge!");
        }
        if (actor.casting) {
          actor.sprite.setVelocity(0, 0);
          this.animateMonster(actor, time);
          continue;
        }
        if (time >= actor.specialReadyAt && actor.enraged && distanceToPlayer > 210 && distanceToPlayer <= 430) {
          this.startBossCharge(actor, time);
          continue;
        }
        if (distanceToPlayer <= 210 && time >= actor.specialReadyAt) {
          this.startBossSlam(actor, time);
          continue;
        }
      }

      if (distanceFromSpawn > actor.definition.leashRange) actor.state = "RETURN";
      else if (distanceToPlayer <= actor.definition.attackRange) actor.state = "ATTACK";
      else if (distanceToPlayer <= actor.definition.aggroRange || actor.state === "CHASE") actor.state = "CHASE";
      else if (actor.state === "RETURN" && distanceFromSpawn > 10) actor.state = "RETURN";
      else actor.state = "IDLE";

      if (actor.state === "ATTACK") {
        actor.sprite.setVelocity(0, 0);
        if (time >= actor.nextAttackAt) this.monsterAttack(actor, time);
      } else if (actor.state === "CHASE") {
        this.physics.moveToObject(actor.sprite, this.player, actor.definition.moveSpeed);
      } else if (actor.state === "RETURN") {
        this.physics.moveTo(actor.sprite, actor.spawnX, actor.spawnY, actor.definition.moveSpeed);
        if (distanceFromSpawn <= 10) {
          actor.sprite.setPosition(actor.spawnX, actor.spawnY).setVelocity(0, 0);
          actor.state = "IDLE";
        }
      } else actor.sprite.setVelocity(0, 0);
      this.animateMonster(actor, time);
    }
  }

  private animateMonster(actor: MonsterActor, time: number) {
    if (time < actor.actionUntil) return;
    const moving = actor.state === "CHASE" || actor.state === "RETURN";
    const speed = moving ? 95 : actor.state === "ATTACK" || actor.casting ? 135 : 360;
    const phase = Math.sin(time / speed + actor.spawnX * 0.01);
    if (actor.sprite.body && Math.abs(actor.sprite.body.velocity.x) > 2) {
      actor.sprite.setFlipX(actor.sprite.body.velocity.x < 0);
    }
    actor.sprite.setAngle(phase * (moving ? 3 : actor.casting ? 5 : 1.2));
    actor.sprite.setScale(
      actor.baseScaleX * (1 + Math.abs(phase) * (moving ? 0.035 : 0.018)),
      actor.baseScaleY * (1 - Math.abs(phase) * (moving ? 0.025 : 0.012))
    );
  }

  private attackNearestMonster(time: number) {
    if (!this.questAccepted) {
      this.pushLog("Speak with Scout Lyra before entering the meadow.");
      return;
    }
    if (time < this.nextPlayerAttackAt) return;
    const range = ATTACK_RANGES[this.characterClass];
    const target = this.findNearestMonster(range);

    if (!target) {
      this.pushLog("No enemy in attack range.");
      return;
    }

    const result = basicAttack(
      this.createPlayerCombatant(),
      this.createMonsterCombatant(target),
      this.characterClass === "MAGE" ? "MAGICAL" : "PHYSICAL"
    );
    this.lastCombatAt = time;
    this.nextPlayerAttackAt = time + 1_000 / this.playerStats.attacksPerSecond;
    this.audio.attack(this.characterClass);
    this.animatePlayerAttack(target, time, false);
    this.playAttackEffect(target, this.characterClass === "MAGE" ? 0x9c8cff : 0xffffff);

    if (!result.hit) {
      this.pushLog(`You missed ${target.definition.name}.`);
      return;
    }

    target.currentHp = result.remainingHp;
    this.audio.hit(result.critical);
    this.flashTarget(target.sprite, result.critical ? 0xffdf66 : 0xffffff);
    this.showDamage(target.sprite.x, target.sprite.y - 36, result.damage, result.critical ? "#ffe16e" : "#ffffff");
    this.pushLog(`${result.critical ? "CRIT · " : ""}${result.damage} damage to ${target.definition.name}.`);
    this.updateMonsterHealthBar(target);
    if (result.killed) this.handleMonsterDeath(target);
  }

  private useSkill(skillIndex: number, time: number) {
    if (!this.questAccepted) {
      this.pushLog("Accept Lyra's quest before using combat skills.");
      return;
    }

    const skill = CLASS_SKILLS[this.characterClass][skillIndex];
    if (!skill) return;
    if (!this.skillReady[skillIndex]) {
      this.pushLog(`${skill.name} is still recharging.`);
      return;
    }
    if (this.playerMp < skill.mpCost) {
      this.pushLog(`Not enough MP for ${skill.name}.`);
      return;
    }

    const targets = this.findMonstersInRange(skill.range);
    const primaryTarget = targets[0];
    if (!primaryTarget) {
      this.pushLog(`No enemy in range for ${skill.name}.`);
      return;
    }

    this.playerMp -= skill.mpCost;
    this.skillReady[skillIndex] = false;
    this.lastCombatAt = time;
    this.audio.skill(this.characterClass);
    this.animatePlayerAttack(primaryTarget, time, true);
    const affectedTargets = skill.area ? targets : [primaryTarget];
    let hits = 0;
    let totalDamage = 0;

    for (const target of affectedTargets) {
      const result = skillAttack(
        this.createPlayerCombatant(),
        this.createMonsterCombatant(target),
        skill.damageKind,
        skill.multiplier,
        skill.flatDamage
      );
      this.playSkillEffect(target, skill.color);
      if (!result.hit) continue;

      hits += 1;
      totalDamage += result.damage;
      target.currentHp = result.remainingHp;
      this.showDamage(target.sprite.x, target.sprite.y - 44, result.damage, "#ffe27a");
      this.updateMonsterHealthBar(target);
      if (result.killed) this.handleMonsterDeath(target);
    }

    this.time.delayedCall(skill.cooldownMs, () => {
      this.skillReady[skillIndex] = true;
      this.emitSnapshot();
    });

    this.pushLog(hits > 0 ? `${skill.name} hit ${hits} target${hits > 1 ? "s" : ""} for ${totalDamage} total damage!` : `${skill.name} missed.`);
  }

  private interactWithLyra() {
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, LYRA_POSITION.x, LYRA_POSITION.y);
    if (distance > 150) return;
    if (this.questAccepted) {
      this.pushLog("Lyra: The shard-light is gathering at Gorvak's camp. Stay alert.");
      return;
    }

    this.questAccepted = true;
    this.questStage = "HUNT";
    this.audio.questAccepted();
    const marker = this.lyra.getAt(3) as Phaser.GameObjects.Text;
    marker.setText("✓").setColor("#8ef0b7").setFontSize(24);
    this.cameras.main.flash(220, 86, 154, 211, false);
    this.pushLog(`QUEST I — clear the meadow front (${HUNT_TARGET} enemies).`);
  }

  private usePotion() {
    if (this.potions <= 0) {
      this.pushLog("Your potion belt is empty.");
      return;
    }
    if (this.playerHp >= this.playerStats.maxHp) {
      this.pushLog("Your health is already full.");
      return;
    }

    const restored = Math.max(1, Math.round(this.playerStats.maxHp * 0.35));
    this.playerHp = Math.min(this.playerStats.maxHp, this.playerHp + restored);
    this.potions -= 1;
    this.audio.heal();
    this.player.setTint(0x7dffb2);
    this.time.delayedCall(150, () => this.player.clearTint());
    this.showHealing(this.player.x, this.player.y - 42, restored);
    this.pushLog(`Used a healing potion · ${this.potions} remaining.`);
  }

  private equipNewestItem() {
    const inventoryIndex = this.inventory.findIndex((reward) => reward.kind === "EQUIPMENT");
    if (inventoryIndex < 0) {
      this.pushLog("No equipment is waiting in your loot bag.");
      return;
    }
    this.equipItemAt(inventoryIndex);
  }

  private equipItemAt(inventoryIndex: number) {
    const item = this.inventory[inventoryIndex];
    if (!item || item.kind !== "EQUIPMENT") return;
    if (this.equipped === item) {
      this.pushLog(`${item.name} is already equipped.`);
      return;
    }

    const previousMaxHp = this.playerStats.maxHp;
    this.equipped = item;
    this.equipmentPower = item.power ?? { Normal: 4, Fine: 8, Excellent: 14, Boss: 24 }[item.quality];
    this.audio.equip();
    this.refreshPlayerStats();
    this.playerHp += this.playerStats.maxHp - previousMaxHp;
    this.pushLog(`EQUIPPED — ${item.name} (+${this.equipmentPower} Power).`);
  }

  private findNearestMonster(range: number): MonsterActor | undefined {
    return this.findMonstersInRange(range)[0];
  }

  private findMonstersInRange(range: number): MonsterActor[] {
    return this.monsters
      .filter((actor) => actor.state !== "DEAD" && actor.unlocked)
      .map((actor) => ({
        actor,
        distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, actor.sprite.x, actor.sprite.y)
      }))
      .filter(({ distance }) => distance <= range)
      .sort((left, right) => left.distance - right.distance)
      .map(({ actor }) => actor);
  }

  private startBossSlam(actor: MonsterActor, time: number) {
    actor.casting = true;
    actor.specialReadyAt = time + (actor.enraged ? 4_500 : 6_000);
    this.pushLog(actor.enraged ? "Gorvak prepares an ENRAGED EARTHSHAKE — move!" : "Gorvak prepares EARTHSHAKE — move away!");
    const warning = this.add.circle(actor.sprite.x, actor.sprite.y, 28, 0xc43c32, 0.18)
      .setStrokeStyle(4, 0xff6b57, 0.9)
      .setDepth(2);
    this.tweens.add({ targets: warning, scale: 5.2, alpha: 0.48, duration: 850 });

    this.time.delayedCall(850, () => {
      warning.destroy();
      actor.casting = false;
      if (this.status !== "PLAYING" || actor.state === "DEAD") return;
      this.cameras.main.shake(260, actor.enraged ? 0.008 : 0.005);
      this.audio.bossSlam();
      const distance = Phaser.Math.Distance.Between(actor.sprite.x, actor.sprite.y, this.player.x, this.player.y);
      if (distance > 150) {
        this.pushLog("You escaped the earthshake.");
        return;
      }

      this.applyBossSkillDamage(actor, actor.enraged ? 1.7 : 1.35, "EARTHSHAKE");
    });
  }

  private startBossCharge(actor: MonsterActor, time: number) {
    actor.casting = true;
    actor.specialReadyAt = time + 5_000;
    const targetX = this.player.x;
    const targetY = this.player.y;
    const warning = this.add.graphics().setDepth(2);
    warning.lineStyle(18, 0xff6b57, 0.32);
    warning.lineBetween(actor.sprite.x, actor.sprite.y, targetX, targetY);
    this.tweens.add({ targets: warning, alpha: 0, duration: 420 });
    this.pushLog("CROWN CHARGE — step away from the red path!");

    this.time.delayedCall(420, () => {
      warning.destroy();
      if (this.status !== "PLAYING" || actor.state === "DEAD") {
        actor.casting = false;
        return;
      }
      this.tweens.add({
        targets: actor.sprite,
        x: targetX,
        y: targetY,
        duration: 380,
        ease: "Cubic.In",
        onComplete: () => {
          actor.casting = false;
          if (this.status !== "PLAYING" || actor.state === "DEAD") return;
          this.cameras.main.shake(180, 0.006);
          this.audio.bossSlam();
          const distance = Phaser.Math.Distance.Between(actor.sprite.x, actor.sprite.y, this.player.x, this.player.y);
          if (distance > 105) {
            this.pushLog("You dodged Crown Charge.");
            return;
          }
          this.applyBossSkillDamage(actor, 1.55, "CROWN CHARGE");
        }
      });
    });
  }

  private applyBossSkillDamage(actor: MonsterActor, multiplier: number, skillName: string) {
    const result = skillAttack(
      this.createMonsterCombatant(actor),
      this.createPlayerCombatant(),
      "PHYSICAL",
      multiplier
    );
    if (!result.hit) {
      this.pushLog(`${skillName} missed you.`);
      return;
    }
    this.playerHp = result.remainingHp;
    this.audio.playerHit();
    this.showDamage(this.player.x, this.player.y - 42, result.damage, "#ff725f");
    this.pushLog(`${skillName} hit you for ${result.damage}.`);
    if (result.killed) {
      this.status = "DEFEATED";
      this.player.setTint(0x555555).setAlpha(0.55).setVelocity(0, 0);
      this.pushLog("You were defeated. Press R or choose New Run.");
    } else this.emitSnapshot();
  }

  private animatePlayerAttack(target: MonsterActor, time: number, powerful: boolean) {
    const actionEndsAt = time + (powerful ? 320 : 180);
    this.playerActionUntil = actionEndsAt;
    const direction = target.sprite.x >= this.player.x ? 1 : -1;
    this.player.setFlipX(direction < 0);
    this.player.setAngle(direction * (powerful ? 12 : 7));
    this.player.setScale(
      this.playerScaleX * (powerful ? 1.13 : 1.07),
      this.playerScaleY * (powerful ? 0.9 : 0.95)
    );
    this.time.delayedCall(powerful ? 300 : 160, () => {
      if (this.playerActionUntil !== actionEndsAt) return;
      this.player.setAngle(0).setScale(this.playerScaleX, this.playerScaleY);
    });
  }

  private playAttackEffect(target: MonsterActor, color: number) {
    const ranged = this.characterClass === "ELF" || this.characterClass === "MAGE";
    if (ranged) {
      const projectile = this.add.circle(this.player.x, this.player.y, 6, color, 0.95).setDepth(9);
      projectile.setStrokeStyle(2, 0xffffff, 0.8);
      this.tweens.add({
        targets: projectile,
        x: target.sprite.x,
        y: target.sprite.y,
        scale: 0.4,
        duration: 130,
        onComplete: () => projectile.destroy()
      });
      return;
    }

    const slash = this.add.circle(target.sprite.x, target.sprite.y, 18, color, 0.12)
      .setStrokeStyle(4, color, 0.9)
      .setDepth(9);
    this.tweens.add({ targets: slash, scale: 2.1, alpha: 0, duration: 210, onComplete: () => slash.destroy() });
  }

  private playSkillEffect(target: MonsterActor, color: number) {
    const pulse = this.add.circle(target.sprite.x, target.sprite.y, 24, color, 0.34)
      .setStrokeStyle(5, 0xffffff, 0.85)
      .setDepth(9);
    this.tweens.add({
      targets: pulse,
      scale: 3.2,
      alpha: 0,
      duration: 420,
      ease: "Cubic.Out",
      onComplete: () => pulse.destroy()
    });
    this.cameras.main.shake(100, 0.002);
  }

  private monsterAttack(actor: MonsterActor, time: number) {
    actor.nextAttackAt = time + actor.definition.attackIntervalMs;
    actor.actionUntil = time + 170;
    const direction = this.player.x >= actor.sprite.x ? 1 : -1;
    actor.sprite.setFlipX(direction < 0);
    actor.sprite.setAngle(direction * 8).setScale(actor.baseScaleX * 1.08, actor.baseScaleY * 0.93);
    this.lastCombatAt = time;
    const result = basicAttack(this.createMonsterCombatant(actor), this.createPlayerCombatant());
    if (!result.hit) {
      this.pushLog(`${actor.definition.name} missed you.`);
      return;
    }

    this.playerHp = result.remainingHp;
    this.audio.playerHit();
    this.flashTarget(this.player, 0xff7474);
    this.showDamage(this.player.x, this.player.y - 38, result.damage, "#ff8c8c");
    this.pushLog(`${actor.definition.name} hit you for ${result.damage}.`);
    if (result.killed) {
      this.status = "DEFEATED";
      this.player.setTint(0x555555).setAlpha(0.55).setVelocity(0, 0);
      this.pushLog("You were defeated. Press R or choose New Run.");
    } else this.emitSnapshot();
  }

  private handleMonsterDeath(actor: MonsterActor) {
    actor.state = "DEAD";
    actor.sprite.setVelocity(0, 0);
    this.tweens.add({
      targets: actor.sprite,
      angle: actor.sprite.flipX ? -82 : 82,
      alpha: 0.2,
      scaleX: actor.baseScaleX * 0.78,
      scaleY: actor.baseScaleY * 0.78,
      duration: 260,
      ease: "Cubic.In"
    });
    this.tweens.add({ targets: actor.shadow, alpha: 0.08, scaleX: 0.72, duration: 260 });
    actor.label.setAlpha(0.35);
    actor.hpTrack.setVisible(false);
    actor.hpFill.setVisible(false);

    const gainedExperience = calculateMonsterExperience(actor.definition.baseExperience);
    const progression = applyExperience(this.level, this.experience, gainedExperience);
    this.level = progression.level;
    this.experience = progression.experience;

    if (progression.levelsGained > 0) {
      this.refreshPlayerStats();
      this.playerHp = this.playerStats.maxHp;
      this.playerMp = this.playerStats.maxMp;
      this.audio.levelUp();
      this.pushLog(`LEVEL UP! You reached Lv${this.level} and recovered fully.`);
    }

    if (actor.role === "BOSS") {
      this.bossDefeated = true;
      this.questStage = "CLAIM";
      this.pushLog("Goblin King defeated — guaranteed treasure dropped!");
    } else if (actor.role === "HUNT") {
      this.kills += 1;
      this.huntKills += 1;
      this.pushLog(`${actor.definition.name} defeated · +${gainedExperience.toLocaleString()} EXP.`);
      if (this.huntKills >= HUNT_TARGET) this.beginShardHunt();
    } else if (actor.role === "SHARD") {
      this.kills += 1;
      this.pushLog(`${actor.definition.name} dropped a glowing shard fragment.`);
    } else if (actor.role === "ELITE") {
      this.kills += 1;
      this.questStage = "BOSS";
      this.pushLog("Captain Ruk defeated — Gorvak's camp is exposed!");
      this.unlockBoss();
    } else {
      this.pushLog(`${actor.definition.name} reinforcement defeated.`);
    }

    const rewards = rollMonsterRewards(actor.definition, this.characterClass);
    if (actor.role === "SHARD") {
      rewards.push({
        id: `${actor.definition.id}-shard-fragment`,
        name: "Eternal Shard Fragment",
        quality: "Fine",
        kind: "QUEST_ITEM",
        amount: 1
      });
    }
    this.spawnLoot(actor.sprite.x, actor.sprite.y, rewards);
    this.emitSnapshot();
  }

  private beginShardHunt() {
    if (this.questStage !== "HUNT") return;
    this.questStage = "SHARDS";
    this.unlockActors("SHARD");
    this.cameras.main.flash(260, 86, 187, 196, false);
    this.pushLog(`QUEST II — collect ${SHARD_TARGET} Eternal Shard Fragments.`);
  }

  private unlockElite() {
    if (this.questStage !== "SHARDS") return;
    this.questStage = "ELITE";
    this.unlockActors("ELITE");
    this.cameras.main.shake(220, 0.003);
    this.pushLog("QUEST III — defeat Goblin Captain Ruk at the camp gate.");
  }

  private unlockActors(role: EncounterRole) {
    for (const actor of this.monsters.filter((candidate) => candidate.role === role)) {
      actor.unlocked = true;
      actor.sprite.setVisible(true).setAlpha(1);
      actor.shadow.setVisible(true).setAlpha(0.46);
      actor.label.setVisible(true).setAlpha(1);
      actor.hpTrack.setVisible(true);
      actor.hpFill.setVisible(true);
    }
  }

  private unlockBoss() {
    this.unlockActors("BOSS");
    this.boss.specialReadyAt = this.time.now + 3_000;
    this.boss.label.setText(this.boss.definition.name);
    this.audio.bossAwaken();
    this.cameras.main.shake(260, 0.004);
    this.pushLog("BOSS TERRITORY — Goblin King Gorvak has awakened!");
  }

  private spawnLoot(x: number, y: number, rewards: LootReward[]) {
    rewards.forEach((reward, index) => {
      const offsetX = (index - (rewards.length - 1) / 2) * 52;
      const color = reward.kind === "GOLD" ? 0xf3c64f : reward.kind === "BOSS_TREASURE" ? 0xff8b3d : reward.kind === "QUEST_ITEM" ? 0x6ee7e2 : 0x6fa8ff;
      const radius = reward.kind === "BOSS_TREASURE" ? 13 : 9;
      const sprite = this.add.circle(x + offsetX, y + 18, radius, color).setDepth(7);
      sprite.setStrokeStyle(2, 0xffffff, 0.75);
      const label = this.add.text(sprite.x, sprite.y + 20, reward.name, {
        color: reward.kind === "BOSS_TREASURE" ? "#ffbf7d" : "#eaf1ff",
        fontFamily: "system-ui",
        fontSize: "11px",
        backgroundColor: "#111827cc",
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5, 0).setDepth(8);

      this.tweens.add({ targets: sprite, y: sprite.y - 7, yoyo: true, repeat: -1, duration: 620 + index * 80 });
      this.loot.push({ reward, sprite, label });
    });
  }

  private updateLootPickup() {
    for (let index = this.loot.length - 1; index >= 0; index -= 1) {
      const drop = this.loot[index];
      if (!drop) continue;
      drop.label.setPosition(drop.sprite.x, drop.sprite.y + 20);
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, drop.sprite.x, drop.sprite.y) > 58) continue;
      this.audio.pickup(drop.reward);

      if (drop.reward.kind === "GOLD") {
        this.gold += drop.reward.amount;
        this.pushLog(`Picked up ${drop.reward.amount} Gold.`);
      } else if (drop.reward.kind === "QUEST_ITEM") {
        this.shardFragments = Math.min(SHARD_TARGET, this.shardFragments + drop.reward.amount);
        this.pushLog(`Shard Fragment collected (${this.shardFragments}/${SHARD_TARGET}).`);
        if (this.shardFragments >= SHARD_TARGET) this.unlockElite();
      } else {
        this.inventory = [drop.reward, ...this.inventory].slice(0, 12);
        this.pushLog(`Loot: ${drop.reward.name} [${drop.reward.quality}]${drop.reward.kind === "EQUIPMENT" ? " · press F to equip" : ""}.`);
      }

      if (drop.reward.kind === "BOSS_TREASURE") {
        this.bossTreasureCollected = true;
        this.status = "VICTORY";
        this.questStage = "COMPLETE";
        this.player.setVelocity(0, 0);
        this.audio.victory();
        this.pushLog("VICTORY — Gorvak's treasure is yours!");
      }

      drop.sprite.destroy();
      drop.label.destroy();
      this.loot.splice(index, 1);
      this.emitSnapshot();
    }
  }

  private updateRecovery(time: number) {
    if (this.status !== "PLAYING" || time - this.lastCombatAt < 3_000) return;

    let changed = false;
    if (this.playerHp < this.playerStats.maxHp) {
      this.recoveryPool += this.playerStats.maxHp * 0.02 * (SIMULATION_STEP_MS / 1_000);
      const recovered = Math.floor(this.recoveryPool);
      if (recovered > 0) {
        this.recoveryPool -= recovered;
        this.playerHp = Math.min(this.playerStats.maxHp, this.playerHp + recovered);
        changed = true;
      }
    }
    if (this.playerMp < this.playerStats.maxMp) {
      this.manaRecoveryPool += this.playerStats.maxMp * 0.04 * (SIMULATION_STEP_MS / 1_000);
      const recovered = Math.floor(this.manaRecoveryPool);
      if (recovered > 0) {
        this.manaRecoveryPool -= recovered;
        this.playerMp = Math.min(this.playerStats.maxMp, this.playerMp + recovered);
        changed = true;
      }
    }
    if (changed) this.emitSnapshot();
  }

  private createPlayerCombatant(): Combatant {
    const physicalAttack =
      this.characterClass === "ELF"
        ? this.playerStats.rangedAttack
        : this.characterClass === "DARK_ELF"
          ? this.playerStats.darkElfAttack
          : this.playerStats.physicalAttack;
    return {
      id: "local-player",
      name: CLASS_DEFINITIONS[this.characterClass].label,
      level: this.level,
      currentHp: this.playerHp,
      stats: { ...this.playerStats, physicalAttack }
    };
  }

  private createMonsterCombatant(actor: MonsterActor): Combatant {
    const definition = actor.definition;
    return {
      id: definition.id,
      name: definition.name,
      level: definition.level,
      currentHp: actor.currentHp,
      stats: {
        physicalAttack: definition.attack,
        magicAttack: definition.attack,
        physicalDefense: definition.physicalDefense,
        magicDefense: definition.magicDefense,
        accuracy: 100 + definition.level * 2,
        evasion: definition.level * 1.5,
        criticalChance: definition.rank === "BOSS" ? 0.06 : 0.03,
        criticalDamage: 1.5
      }
    };
  }

  private refreshPlayerStats() {
    const base = deriveStats(createCharacter(this.characterClass, CLASS_DEFINITIONS[this.characterClass].label, this.level));
    this.playerStats = {
      ...base,
      physicalAttack: base.physicalAttack + this.equipmentPower,
      rangedAttack: base.rangedAttack + this.equipmentPower,
      darkElfAttack: base.darkElfAttack + this.equipmentPower,
      magicAttack: base.magicAttack + this.equipmentPower
    };
  }

  private updateMonsterHealthBar(actor: MonsterActor) {
    actor.hpFill.displayWidth = 60 * (actor.currentHp / actor.definition.maxHp);
  }

  private updateWorldLabels() {
    this.playerShadow.setPosition(this.player.x, this.player.y + 28);
    this.playerAura.setPosition(this.player.x, this.player.y + 2);
    this.playerLabel.setPosition(this.player.x, this.player.y - 39);
    for (const actor of this.monsters) {
      const offset = actor.definition.rank === "BOSS" ? 58 : actor.definition.rank === "ELITE" ? 52 : 42;
      actor.shadow.setPosition(actor.sprite.x, actor.sprite.y + actor.sprite.displayHeight * 0.32);
      actor.label.setPosition(actor.sprite.x, actor.sprite.y - offset);
      actor.hpTrack.setPosition(actor.sprite.x - 30, actor.sprite.y - offset + 15);
      actor.hpFill.setPosition(actor.sprite.x - 30, actor.sprite.y - offset + 15);
    }
  }

  private flashTarget(target: Phaser.GameObjects.Sprite, color: number) {
    target.setTint(color);
    this.time.delayedCall(110, () => target.clearTint());
  }

  private showDamage(x: number, y: number, damage: number, color: string) {
    const text = this.add.text(x, y, `-${damage}`, {
      color,
      fontFamily: "system-ui",
      fontSize: "18px",
      fontStyle: "bold",
      stroke: "#111827",
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: text, y: y - 34, alpha: 0, duration: 650, onComplete: () => text.destroy() });
  }

  private showHealing(x: number, y: number, amount: number) {
    const text = this.add.text(x, y, `+${amount}`, {
      color: "#7dffb2",
      fontFamily: "system-ui",
      fontSize: "18px",
      fontStyle: "bold",
      stroke: "#102018",
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: text, y: y - 34, alpha: 0, duration: 700, onComplete: () => text.destroy() });
  }

  private updateQuestPrompt() {
    const nearby = Phaser.Math.Distance.Between(this.player.x, this.player.y, LYRA_POSITION.x, LYRA_POSITION.y) <= 150;
    this.lyraPrompt.setVisible(nearby && this.status === "PLAYING");
    this.lyraPrompt.setText(this.questAccepted ? "E · Ask Lyra" : "E · Accept quest");
  }

  private objective(): string {
    if (this.status === "DEFEATED") return "Defeated — begin a new run";
    if (this.questStage === "COMPLETE") return "Green Meadow cleared";
    if (this.questStage === "MEET_LYRA") return "Speak with Scout Lyra near the Oakvale road (E)";
    if (this.questStage === "HUNT") return `Clear the meadow front (${this.huntKills}/${HUNT_TARGET})`;
    if (this.questStage === "SHARDS") return `Collect Eternal Shard Fragments (${this.shardFragments}/${SHARD_TARGET})`;
    if (this.questStage === "ELITE") return "Defeat Goblin Captain Ruk";
    if (this.questStage === "BOSS") return "Defeat Goblin King — Gorvak";
    return "Claim Gorvak's glowing treasure";
  }

  private storyBeat(): { title: string; text: string } {
    if (this.status === "VICTORY") return { title: "The Memory", text: GREEN_MEADOW_STORY.victory };
    if (this.questStage === "CLAIM") return { title: "The King's Fragment", text: GREEN_MEADOW_STORY.treasure };
    if (this.questStage === "BOSS") return { title: "The False Crown", text: GREEN_MEADOW_STORY.bossAwakens };
    if (this.questStage === "ELITE") return { title: "The Camp Gate", text: GREEN_MEADOW_STORY.eliteAwakens };
    if (this.questStage === "SHARDS") return { title: "Shards on the Wind", text: GREEN_MEADOW_STORY.shardHunt };
    if (this.questStage === "HUNT" && this.huntKills >= 2) return { title: "Echoes in the Blood", text: GREEN_MEADOW_STORY.midpoint };
    if (this.questStage === "HUNT") return { title: "The Shard Hunt", text: GREEN_MEADOW_STORY.questAccepted };
    return { title: "Lyra's Last Flare", text: GREEN_MEADOW_STORY.opening };
  }

  private questSteps() {
    const currentIndex = {
      MEET_LYRA: 0,
      HUNT: 1,
      SHARDS: 2,
      ELITE: 3,
      BOSS: 4,
      CLAIM: 4,
      COMPLETE: 5
    }[this.questStage];
    const labels = [
      "Meet Scout Lyra",
      `Clear the meadow front (${this.huntKills}/${HUNT_TARGET})`,
      `Gather shard fragments (${this.shardFragments}/${SHARD_TARGET})`,
      "Defeat Captain Ruk",
      "Defeat Gorvak and claim the treasure"
    ];
    return labels.map((label, index) => ({
      label,
      status: (this.questStage === "COMPLETE" || index < currentIndex ? "COMPLETE" : index === currentIndex ? "CURRENT" : "LOCKED") as "COMPLETE" | "CURRENT" | "LOCKED"
    }));
  }

  private pushLog(message: string) {
    this.combatLog = [message, ...this.combatLog].slice(0, 8);
    this.emitSnapshot();
  }

  private emitSnapshot() {
    const story = this.storyBeat();
    this.onSnapshot({
      status: this.status,
      playerHp: this.playerHp,
      playerMaxHp: this.playerStats.maxHp,
      playerMp: this.playerMp,
      playerMaxMp: this.playerStats.maxMp,
      level: this.level,
      experience: this.experience,
      experienceToNextLevel: this.level === 100 ? null : experienceToNextLevel(this.level),
      gold: this.gold,
      kills: this.kills,
      stats: this.playerStats,
      objective: this.objective(),
      bossHp: this.boss.currentHp,
      bossMaxHp: this.boss.definition.maxHp,
      bossUnlocked: this.boss.unlocked,
      bossDefeated: this.bossDefeated,
      bossPhase: this.boss.enraged ? 2 : 1,
      inventory: this.inventory,
      equipped: this.equipped,
      potions: this.potions,
      skills: CLASS_SKILLS[this.characterClass].map((skill, index) => ({
        name: skill.name,
        mpCost: skill.mpCost,
        ready: this.skillReady[index] ?? true,
        area: skill.area
      })),
      questAccepted: this.questAccepted,
      questSteps: this.questSteps(),
      storyTitle: story.title,
      storyText: story.text,
      combatLog: this.combatLog
    });
  }
}
