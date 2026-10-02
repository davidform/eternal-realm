import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createCharacter, deriveStats, experienceToNextLevel } from "@eternal-realm/game-core";
import { CHARACTER_CLASSES, type CharacterClass, type HealthResponse, type LootReward } from "@eternal-realm/shared-types";
import {
  CLASS_DEFINITIONS,
  CLASS_SKILLS,
  GAME_RULES,
  GREEN_MEADOW_STORY,
  MONSTER_DEFINITIONS
} from "@eternal-realm/game-data";
import { GamePanel } from "@eternal-realm/ui";
import { GameCanvas } from "./game/GameCanvas.js";
import type { GameCommand, GameSnapshot, RunStatus } from "./game/types.js";

const HERO_ART: Record<CharacterClass, string> = {
  KNIGHT: `${import.meta.env.BASE_URL}art/hero-knight.png`,
  ELF: `${import.meta.env.BASE_URL}art/hero-elf.png`,
  MAGE: `${import.meta.env.BASE_URL}art/hero-mage.png`,
  DARK_ELF: `${import.meta.env.BASE_URL}art/hero-dark-elf.png`
};

const CHAPTER_SAVE_KEY = "eternal-realm.chapter-one";

interface ChapterSave {
  version: 1;
  characterClass: CharacterClass;
  bestLevel: number;
  bestGold: number;
  clears: number;
  equipped: LootReward | null;
  inventory: LootReward[];
  clearedAt: string;
}

type GameCommandRequest =
  | { type: "ATTACK" }
  | { type: "DODGE" }
  | { type: "SKILL"; skillIndex: number }
  | { type: "POTION" }
  | { type: "EQUIP"; inventoryIndex: number };

function loadChapterSave(): ChapterSave | null {
  try {
    const value = localStorage.getItem(CHAPTER_SAVE_KEY);
    if (!value) return null;
    const saved = JSON.parse(value) as Partial<ChapterSave>;
    if (!saved.characterClass || !CHARACTER_CLASSES.includes(saved.characterClass)) return null;
    return {
      version: 1,
      characterClass: saved.characterClass,
      bestLevel: saved.bestLevel ?? 1,
      bestGold: saved.bestGold ?? 0,
      clears: saved.clears ?? 1,
      equipped: saved.equipped ?? null,
      inventory: saved.inventory ?? [],
      clearedAt: saved.clearedAt ?? new Date().toISOString()
    };
  } catch {
    return null;
  }
}

function createInitialSnapshot(characterClass: CharacterClass, status: RunStatus): GameSnapshot {
  const stats = deriveStats(createCharacter(characterClass));
  return {
    status,
    playerHp: stats.maxHp,
    playerMaxHp: stats.maxHp,
    playerMp: stats.maxMp,
    playerMaxMp: stats.maxMp,
    level: 1,
    experience: 0,
    experienceToNextLevel: experienceToNextLevel(1),
    gold: 0,
    kills: 0,
    stats,
    objective: "Choose a hero and begin the adventure",
    bossHp: MONSTER_DEFINITIONS.GOBLIN_KING.maxHp,
    bossMaxHp: MONSTER_DEFINITIONS.GOBLIN_KING.maxHp,
    bossUnlocked: false,
    bossDefeated: false,
    bossPhase: 1,
    targetName: null,
    targetHp: 0,
    targetMaxHp: 0,
    inventory: [],
    equipped: null,
    potions: 3,
    dodgeReady: true,
    dodgeCooldownRemainingMs: 0,
    skills: CLASS_SKILLS[characterClass].map((skill) => ({
      name: skill.name,
      mpCost: skill.mpCost,
      ready: true,
      area: skill.area,
      color: skill.color,
      cooldownRemainingMs: 0
    })),
    questAccepted: false,
    questSteps: [
      { label: "Meet Scout Lyra", status: "CURRENT" },
      { label: "Clear the meadow front (0/4)", status: "LOCKED" },
      { label: "Gather shard fragments (0/3)", status: "LOCKED" },
      { label: "Defeat Captain Ruk", status: "LOCKED" },
      { label: "Defeat Gorvak and claim the treasure", status: "LOCKED" }
    ],
    storyTitle: GREEN_MEADOW_STORY.chapter,
    storyText: GREEN_MEADOW_STORY.prologue,
    combatLog: []
  };
}

