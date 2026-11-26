import type { AnimationAtlas } from "./animation";
import { bridgeRows, riverCenter } from "./core/navigation";
import type { World } from "./core/types";
import { drawPaintedProp } from "./painted-props";

type Story = NonNullable<NonNullable<World["stories"]>["active"]>;
type Cue = {
  id: Story["id"];
  phase: Story["phase"];
  x: number;
  y: number;
  label: string;
};

type StoryWorld = Pick<World, "stories" | "buildings">;
type StorySite = Omit<Cue, "phase">;

function storySite(w: StoryWorld, id: Story["id"]): StorySite | null {
  if (id === "seed-cache") {
    const hall = w.buildings.find((building) => building.type === "market");
    if (!hall) return null;
    return { id, x: hall.x + 1, y: hall.y + 2.1, label: "À la Halle" };
  }
  if (id === "lost-starter") {
    const bakery = w.buildings.find((building) => building.type === "bakery");
    if (!bakery) return null;
    return {
      id, x: bakery.x + 0.65, y: bakery.y + 2.1, label: "À la boulangerie",
    };
  }
  if (id === "carpenter-marks") {
    const workshop = w.buildings.find((building) => building.type === "workshop");
    if (!workshop) return null;
    return {
      id, x: workshop.x + 2.1, y: workshop.y + 1, label: "À l’atelier",
    };
  }
  const y = bridgeRows[1] + 0.5;
  return { id, x: riverCenter(y), y, label: "Au pont" };
}

export function storyCue(w: StoryWorld): Cue | null {
  const active = w.stories?.active;
  if (!active) return null;
  const site = storySite(w, active.id);
  return site && { ...site, phase: active.phase };
}

export function storyTraces(w: StoryWorld): StorySite[] {
  return (w.stories?.traces ?? []).flatMap((id) => {
    const site = storySite(w, id);
    if (!site) return [];
    // Two stories share this bridge; use opposite ends, away from the active cue.
    if (id === "lanterns") site.x -= 1.2;
    if (id === "cistern") site.x += 1.2;
    // Keepsakes sit on the frontage, clear of nearby roofs in the painted view.
    if (id === "seed-cache" || id === "lost-starter") site.y += 1;
    if (id === "carpenter-marks") site.y += 1.8;
    return [site];
  });
}

const keepsakes: Record<Story["id"], string> = {
  cistern: "La plaque de la citerne",
  lanterns: "Le panneau des lanternes",
  "seed-cache": "Le bac des semis",
  "lost-starter": "Les pots de levain",
  "carpenter-marks": "Le tréteau des charpentiers",
};

/** Only show props that physically exist, never past or future clues. */
export function storyLandmarks(w: StoryWorld) {
  return storyTraces(w).reverse().map((trace) => ({
    ...trace,
    name: keepsakes[trace.id],
  }));
}

export function drawLandmarkRing(
  c: CanvasRenderingContext2D,
  [x, y]: [number, number],
  scale: number,
) {
  const radius = Math.max(12, 11 * scale);
  c.save();
  c.beginPath();
  c.ellipse(x, y + 3 * scale, radius, radius * 0.4, 0, 0, Math.PI * 2);
  c.lineWidth = 4;
  c.strokeStyle = "#2d2119";
  c.stroke();
  c.lineWidth = 2;
  c.strokeStyle = "#f3d191";
  c.stroke();
  c.restore();
}

const traceFrames = {
  cistern: 0,
  lanterns: 1,
  "seed-cache": 2,
  "lost-starter": 3,
} as const;

