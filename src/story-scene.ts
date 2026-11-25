import { bridgeRows, riverCenter } from "./core/navigation";
import type { World } from "./core/types";

type Story = NonNullable<NonNullable<World["stories"]>["active"]>;
type Cue = {
  id: Story["id"];
  phase: Story["phase"];
  x: number;
  y: number;
  label: string;
};

export function storyCue(w: Pick<World, "stories" | "buildings">): Cue | null {
  const active = w.stories?.active;
  if (!active) return null;
  const { id, phase } = active;
  if (id === "seed-cache") {
    const hall = w.buildings.find((building) => building.type === "market");
    if (!hall) return null;
    return { id, phase, x: hall.x + 1, y: hall.y + 2.1, label: "À la Halle" };
  }
  if (id === "lost-starter") {
    const bakery = w.buildings.find((building) => building.type === "bakery");
    if (!bakery) return null;
    return {
      id, phase, x: bakery.x + 0.65, y: bakery.y + 2.1, label: "À la boulangerie",
    };
  }
  const y = bridgeRows[1] + 0.5;
  return { id, phase, x: riverCenter(y), y, label: "Au pont" };
}

/** Draw props at the event site, rather than decorating the currently selected villager. */
export function drawStoryCue(
  c: CanvasRenderingContext2D,
  cue: Cue,
  screen: [number, number],
  scale: number,
) {
  c.save();
  c.translate(...screen);
  c.scale(scale, scale);
  c.lineWidth = 1.15;
  c.strokeStyle = "#30271f";
  if (cue.id === "lanterns") {
    for (const x of cue.phase === 0 ? [-11] : [-13, 13]) {
      const g = c.createRadialGradient(x, -10, 1, x, -10, 18);
      g.addColorStop(0, "#ffbd6ec4");
      g.addColorStop(1, "#ffb86600");
      c.fillStyle = g;
      c.fillRect(x - 18, -28, 36, 36);
      c.fillStyle = "#725038";
      c.fillRect(x - 1, -14, 2, 16);
      c.fillStyle = "#ffd291";
      c.fillRect(x - 4, -16, 8, 9);
      c.strokeRect(x - 4, -16, 8, 9);
      c.fillStyle = "#fff2bf";
      c.fillRect(x - 1.5, -14, 3, 4);
    }
  } else if (cue.id === "cistern") {
    c.beginPath();
    c.ellipse(0, 0, 11, 4.5, 0, 0, Math.PI * 2);
    c.fillStyle = cue.phase === 0 ? "#525647" : "#558c86";
    c.fill();
    c.stroke();
    c.beginPath();
    for (const x of [-5, 0, 5]) {
      c.moveTo(x - 2, -2.5);
      c.lineTo(x + 2, 2.5);
    }
    c.stroke();
    if (cue.phase === 1) {
      c.strokeStyle = "#a5d4c6";
      c.beginPath();
      c.ellipse(12, 3, 6, 2.7, 0, 0, Math.PI * 1.5);
      c.stroke();
    }
  } else if (cue.id === "lost-starter") {
    c.fillStyle = "#8d603d";
    c.fillRect(-12, -4, 24, 5);
    c.strokeRect(-12, -4, 24, 5);
    c.fillStyle = "#bc855e";
    c.fillRect(-8, -15, 8, 11);
    c.strokeRect(-8, -15, 8, 11);
    c.fillStyle = "#ddc59c";
    c.fillRect(-9, -17, 10, 3);
    if (cue.phase === 1) {
      c.fillStyle = "#e7b473";
      c.beginPath();
      c.ellipse(5, -7, 4, 2.8, 0.2, 0, Math.PI * 2);
      c.ellipse(9, -10, 3.4, 2.1, -0.4, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
  } else {
    c.fillStyle = "#a77950";
    c.fillRect(-8, -9, 16, 10);
    c.strokeRect(-8, -9, 16, 10);
    c.fillStyle = "#edca93";
    c.fillRect(-6, -12, 11, 5);
    if (cue.phase === 1) {
      c.fillRect(5, -7, 7, 5);
      c.fillRect(9, -2, 6, 4);
    }
  }
  c.restore();
}