function createTownSnapshot(save: ChapterSave): GameSnapshot {
  const snapshot = createInitialSnapshot(save.characterClass, "READY");
  const stats = deriveStats(createCharacter(save.characterClass, undefined, save.bestLevel));
  return {
    ...snapshot,
    playerHp: stats.maxHp,
    playerMaxHp: stats.maxHp,
    playerMp: stats.maxMp,
    playerMaxMp: stats.maxMp,
    level: save.bestLevel,
    gold: save.bestGold,
    stats,
    objective: "Chapter I complete — prepare for the Iron March",
    bossHp: 0,
    bossUnlocked: false,
    bossDefeated: true,
    inventory: save.inventory,
    equipped: save.equipped,
    questAccepted: true,
    questSteps: snapshot.questSteps.map((step) => ({
      ...step,
      label: step.label.replace("(0/4)", "(4/4)").replace("(0/3)", "(3/3)"),
      status: "COMPLETE"
    })),
    storyText: GREEN_MEADOW_STORY.epilogue,
    combatLog: ["Chapter I record restored in Oakvale."]
  };
}

export function App() {
  const [characterClass, setCharacterClass] = useState<CharacterClass>("KNIGHT");
  const [snapshot, setSnapshot] = useState(() => createInitialSnapshot("KNIGHT", "READY"));
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTown, setShowTown] = useState(false);
  const [runId, setRunId] = useState(0);
  const hostedBuild = import.meta.env.BASE_URL !== "/";
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline" | "static">(hostedBuild ? "static" : "checking");
  const [chapterSave, setChapterSave] = useState<ChapterSave | null>(() => loadChapterSave());
  const [command, setCommand] = useState<GameCommand | null>(null);
  const commandId = useRef(0);
  const handleSnapshot = useCallback((next: GameSnapshot) => setSnapshot(next), []);
  const stats = snapshot.stats;
  const currentQuest = snapshot.questSteps.find((step) => step.status === "CURRENT");

  const startRunAs = useCallback((runClass: CharacterClass) => {
    setCommand(null);
    setCharacterClass(runClass);
    setSnapshot(createInitialSnapshot(runClass, "PLAYING"));
    setRunId((current) => current + 1);
    setShowTown(false);
    setIsPlaying(true);
  }, []);

  const startRun = useCallback(() => startRunAs(characterClass), [characterClass, startRunAs]);

  useEffect(() => {
    if (hostedBuild) return;
    const controller = new AbortController();
    fetch("http://localhost:3001/health", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("API health check failed");
        return (await response.json()) as HealthResponse;
      })
      .then((health) => setApiStatus(health.status === "ok" ? "online" : "offline"))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setApiStatus("offline");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (snapshot.status !== "VICTORY") return;
    const nextSave: ChapterSave = {
      version: 1,
      characterClass,
      bestLevel: Math.max(chapterSave?.bestLevel ?? 0, snapshot.level),
      bestGold: Math.max(chapterSave?.bestGold ?? 0, snapshot.gold),
      clears: (chapterSave?.clears ?? 0) + 1,
      equipped: snapshot.equipped ?? chapterSave?.equipped ?? null,
      inventory: snapshot.inventory.length > 0 ? snapshot.inventory : chapterSave?.inventory ?? [],
      clearedAt: new Date().toISOString()
    };
    localStorage.setItem(CHAPTER_SAVE_KEY, JSON.stringify(nextSave));
    setChapterSave(nextSave);
  }, [snapshot.status]);

  function chooseClass(nextClass: CharacterClass) {
    setCharacterClass(nextClass);
    setSnapshot(createInitialSnapshot(nextClass, "READY"));
  }

  function enterTown() {
    if (!chapterSave) return;
    setCharacterClass(chapterSave.characterClass);
    setSnapshot(createTownSnapshot(chapterSave));
    setIsPlaying(false);
    setShowTown(true);
  }

  function sendCommand(request: GameCommandRequest) {
    commandId.current += 1;
    setCommand({ ...request, id: commandId.current });
  }

  const experiencePercent = useMemo(() => {
    if (!snapshot.experienceToNextLevel) return 100;
    return Math.min(100, (snapshot.experience / snapshot.experienceToNextLevel) * 100);
  }, [snapshot.experience, snapshot.experienceToNextLevel]);

  return (
    <main className={`app-shell ${isPlaying ? "app-shell--playing" : ""}`}>
      <header className="topbar">
        <div>
          <p className="eyebrow">GREEN MEADOW · PLAYABLE VERTICAL SLICE</p>
          <h1>Eternal Realm</h1>
        </div>
        <div className="topbar-statuses">
          {chapterSave ? <div className="save-status">◆ Chapter I ×{chapterSave.clears} · Lv{chapterSave.bestLevel}</div> : null}
          <div className={`api-status api-status--${apiStatus}`}>
            <span /> {apiStatus === "static" ? "Browser Save" : `API ${apiStatus}`}
          </div>
        </div>
      </header>

      <section className="class-picker" aria-label="Character class">
        {CHARACTER_CLASSES.map((option) => (
          <button
            className={option === characterClass ? "selected" : ""}
            disabled={isPlaying || showTown}
            key={option}
            onClick={() => chooseClass(option)}
            type="button"
          >
            <img alt="" aria-hidden="true" src={HERO_ART[option]} />
            <strong>{CLASS_DEFINITIONS[option].label}</strong>
            <small>{CLASS_DEFINITIONS[option].role}</small>
          </button>
        ))}
        {showTown ? (
          <button className="change-button" onClick={() => setShowTown(false)} type="button">Back to Hero Select</button>
        ) : !isPlaying ? (
          <button className="start-button" onClick={startRun} type="button">Begin Adventure</button>
        ) : (
          <button className="change-button" onClick={() => { setIsPlaying(false); setShowTown(false); }} type="button">Change Hero</button>
        )}
      </section>

      <div className={`prototype-grid ${isPlaying ? "prototype-grid--playing" : ""}`}>
        <section className={`game-stage ${isPlaying ? "game-stage--playing" : ""}`}>
          {showTown && chapterSave ? (
            <div className="town-hub">
              <img className="town-hero" src={HERO_ART[chapterSave.characterClass]} alt={`${CLASS_DEFINITIONS[chapterSave.characterClass].label} in Oakvale`} />
              <div className="town-copy">
                <p>OAKVALE · EASTERN GATE</p>
                <h2>Chapter I Complete</h2>
                <blockquote>{GREEN_MEADOW_STORY.epilogue}</blockquote>
                <div className="town-records">
                  <div><span>Hero</span><strong>{CLASS_DEFINITIONS[chapterSave.characterClass].label}</strong></div>
                  <div><span>Clears</span><strong>{chapterSave.clears}</strong></div>
                  <div><span>Best Level</span><strong>Lv{chapterSave.bestLevel}</strong></div>
                  <div><span>Best Gold</span><strong>{chapterSave.bestGold.toLocaleString()}</strong></div>
                </div>
                <div className="town-equipment">
                  <span>Saved weapon</span>
                  <strong>{chapterSave.equipped?.name ?? "No weapon equipped"}</strong>
                  <small>{chapterSave.inventory.length} saved items</small>
                </div>
                <div className="town-actions">
                  <button onClick={() => startRunAs(chapterSave.characterClass)} type="button">Replay Green Meadow</button>
                  <button disabled type="button">Iron March · Chapter II Locked</button>
                </div>
              </div>
            </div>
          ) : isPlaying ? (
            <GameCanvas
              key={`${characterClass}-${runId}`}
              characterClass={characterClass}
              command={command}
              onRestart={startRun}
              onSnapshot={handleSnapshot}
            />
          ) : (
            <div className="launch-screen">
              <img className="launch-hero" src={HERO_ART[characterClass]} alt={`${CLASS_DEFINITIONS[characterClass].label} character art`} />
              <div className="launch-copy">
              <p>{GREEN_MEADOW_STORY.chapter}</p>
              <h2>{CLASS_DEFINITIONS[characterClass].label}</h2>
              <span>{CLASS_DEFINITIONS[characterClass].role}</span>
              <blockquote>{GREEN_MEADOW_STORY.prologue}</blockquote>
              <button onClick={startRun} type="button">Enter Green Meadow</button>
              {chapterSave ? <button className="secondary-button" onClick={enterTown} type="button">Visit Oakvale</button> : null}
              </div>
            </div>
          )}

          {isPlaying ? (
            <div className="mmorpg-hud">
              <img alt="" aria-hidden="true" className="hud-ornate-frame" src={`${import.meta.env.BASE_URL}art/eternal-realm-hud-frame.png`} />
              <section className="hud-player" aria-label="Character status">
                <img alt="" aria-hidden="true" src={HERO_ART[characterClass]} />
                <div>
                  <strong>{CLASS_DEFINITIONS[characterClass].label}</strong>
                  <small>Lv {snapshot.level} · {snapshot.gold.toLocaleString()} Aden</small>
                  <span className="hud-meter hud-meter--hp"><i style={{ width: `${(snapshot.playerHp / snapshot.playerMaxHp) * 100}%` }} /></span>
                  <span className="hud-meter hud-meter--mp"><i style={{ width: `${(snapshot.playerMp / snapshot.playerMaxMp) * 100}%` }} /></span>
                </div>
              </section>

              <div className="hud-location">
                <span>THE EASTERN WILDS</span>
                <strong>Green Meadow</strong>
                <small>Safe zone ends beyond Oakvale Road</small>
              </div>

              {snapshot.targetName ? (
                <section className="hud-target" aria-label="Selected target">
                  <small>TARGET</small>
                  <strong>{snapshot.targetName}</strong>
                  <span className="hud-meter hud-meter--target"><i style={{ width: `${(snapshot.targetHp / snapshot.targetMaxHp) * 100}%` }} /></span>
                  <em>{snapshot.targetHp} / {snapshot.targetMaxHp}</em>
                </section>
              ) : null}

              <section className="hud-minimap" aria-label="Area map">
                <header><span>Green Meadow</span><small>12:48 · Clear</small></header>
                <div className="hud-minimap__field">
                  <i className="map-road map-road--one" /><i className="map-road map-road--two" />
                  <b className="map-marker map-marker--player" title="Player" />
                  {!snapshot.questAccepted ? <b className="map-marker map-marker--quest" title="Scout Lyra" /> : null}
                  {snapshot.bossUnlocked ? <b className="map-marker map-marker--boss" title="Gorvak" /> : null}
                </div>
                <footer>X 0330 · Y 0600</footer>
              </section>

              <section className="hud-quest-track">
                <span>QUEST TRACKER</span>
                <strong>{currentQuest?.label ?? "Green Meadow Cleared"}</strong>
                <small>{snapshot.objective}</small>
              </section>

              <section className="hud-chat" aria-label="System messages">
                <nav><b>ALL</b><span>COMBAT</span><span>SYSTEM</span></nav>
                {snapshot.combatLog.slice(0, 3).reverse().map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}
              </section>

              <nav className="hud-hotbar" aria-label="Combat hotbar">
                <button onClick={() => sendCommand({ type: "ATTACK" })} title="Basic Attack" type="button"><kbd>Space</kbd><b>⚔</b><small>Attack</small></button>
                {snapshot.skills.map((skill, index) => (
                  <button disabled={!skill.ready || snapshot.playerMp < skill.mpCost} key={skill.name} onClick={() => sendCommand({ type: "SKILL", skillIndex: index })} title={skill.name} type="button">
                    <kbd>{index + 1}</kbd><b style={{ color: `#${skill.color.toString(16).padStart(6, "0")}` }}>{index === 0 ? "◆" : index === 1 ? "✦" : "✹"}</b>
                    <small>{skill.ready ? skill.name : `${(skill.cooldownRemainingMs / 1000).toFixed(1)}s`}</small>
                  </button>
                ))}
                <button disabled={!snapshot.dodgeReady} onClick={() => sendCommand({ type: "DODGE" })} title="Dodge" type="button"><kbd>Shift</kbd><b>➜</b><small>{snapshot.dodgeReady ? "Dodge" : `${(snapshot.dodgeCooldownRemainingMs / 1000).toFixed(1)}s`}</small></button>
                <button disabled={snapshot.potions === 0} onClick={() => sendCommand({ type: "POTION" })} title="Healing Potion" type="button"><kbd>Q</kbd><b>✚</b><small>Potion ×{snapshot.potions}</small></button>
                <button disabled={snapshot.inventory.length === 0} onClick={() => sendCommand({ type: "EQUIP", inventoryIndex: 0 })} title="Equip newest item" type="button"><kbd>F</kbd><b>◈</b><small>Equip</small></button>
              </nav>

              <button className="hud-exit" onClick={() => { setIsPlaying(false); setShowTown(false); }} type="button">ESC · Exit Adventure</button>
            </div>
          ) : null}

          {isPlaying && snapshot.status !== "PLAYING" ? (
            <div className={`run-result run-result--${snapshot.status.toLowerCase()}`}>
              <p>{snapshot.status === "VICTORY" ? "BOSS TREASURE CLAIMED" : "YOUR JOURNEY ENDS HERE"}</p>
              <h2>{snapshot.status === "VICTORY" ? "Green Meadow Cleared" : "Defeated"}</h2>
              <span>Lv{snapshot.level} · {snapshot.gold.toLocaleString()} Gold · {snapshot.inventory.length} Items</span>
              <div className="run-result-actions">
                {snapshot.status === "VICTORY" ? <button onClick={enterTown} type="button">Return to Oakvale</button> : null}
                <button className={snapshot.status === "VICTORY" ? "secondary-button" : ""} onClick={startRun} type="button">
                  {snapshot.status === "VICTORY" ? "Replay Chapter" : "New Run"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="controls-hint">
            <span><kbd>↑ ↓ ← →</kbd> Move</span>
            <span><kbd>Shift</kbd> Dodge</span>
            <span><kbd>E</kbd> Talk</span>
            <span><kbd>Space / 1–3</kbd> Attack / Skills</span>
            <span><kbd>Q / F</kbd> Potion / Equip</span>
            <span><kbd>Walk over</kbd> Pick up loot</span>
          </div>
        </section>

        <aside className="sidebar">
          <GamePanel title={`Lv${snapshot.level} ${CLASS_DEFINITIONS[characterClass].label}`}>
            <div className="resource-label"><span>HP</span><strong>{snapshot.playerHp} / {snapshot.playerMaxHp}</strong></div>
            <div className="health-track"><div style={{ width: `${(snapshot.playerHp / snapshot.playerMaxHp) * 100}%` }} /></div>
            <div className="resource-label resource-label--mp"><span>MP</span><strong>{snapshot.playerMp} / {snapshot.playerMaxMp}</strong></div>
            <div className="mana-track"><div style={{ width: `${(snapshot.playerMp / snapshot.playerMaxMp) * 100}%` }} /></div>
            <div className="resource-label resource-label--exp">
              <span>EXP</span>
              <strong>{snapshot.experience.toLocaleString()} / {snapshot.experienceToNextLevel?.toLocaleString() ?? "MAX"}</strong>
            </div>
            <div className="experience-track"><div style={{ width: `${experiencePercent}%` }} /></div>
            <dl className="stats-grid">
              <div><dt>PATK</dt><dd>{stats.physicalAttack}</dd></div>
              <div><dt>MATK</dt><dd>{stats.magicAttack}</dd></div>
              <div><dt>DEF</dt><dd>{stats.physicalDefense}</dd></div>
              <div><dt>MDEF</dt><dd>{stats.magicDefense}</dd></div>
              <div><dt>Crit</dt><dd>{(stats.criticalChance * 100).toFixed(1)}%</dd></div>
              <div><dt>Gold</dt><dd>{snapshot.gold.toLocaleString()}</dd></div>
            </dl>
          </GamePanel>

          {!isPlaying ? <GamePanel title="Action Bar">
            <div className="action-bar">
              <button
                className={snapshot.dodgeReady ? "" : "action-slot--cooldown"}
                disabled={!isPlaying || !snapshot.dodgeReady}
                onClick={() => sendCommand({ type: "DODGE" })}
                type="button"
              >
                <span className="action-icon action-icon--dodge">➜</span><kbd>Shift</kbd><span className="action-name">Dodge</span>
                <small>{snapshot.dodgeReady ? "Invulnerable dash" : `${(snapshot.dodgeCooldownRemainingMs / 1000).toFixed(1)}s`}</small>
              </button>
              <button disabled={!isPlaying} onClick={() => sendCommand({ type: "ATTACK" })} type="button">
                <span className="action-icon action-icon--attack">⚔</span><kbd>Space</kbd><span className="action-name">Basic Attack</span><small>Ready</small>
              </button>
              {snapshot.skills.map((skill, index) => (
                <button
                  className={skill.ready ? "" : "action-slot--cooldown"}
                  disabled={!isPlaying || !skill.ready || snapshot.playerMp < skill.mpCost}
                  key={skill.name}
                  onClick={() => sendCommand({ type: "SKILL", skillIndex: index })}
                  type="button"
                >
                  <span className="action-icon" style={{ borderColor: `#${skill.color.toString(16).padStart(6, "0")}`, color: `#${skill.color.toString(16).padStart(6, "0")}` }}>
                    {index === 0 ? "◆" : index === 1 ? "✦" : "✹"}
                  </span>
                  <kbd>{index + 1}</kbd><span className="action-name">{skill.name}</span>
                  <small>{skill.ready ? `${skill.mpCost} MP · ${skill.area ? "AoE" : "Single"}` : `${(skill.cooldownRemainingMs / 1000).toFixed(1)}s`}</small>
                </button>
              ))}
              <button
                className={snapshot.potions === 0 ? "action-slot--empty" : ""}
                disabled={!isPlaying || snapshot.potions === 0}
                onClick={() => sendCommand({ type: "POTION" })}
                type="button"
              >
                <span className="action-icon action-icon--potion">✚</span><kbd>Q</kbd><span className="action-name">Healing Potion</span><small>{snapshot.potions} left</small>
              </button>
            </div>
          </GamePanel> : null}

          <GamePanel title="Quest">
            <p className="objective">{snapshot.objective}</p>
            <ol className="quest-chain">
              {snapshot.questSteps.map((step) => (
                <li className={`quest-step--${step.status.toLowerCase()}`} key={step.label.replace(/\s*\(.*\)$/, "")}>
                  <span>{step.status === "COMPLETE" ? "✓" : step.status === "CURRENT" ? "◆" : "○"}</span>
                  {step.label}
                </li>
              ))}
            </ol>
            {snapshot.bossUnlocked ? (
              <>
                <div className="resource-label boss-label"><span>GORVAK · PHASE {snapshot.bossPhase}</span><strong>{snapshot.bossHp} / {snapshot.bossMaxHp}</strong></div>
                <div className="boss-track"><div style={{ width: `${(snapshot.bossHp / snapshot.bossMaxHp) * 100}%` }} /></div>
              </>
            ) : null}
          </GamePanel>

          <GamePanel title="Chronicle">
            <h3 className="story-title">{snapshot.storyTitle}</h3>
            <p className="story-text">{snapshot.storyText}</p>
          </GamePanel>

          <GamePanel title={`Loot Bag · ${snapshot.inventory.length}/12`}>
            <div className="equipment-slot">
              <span>Equipped weapon</span>
              <strong>{snapshot.equipped?.name ?? "Empty"}</strong>
              <small>{snapshot.equipped ? `+${snapshot.equipped.power ?? 0} Power · ${snapshot.equipped.quality}` : "Pick up a weapon to equip it"}</small>
            </div>
            <ul className="loot-list">
              {snapshot.inventory.length === 0 ? <li className="empty-loot">Walk over glowing drops to collect them.</li> : null}
              {snapshot.inventory.map((item, index) => (
                <li className={`loot-quality--${item.quality.toLowerCase()}`} key={`${item.id}-${index}`}>
                  <span>{item.name}<small>{item.kind === "EQUIPMENT" ? `+${item.power ?? 0} Power · ${item.quality}` : item.quality}</small></span>
                  {item.kind === "EQUIPMENT" ? (
                    <button
                      disabled={!isPlaying || snapshot.equipped === item}
                      onClick={() => sendCommand({ type: "EQUIP", inventoryIndex: index })}
                      type="button"
                    >
                      {snapshot.equipped === item ? "Equipped" : "Equip"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </GamePanel>

          <GamePanel title="Combat Log">
            <ol className="combat-log">
              {snapshot.combatLog.length === 0 ? <li>Begin the adventure when ready.</li> : null}
              {snapshot.combatLog.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}
            </ol>
          </GamePanel>

          <div className="locked-rules">
            <span>EXP ×{GAME_RULES.expMultiplier}</span>
            <span>Rare ×{GAME_RULES.rareTreasureMultiplier}</span>
            <span>Boss Treasure 100%</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
