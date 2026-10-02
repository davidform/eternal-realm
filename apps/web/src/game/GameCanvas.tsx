import { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new GameScene({ characterClass, onSnapshot, onRestart });
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
    if (command) sceneRef.current?.runCommand(command);
  }, [command]);

  return (
    <div
      className="game-canvas"
      ref={containerRef}
      aria-label="Eternal Realm game scene"
      onPointerDown={() => containerRef.current?.focus()}
      tabIndex={0}
    />
  );
}