/** Permanent props use sprites only, with no glow or active-event affordance. */
export function drawStoryTrace(
  c: CanvasRenderingContext2D,
  trace: StorySite,
  screen: [number, number],
  scale: number,
  atlas: Pick<AnimationAtlas, "draw">,
) {
  if (trace.id === "carpenter-marks") {
    c.save();
    c.translate(...screen);
    c.scale(scale, scale);
    drawPaintedProp(c, "sawhorse", 0, 2, 18);
    c.restore();
    return;
  }
  atlas.draw(c, traceFrames[trace.id], ...screen, 24 * scale);
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
      if (drawPaintedProp(c, "lantern", x, 2, 26)) continue;
      c.fillStyle = "#725038";
      c.fillRect(x - 1, -14, 2, 16);
      c.fillStyle = "#ffd291";
      c.fillRect(x - 4, -16, 8, 9);
      c.strokeRect(x - 4, -16, 8, 9);
      c.fillStyle = "#fff2bf";
      c.fillRect(x - 1.5, -14, 3, 4);
    }
  } else if (cue.id === "cistern") {
    if (!drawPaintedProp(c, "cistern", 0, 3, 28)) {
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
    }
    if (cue.phase === 1) {
      c.strokeStyle = "#a5d4c6";
      c.beginPath();
      c.ellipse(12, 3, 6, 2.7, 0, 0, Math.PI * 1.5);
      c.stroke();
    }
  } else if (cue.id === "carpenter-marks") {
    drawWorkshopProps(c, cue.phase);
  } else if (cue.id === "lost-starter") {
    const painted = drawPaintedProp(c, "starter", cue.phase === 0 ? 0 : -6, 1, 24);
    if (painted && cue.phase === 1) drawPaintedProp(c, "loaves", 10, 2, 20);
    if (!painted) drawStarterFallback(c, cue.phase);
  } else {
    const painted = drawPaintedProp(c, "seedBasket", cue.phase === 0 ? 0 : -5, 1, 24);
    if (painted && cue.phase === 1) drawPaintedProp(c, "seedSack", 10, 2, 16);
    if (!painted) drawSeedFallback(c, cue.phase);
  }
  c.restore();
}

function drawWorkshopProps(
  c: CanvasRenderingContext2D,
  phase: Cue["phase"],
) {
  const x = phase === 1 ? -4 : 0;
  if (!drawPaintedProp(c, "sawhorse", x, 2, 25)) {
    c.fillStyle = "#8e6446";
    c.fillRect(x - 2, -10, 2, 11);
    c.fillRect(x + 5, -10, 2, 11);
    c.fillStyle = "#aa7a50";
    c.fillRect(x - 5, -11, 15, 3);
    c.strokeRect(x - 5, -11, 15, 3);
  }
  if (phase === 1 && !drawPaintedProp(c, "bucket", 9, 2, 16)) {
    c.fillStyle = "#9f8162";
    c.fillRect(6, -5, 6, 6);
    c.strokeRect(6, -5, 6, 6);
  }
}

function drawStarterFallback(c: CanvasRenderingContext2D, phase: Cue["phase"]) {
  c.fillStyle = "#8d603d";
  c.fillRect(-12, -4, 24, 5);
  c.strokeRect(-12, -4, 24, 5);
  c.fillStyle = "#bc855e";
  c.fillRect(-8, -15, 8, 11);
  c.strokeRect(-8, -15, 8, 11);
  c.fillStyle = "#ddc59c";
  c.fillRect(-9, -17, 10, 3);
  if (phase === 1) {
    c.fillStyle = "#e7b473";
    c.beginPath();
    c.ellipse(5, -7, 4, 2.8, 0.2, 0, Math.PI * 2);
    c.ellipse(9, -10, 3.4, 2.1, -0.4, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
}

function drawSeedFallback(c: CanvasRenderingContext2D, phase: Cue["phase"]) {
  c.fillStyle = "#a77950";
  c.fillRect(-8, -9, 16, 10);
  c.strokeRect(-8, -9, 16, 10);
  c.fillStyle = "#edca93";
  c.fillRect(-6, -12, 11, 5);
  if (phase === 1) {
    c.fillRect(5, -7, 7, 5);
    c.fillRect(9, -2, 6, 4);
  }
}
