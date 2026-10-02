import type { PropsWithChildren } from "react";

interface GamePanelProps extends PropsWithChildren {
  title: string;
}

export function GamePanel({ title, children }: GamePanelProps) {
  return (
    <section className="game-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
