import { useEffect, useRef, useState, type PointerEvent } from "react";
import Phaser from "phaser";
import type { CharacterClass } from "@eternal-realm/shared-types";
import { GameScene } from "./GameScene.js";
import type { GameCommand, GameSnapshot } from "./types.js";

interface GameCanvasProps {
  characterClass: CharacterClass;
  command: GameCommand | null;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onRestart: () => void;
}

export function GameCanvas({ characterClass, command, onSnapshot, onRestart }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GameScene | null>(null);
  const localCommandId = useRef(0);
  const [isReady, setIsReady] = useState(false);

  function runAction(type: "ATTACK" | "DODGE" | "INTERACT" | "POTION") {
    if (!isReady) return;
    localCommandId.current += 1;
    sceneRef.current?.runCommand({ id: localCommandId.current, type });
  }

  function runSkill(skillIndex: number) {
    if (!isReady) return;
    localCommandId.current += 1;
    sceneRef.current?.runCommand({ id: localCommandId.current, type: "SKILL", skillIndex });
  }

  function startMove(x: number, y: number) {
    return (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      sceneRef.current?.setVirtualDirection(x, y);
    };
  }

  function stopMove(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    sceneRef.current?.setVirtualDirection(0, 0);
  }

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new GameScene({ characterClass, onSnapshot, onRestart, onReady: () => setIsReady(true) });
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      width: 960,
      height: 600,
      parent: containerRef.current,
      backgroundColor: "#0d1424",
      physics: {
        default: "arcade",
        arcade: { debug: false }
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: [scene]
    });

    return () => {
      sceneRef.current = null;
      game.destroy(true);
    };
  }, [characterClass, onRestart, onSnapshot]);

  useEffect(() => {
    if (command && isReady) sceneRef.current?.runCommand(command);
  }, [command, isReady]);

  return (
    <div className="game-canvas" aria-label="Eternal Realm game scene" onPointerDown={(event) => event.currentTarget.focus()} tabIndex={0}>
      <div className="game-render-surface" ref={containerRef} />
      {!isReady ? (
        <div className="game-loading">
          <span />
          <strong>Opening Green Meadow</strong>
          <small>Gathering heroes, creatures, and shard-light…</small>
        </div>
      ) : null}
      {isReady ? (
        <div className="touch-controls" aria-label="Touch controls">
          <div className="touch-dpad" aria-label="Movement controls">
            <button aria-label="Move up" className="touch-up" onPointerCancel={stopMove} onPointerDown={startMove(0, -1)} onPointerUp={stopMove} type="button">↑</button>
            <button aria-label="Move left" className="touch-left" onPointerCancel={stopMove} onPointerDown={startMove(-1, 0)} onPointerUp={stopMove} type="button">←</button>
            <button aria-label="Talk" className="touch-talk" onClick={() => runAction("INTERACT")} type="button">E</button>
            <button aria-label="Move right" className="touch-right" onPointerCancel={stopMove} onPointerDown={startMove(1, 0)} onPointerUp={stopMove} type="button">→</button>
            <button aria-label="Move down" className="touch-down" onPointerCancel={stopMove} onPointerDown={startMove(0, 1)} onPointerUp={stopMove} type="button">↓</button>
          </div>
          <div className="touch-actions" aria-label="Combat controls">
            {[0, 1, 2].map((skillIndex) => (
              <button aria-label={`Skill ${skillIndex + 1}`} key={skillIndex} onClick={() => runSkill(skillIndex)} type="button">{skillIndex + 1}</button>
            ))}
            <button aria-label="Dodge" className="touch-dodge" onClick={() => runAction("DODGE")} type="button">➜</button>
            <button aria-label="Basic attack" className="touch-attack" onClick={() => runAction("ATTACK")} type="button">⚔</button>
            <button aria-label="Healing potion" className="touch-potion" onClick={() => runAction("POTION")} type="button">✚</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
