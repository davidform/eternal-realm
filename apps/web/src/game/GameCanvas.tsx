import { useEffect, useRef, useState } from "react";
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
  const [isReady, setIsReady] = useState(false);

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
    </div>
  );
}
