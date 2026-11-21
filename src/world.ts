import { field, onLane } from "./village-layout";
import { cropRows, cropRowY, initialGrowth } from "./core/crops";
import { doorStep } from "./core/home-visits";
import { residentScale } from "./core/population";
import { indoors, needsHomeCare } from "./core/shelter";
import { drawHouseDoor } from "./house-door";
import { treePosition } from "./core/local-environment";
import { foragingHens } from "./hens";
import { drawSwallows } from "./swallows";
import { drawCritters } from "./critters";
import { bridgeRows, riverCenter, riverHalfWidth } from "./core/navigation";
import { remainsStage } from "./core/lifecycle";
import { residentSkin } from "./sprites";
import { PaintedTerrain } from "./terrain";
import { WorldFoundation, decayOf } from "./foundation";
import { AnimationAtlas, loopFrame } from "./animation";
import { EnvironmentAtlas, buildingDamageStage } from "./environment";
import { ResidentAtlas } from "./sprites";
import { WaterLevel, Waterfall, waterHalfWidth } from "./water";
import { daylight, goldenHour } from "./daylight";
import { autumnColour, bareBranches, snowCover } from "./core/seasons";
import type { World, Building, Villager } from "./core/types";

type Point = [number, number];
type Hit = {
  x: number;
  y: number;
  id: number;
  kind: "person" | "building";
  bounds?: { left: number; top: number; right: number; bottom: number };
};
const mix = (a: string, b: string, t: number) => {
  const n = (s: string) => s.match(/\w\w/g)!.map((v) => parseInt(v, 16));
  const x = n(a),
    y = n(b);
  return (
    "#" +
    x
      .map((v, i) =>
        Math.round(v + (y[i] - v) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
};
const noise = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
export class WorldRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  atlas = new ResidentAtlas();
  crops = new AnimationAtlas("/assets/farm-crops.webp", 4, 3, 0, false, true);
  hens = new AnimationAtlas("/assets/farm-hens.webp", 4, 6, 0, false, true);
  remains = new AnimationAtlas("/assets/residents-remains.png", 4, 4);
  foundation = new WorldFoundation();
  terrain = new PaintedTerrain();
  monsters = new AnimationAtlas(
    "/assets/monster-cycle.png",
    4,
    4,
    0,
    false,
    true,
  );
  wolves = new AnimationAtlas("/assets/wolf-cycle.png", 4, 4, 0, false, true);
  wraiths = new AnimationAtlas(
    "/assets/wraith-cycle.png",
    4,
    2,
    0,
    false,
    true,
  );
  flames = new AnimationAtlas("/assets/flames-cycle.png", 4, 3, 0, true);
  previousPositions = new Map<number, Point>();
  waterLevel = new WaterLevel();
  tick = 0;
  waterfall = new Waterfall();
  interpolation = 1;
  capturePositions(w: World) {
    this.previousPositions = new Map(
      w.villagers.map((v) => [v.id, [v.x, v.y] as Point]),
    );
  }
  environment = new EnvironmentAtlas();
  waterworks = new EnvironmentAtlas(
    "/assets/waterworks.png",
    [0, 1 / 3, 2 / 3, 1],
    [0, 410 / 1536, 720 / 1536, 1147 / 1536, 1],
  );
  damagedBuildings = new EnvironmentAtlas("/assets/buildings-damaged.png", [
    0,
    352 / 1024,
    730 / 1024,
    1,
  ]);
  zoom = 1;
  pan: Point = [0, 0];
  /** Transient camera offset (earthquakes); never saved or user-driven. */
  shake: Point = [0, 0];
  /** Rot derived from simulation state: stable in pause and after reload. */
  decay = 0;
  hits: Hit[] = [];
  width = 0;
  height = 0;
  scale = 1;
  time = 0;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(),
      d = Math.min(devicePixelRatio, 2);
    if (
      this.canvas.width !== Math.round(r.width * d) ||
      this.canvas.height !== Math.round(r.height * d)
    ) {
      this.canvas.width = Math.round(r.width * d);
      this.canvas.height = Math.round(r.height * d);
    }
    this.width = r.width;
    this.height = r.height;
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  project(x: number, y: number, z = 0): Point {
    return [
      (x - y) * 23 * this.scale +
        this.width * 0.5 +
        this.pan[0] +
        this.shake[0],
      (x + y - 28) * 11.5 * this.scale +
        (90 + Math.max(220, this.height - 280) * 0.22) -
        z * this.scale +
        this.pan[1] +
        this.shake[1],
    ];
  }
  poly(points: Point[], fill: string, stroke?: string) {
    const c = this.ctx;
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = 0.7 * this.scale;
      c.stroke();
    }
  }
  shape(coords: [number, number, number][], fill: string, stroke?: string) {
    this.poly(
      coords.map((p) => this.project(...p)),
      fill,
      stroke,
    );
  }
  tile(x: number, y: number, color: string, z = 0) {
    this.shape(
      [
        [x, y, z],
        [x + 1, y, z],
        [x + 1, y + 1, z],
        [x, y + 1, z],
      ],
      color,
    );
  }
  line(points: Point[], color: string, width = 1) {
    const c = this.ctx;
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.strokeStyle = color;
    c.lineWidth = width * this.scale;
    c.stroke();
  }
  ellipse(x: number, y: number, rx: number, ry: number, fill: string) {
    const c = this.ctx;
    c.beginPath();
    c.ellipse(x, y, rx * this.scale, ry * this.scale, 0, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
  }
  box(
    x: number,
    y: number,
    w: number,
    d: number,
    h: number,
    top: string,
    left: string,
    right: string,
    z = 0,
  ) {
    this.shape(
      [
        [x, y, z],
        [x, y + d, z],
        [x, y + d, z + h],
        [x, y, z + h],
      ],
      left,
    );
    this.shape(
      [
        [x, y + d, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      right,
    );
    this.shape(
      [
        [x, y, z + h],
        [x + w, y, z + h],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      top,
    );
  }
  tree(
    x: number,
    y: number,
    height: number,
    p: number,
    t: number,
    health = 100,
    scorch = 0,
  ) {
    const [sx, sy] = this.project(x, y);
    this.ellipse(sx + 8 * this.scale, sy + 2 * this.scale, 13, 5, "#172e242b");
    if (this.environment.ready) {
      const dead = health < 22 || scorch > 65;
      const broadleaf = !dead && noise(x, y) > 0.5;
      // Broadleaf trees colour, then shed their leaves; conifers keep theirs.
      const bare = broadleaf && noise(x + 3.1, y) < bareBranches(this.tick);
      const index = dead || bare ? 6 : broadleaf ? 4 : 5;
      const size = (height + 38) * this.scale;
      const autumn = broadleaf && !bare ? autumnColour(this.tick) : 0,
        snow = snowCover(this.tick);
      this.ctx.save();
      // Sepia keeps trunks brown while foliage turns gold to rust.
      const turn = Math.max(
        autumn * (0.65 + noise(x, y + 7) * 0.35),
        ((100 - health) / 100) * 0.8,
      );
      this.ctx.filter =
        `sepia(${0.75 * turn}) hue-rotate(${-14 * turn}deg) ` +
        `saturate(${(1 - p * 0.65) * (1 + 0.9 * turn) * (1 - 0.45 * snow)}) ` +
        `brightness(${(1 - p * 0.15) * (1 - scorch * 0.005) * (1 + 0.14 * snow)})`;
      this.environment.draw(
        this.ctx,
        index,
        sx + Math.sin(t * 0.7 + x) * this.scale,
        sy + 3 * this.scale,
        size * (index === 5 ? 0.67 : 0.95),
        size,
      );
      this.ctx.restore();
      return;
    }

    this.line([this.project(x, y), this.project(x, y, height)], "#66503a", 3);
    const sway = Math.sin(t * 0.7 + x) * 0.8,
      green = mix("304734", "706349", p),
      light = mix("596749", "93805a", p);
    if (noise(x, y) < p * 0.55) {
      this.line(
        [
          this.project(x, y, height * 0.5),
          this.project(x + 0.2, y + 0.2, height * 0.9),
        ],
        "#72674c",
        2,
      );
      return;
    }
    for (let i = 0; i < 36; i++) {
      const angle = noise(i, x) * Math.PI * 2,
        r = Math.sqrt(noise(i, y)) * 19;
      const [tx, ty] = this.project(x, y, height * 0.75);
      const dx = Math.cos(angle) * r,
        dy = Math.sin(angle) * r * 0.7;
      this.ellipse(
        tx + (dx + sway) * this.scale,
        ty + dy * this.scale,
        5 + noise(i, 4) * 5,
        4 + noise(i, 5) * 5,
        i % 4 === 0 ? light : green,
      );
      this.ellipse(
        tx + (dx + sway - 2) * this.scale,
        ty + (dy - 2) * this.scale,
        2.3,
        1.5,
        mix("7e8a56", "a1976d", p) + "70",
      );
    }
  }
  house(b: Building, w: World) {
    const x = b.x,
      y = b.y,
      home = b.type === "home",
      width = home ? 1.8 : b.type === "market" ? 2.8 : 2.3,
      depth = home ? 1.5 : 1.9,
      h = home ? 36 : 43;
    const abandoned =
      home && w.villagers.filter((v) => v.home === b.id).every((v) => v.dead);
    const roof = abandoned
      ? "#756c58"
      : b.type === "clinic"
        ? "#5d7771"
        : b.type === "workshop"
          ? "#766d61"
          : "#62564c";
    const [sx, sy] = this.project(x + width / 2, y + depth / 2);
    if (this.environment.ready) {
      const index = home
        ? 0
        : b.type === "market"
          ? 2
          : b.type === "clinic"
            ? 3
            : 1;
      const stage = buildingDamageStage(b.condition);
      const atlas =
        stage && this.damagedBuildings.ready
          ? this.damagedBuildings
          : this.environment;
      const frame =
        atlas === this.environment ? index : (stage - 1) * 4 + index;
      this.ellipse(
        sx + 7 * this.scale,
        sy + 9 * this.scale,
        40,
        13,
        "#1d241c44",
      );
      this.ctx.save();
      this.ctx.filter = `saturate(${abandoned ? 0.35 : 1 - stage * 0.12}) brightness(${1 - stage * 0.07})`;
      atlas.draw(
        this.ctx,
        frame,
        sx,
        sy + 17 * this.scale,
        (home ? 93 : 112) * this.scale,
      );
      this.ctx.restore();
      if (home) {
        const doorHit = drawHouseDoor(
          this.ctx,
          w,
          b,
          atlas,
          frame,
          this.atlas,
          sx,
          sy + 17 * this.scale,
          93 * this.scale,
          w.settings.reducedMotion ? w.tick : this.time / 0.2,
          this.scale,
        );
        if (doorHit) this.hits.push({ ...doorHit, kind: "person" });
      }
      const spriteWidth = (home ? 93 : 112) * this.scale;
      const spriteHeight =
        (spriteWidth * atlas.frames[frame].h) / atlas.frames[frame].w;
      this.hits.push({
        bounds: {
          left: sx - spriteWidth / 2,
          right: sx + spriteWidth / 2,
          top: sy + 17 * this.scale - spriteHeight,
          bottom: sy + 17 * this.scale,
        },
        x: sx,
        y: sy - 20 * this.scale,
        id: b.id,
        kind: "building",
      });
      return;
    }

    this.ellipse(
      sx + 15 * this.scale,
      sy + 4 * this.scale,
      35,
      11,
      "#26352930",
    );
    this.box(
      x,
      y,
      width,
      depth,
      h,
      "#aaa38c",
      abandoned ? "#847f65" : "#777666",
      abandoned ? "#706f59" : "#a19b84",
    );
    this.shape(
      [
        [x - 0.15, y - 0.15, h],
        [x + width / 2, y - 0.15, h + 19],
        [x + width / 2, y + depth + 0.2, h + 19],
        [x - 0.15, y + depth + 0.2, h],
      ],
      roof,
    );
    this.shape(
      [
        [x + width / 2, y - 0.15, h + 19],
        [x + width + 0.18, y - 0.15, h],
        [x + width + 0.18, y + depth + 0.2, h],
        [x + width / 2, y + depth + 0.2, h + 19],
      ],
      mix(roof, "e1a26a", 0.22),
    );
    this.shape(
      [
        [x - 0.15, y + depth + 0.2, h],
        [x + width / 2, y + depth + 0.2, h + 19],
        [x + width + 0.18, y + depth + 0.2, h],
      ],
      "#c9b88c",
    );
    for (let i = 1; i < 5; i++) {
      const u = i / 5;
      this.line(
        [
          this.project(
            x + width / 2 + (u * width) / 2,
            y - 0.12,
            h + 19 * (1 - u),
          ),
          this.project(
            x + width / 2 + (u * width) / 2,
            y + depth + 0.2,
            h + 19 * (1 - u),
          ),
        ],
        mix(roof, "463e32", 0.18),
        0.6,
      );
    }
    this.shape(
      [
        [x + 0.22, y + depth + 0.01, 0],
        [x + 0.65, y + depth + 0.01, 0],
        [x + 0.65, y + depth + 0.01, 17],
        [x + 0.22, y + depth + 0.01, 17],
      ],
      "#5c5842",
    );
    this.shape(
      [
        [x + 1.05, y + depth + 0.015, 11],
        [x + 1.48, y + depth + 0.015, 11],
        [x + 1.48, y + depth + 0.015, 20],
        [x + 1.05, y + depth + 0.015, 20],
      ],
      abandoned ? "#52584b" : "#d5a455",
    );
    this.line(
      [
        this.project(x + 1.27, y + depth + 0.02, 11),
        this.project(x + 1.27, y + depth + 0.02, 20),
      ],
      "#6e664d",
      1.5,
    );
    this.box(
      x + 0.25,
      y + 0.25,
      0.3,
      0.3,
      18,
      "#a29170",
      "#7d715a",
      "#b3a17b",
      h,
    );
    if (!abandoned && w.pressure < 80 && !w.settings.reducedMotion) {
      const [cx, cy] = this.project(x + 0.4, y + 0.4, h + 24);
      for (let i = 0; i < 3; i++) {
        const k = (this.time * 0.3 + i * 0.33) % 1;
        this.ellipse(
          cx + k * 10 * this.scale,
          cy - k * 33 * this.scale,
          3 + k * 5,
          3 + k * 5,
          `rgba(220,216,190,${0.23 * (1 - k)})`,
        );
      }
    }
    if (b.type === "market") {
      for (let i = 0; i < 6; i++)
        this.shape(
          [
            [x + i * 0.48, y + depth, 20],
            [x + (i + 1) * 0.48, y + depth, 20],
            [x + (i + 1) * 0.48, y + depth + 1.2, 11],
            [x + i * 0.48, y + depth + 1.2, 11],
          ],
          i % 2 ? "#d1bf8f" : "#70866a",
        );
      this.box(
        x,
        y + depth + 0.7,
        2.6,
        0.5,
        8,
        "#b38f56",
        "#766144",
        "#a17d49",
      );
      for (let i = 0; i < 5; i++) {
        const [fx, fy] = this.project(x + 0.3 + i * 0.45, y + depth + 0.8, 11);
        this.ellipse(fx, fy, 3, 2, w.food > 25 ? "#ba8248" : "#827454");
      }
    }
    if (b.type === "clinic") {
      const [cx, cy] = this.project(x + 0.9, y + depth + 0.03, 25);
      const c = this.ctx;
      c.fillStyle = "#765c49";
      c.fillRect(
        cx - 1.5 * this.scale,
        cy - 5 * this.scale,
        3 * this.scale,
        10 * this.scale,
      );
      c.fillRect(
        cx - 5 * this.scale,
        cy - 1.5 * this.scale,
        10 * this.scale,
        3 * this.scale,
      );
    }
    // Mortar courses, imperfect stonework, timber beams and roof shingles.
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 5; col++) {
        const xx = x + ((col + (row % 2) * 0.45) * width) / 5;
        if (xx + width / 5 > x + width) continue;
        this.shape(
          [
            [xx, y + depth + 0.025, row * 5 + 1],
            [xx + width / 5 - 0.035, y + depth + 0.025, row * 5 + 1],
            [xx + width / 5 - 0.035, y + depth + 0.025, row * 5 + 5],
            [xx, y + depth + 0.025, row * 5 + 5],
          ],
          mix("777967", "b5ad91", noise(row + b.id, col) * 0.65),
          "#4b4c4144",
        );
      }
    for (const xx of [x + 0.07, x + width - 0.07])
      this.line(
        [
          this.project(xx, y + depth + 0.04, 0),
          this.project(xx, y + depth + 0.04, h),
        ],
        "#443d32",
        3,
      );
    for (const zz of [5, h - 2])
      this.line(
        [
          this.project(x, y + depth + 0.04, zz),
          this.project(x + width, y + depth + 0.04, zz),
        ],
        "#514837",
        2.5,
      );
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 7; col++) {
        const u = (r + 0.2) / 7,
          yy = y + (col * depth) / 7;
        this.line(
          [
            this.project(x + width / 2 + (u * width) / 2, yy, h + 19 * (1 - u)),
            this.project(
              x + width / 2 + (u * width) / 2,
              yy + depth / 7 - 0.025,
              h + 19 * (1 - u),
            ),
          ],
          noise(r, col + b.id) > 0.5 ? "#b3a28a66" : "#2b302b88",
          1.5,
        );
      }
    // Arched doorway, warm interior and iron-studded planks.
    this.shape(
      [
        [x + 0.25, y + depth + 0.06, 0],
        [x + 0.7, y + depth + 0.06, 0],
        [x + 0.7, y + depth + 0.06, 19],
        [x + 0.48, y + depth + 0.06, 23],
        [x + 0.25, y + depth + 0.06, 19],
      ],
      "#302d24",
    );
    for (let j = 0; j < 4; j++)
      this.line(
        [
          this.project(x + 0.29 + j * 0.1, y + depth + 0.07, 1),
          this.project(x + 0.29 + j * 0.1, y + depth + 0.07, 18),
        ],
        "#726044",
        1.1,
      );
    const [wx, wy] = this.project(x + width - 0.5, y + depth + 0.07, 23);
    this.ellipse(wx, wy, 3, 4, abandoned ? "#252d2c" : "#ddb16c");
    this.line(
      [
        [wx - 4 * this.scale, wy],
        [wx + 4 * this.scale, wy],
      ],
      "#3d3b30",
      1.5,
    );
    const hit = this.project(x + width / 2, y + depth / 2, h / 2);
    this.hits.push({ x: hit[0], y: hit[1], id: b.id, kind: "building" });
  }
  person(v: Villager, w: World, selected: number | null, atDoor = false) {
    if (v.dead) {
      const [x, y] = this.project(v.x, v.y);
      const s = this.scale * residentScale(v),
        c = this.ctx;
      const stage = remainsStage(v, w.tick);
      this.ellipse(x, y, 22, 7, "#181c1744");
      const skin = residentSkin(v.id);
      const drawn =
        skin >= 4
          ? this.atlas.extra.drawRemains(c, skin, v, stage, x, y + 4 * s, s)
          : this.remains.draw(c, skin * 4 + stage, x, y + 4 * s, 40 * s);
      if (!drawn) {
        // Readable prone remains while the painted sheet loads.
        this.line(
          [
            [x - 16 * s, y],
            [x + 14 * s, y],
          ],
          "#d1c5a4",
          3,
        );
        this.ellipse(x - 19 * s, y, 4, 3, "#d1c5a4");
        for (const side of [-1, 1])
          this.line(
            [
              [x + 5 * s, y],
              [x + 14 * s, y + side * 5 * s],
            ],
            "#d1c5a4",
            2,
          );
      }
      if (selected === v.id) {
        c.strokeStyle = "#e1cd96";
        c.lineWidth = s;
        c.beginPath();
        c.ellipse(x, y, 27 * s, 10 * s, 0, 0, Math.PI * 2);
        c.stroke();
        c.fillStyle = "#eedcba";
        c.font = `${12 * s}px Georgia`;
        c.textAlign = "center";
        c.fillText(v.name, x, y - 28 * s);
      }
      this.hits.push({
        x,
        y,
        id: v.id,
        kind: "person",
        bounds: {
          left: x - 28 * s,
          right: x + 28 * s,
          top: y - (stage === 0 ? 48 : 24) * s,
          bottom: y + 8 * s,
        },
      });
      return;
    }
    let x = v.x,
      y = v.y;
    const previous = atDoor ? undefined : this.previousPositions.get(v.id);
    if (
      previous &&
      !w.settings.reducedMotion &&
      Math.hypot(x - previous[0], y - previous[1]) < 1.5
    ) {
      x = previous[0] + (x - previous[0]) * this.interpolation;
      y = previous[1] + (y - previous[1]) * this.interpolation;
    }
    const [sx, sy] = this.project(x, y),
      s = this.scale * residentScale(v),
      c = this.ctx;
    const walking = v.route.length > 0 && !w.settings.reducedMotion;
    const bob = walking ? Math.sin(this.time * 9 + v.id) * 0.8 : 0;
    if (v.id === selected) {
      this.ellipse(sx, sy, 8, 4, "#eed29450");
      c.strokeStyle = "#f0dcaa";
      c.lineWidth = 1.5 * s;
      c.beginPath();
      c.ellipse(sx, sy, 9 * s, 4 * s, 0, 0, Math.PI * 2);
      c.stroke();
    }
    this.ellipse(sx + 2 * s, sy + 1 * s, 4, 2, "#2c3c3545");
    if (!this.atlas.draw(c, v, w, this.time, sx, sy, s)) {
      const colors = [
        "#8b5747",
        "#d4b45d",
        "#647a86",
        "#8b8960",
        "#c1a58a",
        "#7b716c",
        "#778d6a",
        "#ad7759",
      ];
      const skin = ["#cca47a", "#d9b88f", "#a88260", "#b78c65"][v.id % 4];
      const leg = walking ? Math.sin(this.time * 10 + v.id) * 2 : 0;
      // Articulated adult silhouettes: boots, shaded tunics, capes, hands and faces.
      const lift = v.health < 40 ? 2 : 0;
      const py = sy + lift * s;
      this.line(
        [
          [sx - 2 * s, py - 12 * s],
          [sx - (3 + leg) * s, py - 2 * s],
        ],
        "#292924",
        3.2,
      );
      this.line(
        [
          [sx + 2 * s, py - 12 * s],
          [sx + (3 + leg) * s, py - 2 * s],
        ],
        "#38372e",
        3.2,
      );
      this.ellipse(sx - (3 + leg) * s, py, 3, 1.6, "#292821");
      this.ellipse(sx + (3 + leg) * s, py, 3, 1.6, "#292821");
      const cloth = colors[v.id % 8];
      this.poly(
        [
          [sx - 4 * s, py - (27 + bob) * s],
          [sx + 4 * s, py - (27 + bob) * s],
          [sx + 6 * s, py - 11 * s],
          [sx - 6 * s, py - 11 * s],
        ],
        cloth,
        "#242b27",
      );
      this.poly(
        [
          [sx - 4 * s, py - (26 + bob) * s],
          [sx, py - 24 * s],
          [sx - 1 * s, py - 12 * s],
          [sx - 6 * s, py - 11 * s],
        ],
        "#1e262947",
      );
      this.line(
        [
          [sx - 5 * s, py - 14 * s],
          [sx + 5 * s, py - 14 * s],
        ],
        "#493a2b",
        2,
      );
      c.fillStyle = "#b3a172";
      c.fillRect(sx - s, py - 15 * s, 2 * s, 2 * s);
      for (const side of [-1, 1]) {
        this.line(
          [
            [sx + side * 4 * s, py - 25 * s],
            [sx + side * (7 + leg * 0.25) * s, py - 18 * s],
            [sx + side * 7 * s, py - 14 * s],
          ],
          cloth,
          3,
        );
        this.ellipse(sx + side * 7 * s, py - 13 * s, 1.5, 2, skin);
      }
      this.ellipse(sx, py - (31 + bob) * s, 3.1, 4.5, skin);
      this.ellipse(
        sx - 0.5 * s,
        py - (34 + bob) * s,
        3.5,
        2.6,
        v.age > 55 ? "#a7a797" : "#493e30",
      );
      this.line(
        [
          [sx + 1 * s, py - (31 + bob) * s],
          [sx + 3 * s, py - (31 + bob) * s],
        ],
        "#332e27",
        0.8,
      );
      if (v.id % 8 === 0) {
        this.ellipse(sx, py - (34 + bob) * s, 6, 1.7, "#a39161");
        this.line(
          [
            [sx + 8 * s, py - 2 * s],
            [sx + 8 * s, py - 31 * s],
          ],
          "#69533a",
          1.6,
        );
      }
      if (v.id % 8 === 4)
        this.shape(
          [
            [x - 0.1, y, 27],
            [x + 0.1, y, 27],
            [x + 0.1, y, 24],
            [x - 0.1, y, 24],
          ],
          "#c6bfa5",
        );
      if (v.action.includes("eau") || v.action.includes("puits")) {
        c.fillStyle = "#696f68";
        c.fillRect(sx + 6 * s, py - 12 * s, 5 * s, 7 * s);
        this.line(
          [
            [sx + 6 * s, py - 12 * s],
            [sx + 8 * s, py - 16 * s],
            [sx + 11 * s, py - 12 * s],
          ],
          "#aca48d",
          0.8,
        );
      }
    }
    this.hits.push({ x: sx, y: sy - 29 * s, id: v.id, kind: "person" });
    if (v.id === selected) {
      c.font = `${Math.max(11, 11 * s)}px Georgia`;
      c.textAlign = "center";
      c.fillStyle = "#fff1d2";
      c.shadowColor = "#25352a";
      c.shadowBlur = 5;
      c.fillText(v.name, sx, sy - 65 * s);
      c.shadowBlur = 0;
    }
  }
  render(w: World, time: number, selected: number | null) {
    this.resize();
    this.tick = w.tick;
    this.time = w.settings.reducedMotion ? 0 : time;
    this.waterLevel.update(w.water, time, w.settings.reducedMotion);
    this.scale =
      Math.min(this.width / 1500, Math.max(220, this.height - 280) / 1650) *
      this.zoom;
    const c = this.ctx,
      p = w.pressure / 100,
      s = this.scale;
    const quake = w.settings.reducedMotion
      ? undefined
      : w.disasters?.find((e) => e.kind === "quake");
    const power = quake ? Math.min(1, quake.life / 20) * 5 * s : 0;
    this.shake = [
      Math.sin(time * 61) * power,
      Math.cos(time * 53) * power * 0.7,
    ];
    this.decay = decayOf(w);
    this.hits = [];
    c.clearRect(0, 0, this.width, this.height);
    const bg = c.createRadialGradient(
      this.width * 0.5,
      this.height * 0.48,
      20,
      this.width * 0.5,
      this.height * 0.5,
      this.width * 0.7,
    );
    bg.addColorStop(0, "#263b43");
    bg.addColorStop(1, "#080f20");
    c.fillStyle = bg;
    c.fillRect(0, 0, this.width, this.height);
    // Quiet stars establish the vast space around the living world.
    for (let i = 0; i < 210; i++) {
      const x = noise(i, 81) * this.width;
      const y = noise(i, 82) * this.height;
      const radius = i % 17 === 0 ? 1.4 : 0.65;
      c.fillStyle = i % 9 === 0 ? "#e9d6ac88" : "#adccd65c";
      c.beginPath();
      c.arc(x, y, radius, 0, Math.PI * 2);
      c.fill();
    }
    const [worldX, worldY] = this.project(14.5, 14.5);
    if (!w.settings.reducedMotion)
      drawCritters(c, this.time, this.width, this.height, worldX, worldY, s);
    if (
      !this.foundation.draw(
        c,
        worldX,
        worldY,
        s,
        this.time,
        this.decay,
        this.terrain.readyStages,
        w.settings.reducedMotion,
      )
    ) {
      if (!this.environment.ready) {
        this.shape(
          [
            [0, 29, 0],
            [29, 29, 0],
            [29, 29, -48],
            [23, 29, -85],
            [18, 29, -61],
            [12, 29, -106],
            [5, 29, -67],
            [0, 29, -37],
          ],
          "#4d4839",
          "#272b27",
        );
        this.shape(
          [
            [29, 0, 0],
            [29, 29, 0],
            [29, 29, -48],
            [29, 23, -79],
            [29, 17, -55],
            [29, 10, -97],
            [29, 4, -54],
            [29, 0, -35],
          ],
          "#383d35",
          "#222a25",
        );
        for (let i = 0; i < 29; i++) {
          const h = 35 + noise(i, 31) * 55;
          this.shape(
            [
              [i, 29, -5],
              [i + 0.7, 29, -8],
              [i + 0.55, 29, -h],
              [i + 0.2, 29, -h - 11],
            ],
            i % 2 ? "#645b42" : "#393e31",
          );
          this.shape(
            [
              [29, i, -6],
              [29, i + 0.7, -8],
              [29, i + 0.4, -h - 8],
              [29, i + 0.1, -h],
            ],
            i % 2 ? "#4b4c3c" : "#2e362e",
          );
          if (i % 3 === 0) {
            const [rx, ry] = this.project(i + 0.5, 29, -15);
            this.line(
              [
                [rx, ry],
                [rx + 5 * s, ry + 20 * s],
                [rx - 3 * s, ry + 38 * s],
              ],
              "#242b21",
              2,
            );
            this.line(
              [
                [rx + 5 * s, ry + 20 * s],
                [rx + 13 * s, ry + 27 * s],
              ],
              "#242b21",
              1,
            );
          }
          if (i % 5 === 0) {
            const [rx, ry] = this.project(i, 29, -h - 24);
            this.poly(
              [
                [rx, ry],
                [rx + 5 * s, ry + 4 * s],
                [rx + 2 * s, ry + 12 * s],
                [rx - 4 * s, ry + 5 * s],
              ],
              "#65634c",
            );
          }
        }
      } else {
        // Overlapping painted strata follow both isometric edges; terrain covers the moss seam.
        for (const side of [0, 1]) {
          for (let i = 0; i < 10; i++) {
            const at = 1.45 + i * 2.9;
            const [rx, ry] =
              side === 0 ? this.project(at, 29) : this.project(29, at);
            c.save();
            c.translate(rx, ry - 4 * s);
            c.transform(1, side === 0 ? 0.5 : -0.5, 0, 1, 0, 0);
            c.filter = side === 0 ? "brightness(0.82)" : "brightness(0.64)";
            this.environment.draw(
              c,
              11,
              0,
              0,
              90 * s,
              (110 + noise(i, side) * 38) * s,
              0,
            );
            c.restore();
          }
        }
      }
    }
    // Soft contact shadow where the slab's lower edge meets the elephants.
    {
      const v = [
        this.project(5, 29, -118),
        this.project(29, 29, -126),
        this.project(29, 5, -118),
      ];
      c.save();
      c.lineJoin = "round";
      c.lineCap = "round";
      c.filter = `blur(${10 * s}px)`;
      c.strokeStyle = "rgba(8,12,10,0.6)";
      c.lineWidth = 26 * s;
      c.beginPath();
      c.moveTo(v[0][0], v[0][1] + 16 * s);
      c.lineTo(v[1][0], v[1][1] + 16 * s);
      c.lineTo(v[2][0], v[2][1] + 16 * s);
      c.stroke();
      c.restore();
    }
    // The curtain hangs from the brink and thins with the displayed reserve.
    const level = this.waterLevel.shown ?? w.water,
      wetLevel = this.waterLevel.wet,
      lipX = riverCenter(29),
      lipHalf = waterHalfWidth(level, 29),
      wetHalf = Math.max(lipHalf, waterHalfWidth(wetLevel, 29));
    this.waterfall.draw(c, {
      left: this.project(lipX - lipHalf, 29),
      right: this.project(lipX + lipHalf, 29),
      wetLeft: this.project(lipX - wetHalf, 29),
      wetRight: this.project(lipX + wetHalf, 29),
      level,
      wet: wetLevel,
      time: this.time,
      scale: s,
      dpr: this.canvas.width / Math.max(1, this.width),
      texture: this.terrain.ready ? this.terrain.materials[3] : null,
    });
    const paintedGround = this.terrain.draw(
      c,
      w,
      this.project(0, 0),
      s,
      { level, wet: wetLevel },
      this.time,
      this.foundation.activeTransition,
    );
    const wet = 1 - w.vegetation / 100;
    const riverX = (y: number) => 3.7 + Math.sin(y * 0.24) * 1.6;
    if (!paintedGround)
      for (let sum = 0; sum < 58; sum++)
        for (let x = 0; x < 29; x++) {
          const y = sum - x;
          if (y < 0 || y >= 29) continue;
          const n = noise(x, y),
            river = Math.abs(x - riverX(y)),
            waterWidth = riverHalfWidth({ water: level });
          const path = onLane(x + 0.5, y + 0.5);
          const farm =
            x >= field.x &&
            x < field.x + field.width &&
            y >= field.y &&
            y < field.y + field.height;
          let color = mix(
            n > 0.5 ? "4d5940" : "505c42",
            n > 0.5 ? "77664c" : "7b6a4e",
            wet,
          );
          if (river < waterWidth)
            color = mix(n > 0.5 ? "4f8e8b" : "548f89", "74877b", p);
          else if (river < 1.9) color = mix("9b9d70", "b7a27c", p);
          if (path) color = n > 0.5 ? "#827b68" : "#857d69";
          if (farm) color = n > 0.5 ? "#786449" : "#826b4e";
          this.tile(x, y, color);
          // Stable, world-anchored material detail rather than flat colored diamonds.
          for (let k = 0; k < 20; k++) {
            const u = noise(x * 29 + k, y + 13),
              v = noise(y * 31 + k, x + 7),
              [tx, ty] = this.project(x + u, y + v);
            if (river < waterWidth) {
              this.line(
                [
                  [tx, ty],
                  [tx + 3 * s, ty - s],
                ],
                k % 3 ? "#b3c0a51b" : "#182d3655",
                0.65,
              );
              continue;
            }
            c.fillStyle = k % 3 === 0 ? "#d6ca9e27" : "#131d1850";
            c.fillRect(tx, ty, (1 + noise(k, x) * 2) * s, 0.8 * s);
            if (!path && !farm && wet < 0.7 && k % 3 === 0)
              this.line(
                [
                  [tx, ty],
                  [tx + (u - 0.5) * 4 * s, ty - (2 + v * 4) * s],
                ],
                k % 2 ? "#91a06a77" : "#263d2f99",
                0.7,
              );
            if (path && k < 5) {
              c.strokeStyle = "#b5aa8c45";
              c.lineWidth = 0.5 * s;
              c.strokeRect(tx, ty, 3 * s, 1.5 * s);
            }
          }

          if (river < waterWidth && n > 0.55) {
            const [a, b] = this.project(x + 0.2, y + 0.4);
            this.line(
              [
                [a, b],
                [a + 9 * s, b - 3 * s],
              ],
              "#a2c6ae55",
              1,
            );
          }
          if (!path && river > 2 && !farm && n > 0.6) {
            const [a, b] = this.project(x + 0.4, y + 0.6);
            this.line(
              [
                [a, b],
                [a - 2 * s, b - 3 * s],
              ],
              wet > 0.5 ? "#96855a" : "#5e784b",
              1,
            );
            if (n > 0.88 && wet < 0.4) {
              c.fillStyle = "#dbcb8c";
              c.fillRect(a, b - 3 * s, 2 * s, 2 * s);
            }
          }
          if (p > 0.4 && river > 2 && !path && n > 0.77) {
            const [a, b] = this.project(x + 0.3, y + 0.4);
            this.line(
              [
                [a - 4 * s, b],
                [a, b + 2 * s],
                [a + 2 * s, b - 1 * s],
              ],
              "#77674755",
              0.8,
            );
          }
        }
    // Shared crossing coordinates keep the visible bridges and navigation aligned.
    // Fractional stage: sprites cross-fade instead of popping at 55 % and 18 %.
    const waterStage =
      level >= 62
        ? 0
        : level > 48
          ? (62 - level) / 14
          : level >= 24
            ? 1
            : level > 12
              ? 1 + (24 - level) / 12
              : 2;
    const staged = (stage: number, draw: (index: number) => void) => {
      const low = Math.floor(stage),
        t = stage - low;
      draw(low);
      if (t > 0.01 && low < 2) {
        c.save();
        c.globalAlpha = t;
        draw(low + 1);
        c.restore();
      }
    };
    const infrastructureStage = (condition: number) =>
      condition > 70 ? 0 : condition > 35 ? 1 : 2;
    for (const row of bridgeRows) {
      const bx = riverCenter(row + 0.5),
        [px, py] = this.project(bx, row + 0.5);
      if (this.waterworks.ready) {
        const stage = infrastructureStage(w.buildings[14].condition);
        c.save();
        c.translate(px, py);
        c.scale(-1, 1);
        this.waterworks.draw(c, stage * 4, 0, 14 * s, 128 * s, 69 * s);
        c.restore();
      } else
        this.box(bx - 2.3, row, 4.6, 1, 5, "#aa936c", "#75684e", "#8d7959", 3);
    }
    const objects: { depth: number; draw: () => void }[] = [];
    const well = w.buildings[8];
    objects.push({
      depth: well.x + well.y + 1.1,
      draw: () => {
        const [wx, wy] = this.project(well.x + 0.55, well.y + 0.55);
        if (this.waterworks.ready)
          staged(
            Math.max(waterStage, infrastructureStage(well.condition)),
            (i) => this.waterworks.draw(c, i * 4 + 1, wx, wy + 10 * s, 57 * s),
          );
        else this.environment.draw(c, 7, wx, wy + 10 * s, 57 * s);
        this.hits.push({
          x: wx,
          y: wy - 15 * s,
          id: well.id,
          kind: "building",
        });
      },
    });
    const [rx, ry] = this.project(24.3, 9.3);
    if (this.waterworks.ready)
      staged(
        Math.max(waterStage, infrastructureStage(w.buildings[13].condition)),
        (i) => this.waterworks.draw(c, i * 4 + 2, rx, ry + 17 * s, 112 * s),
      );
    else this.box(23, 8, 2.7, 2.5, 7, "#a5a581", "#707e6a", "#87927a");
    this.hits.push({ x: rx, y: ry, id: 13, kind: "building" });
    for (const row of [6, 23]) {
      const [px, py] = this.project(riverCenter(row) + 2.2, row + 0.5);
      if (this.waterworks.ready)
        staged(waterStage, (i) =>
          this.waterworks.draw(c, i * 4 + 3, px, py + 7 * s, 55 * s, 30 * s),
        );
    }
    for (const b of w.buildings)
      if (!["well", "farm", "reservoir"].includes(b.type))
        objects.push({ depth: b.x + b.y + 1.5, draw: () => this.house(b, w) });
    if (this.crops.ready) {
      for (let row = 0; row < cropRows; row++) {
        const growth = w.cropGrowth?.[row] ?? initialGrowth(row);
        for (let col = 0; col < 8; col++) {
          const variation = noise(row + 62, col);
          const x = field.x + 0.45 + col * 0.72 + variation * 0.13;
          const y = cropRowY(row) + (noise(col + 32, row) - 0.5) * 0.13;
          const maturity = Math.min(
            3,
            Math.floor((growth + variation * 0.05) * 4),
          );
          objects.push({
            depth: x + y,
            draw: () => {
              const [px, py] = this.project(x, y);
              this.crops.draw(
                c,
                (row % 3) * 4 + maturity,
                px,
                py,
                (21 + variation * 4) * s,
                variation > 0.5,
              );
            },
          });
        }
      }
    }
    if (this.hens.ready) {
      for (const hen of foragingHens(this.time)) {
        objects.push({
          depth: hen.x + hen.y,
          draw: () => {
            const [x, y] = this.project(hen.x, hen.y);
            this.ellipse(x, y, 8, 3, "#29231644");
            this.hens.draw(
              c,
              hen.breed * 8 + hen.frame,
              x,
              y,
              22 * s,
              hen.mirror,
            );
          },
        });
      }
    }
    // Trees surround the settlement, leaving the inhabited center readable.
    for (let i = 0; i < 135; i++) {
      const [x, y] = treePosition(i);
      if (
        Math.abs(x - riverX(y)) < 2.4 ||
        Math.abs(y - 15) < 1.4 ||
        (x > 5 && x < 25 && y > 5 && y < 24)
      )
        continue;
      objects.push({
        depth: x + y,
        draw: () =>
          this.tree(
            x,
            y,
            25 + noise(i, 3) * 25,
            p,
            this.time,
            w.localEnvironment?.trees[i]?.health ?? w.vegetation,
            w.localEnvironment?.trees[i]?.scorch ?? 0,
          ),
      });
    }
    for (const v of w.villagers) {
      if (indoors(v, w)) {
        // Show infants beside their own doorstep during the day, still under home care.
        const hour = (8 + w.tick / 12) % 24;
        if (needsHomeCare(v) && hour >= 9 && hour < 17) {
          const [x, y] = doorStep(w.buildings[v.home]);
          const t = (this.time + v.id) % 16;
          const outward = t < 3;
          const returning = t >= 10 && t < 13;
          const offset = Math.min(t / 3, 1, Math.max(0, (13 - t) / 3)) * 0.55;
          const infant: Villager = {
            ...v,
            x: x + offset,
            y: y + 0.3,
            target: [x + (returning ? -1 : 1), y + 0.3],
            action: outward || returning ? "Rampe au seuil" : "Joue au seuil",
          };
          objects.push({
            depth: infant.x + infant.y,
            draw: () => this.person(infant, w, selected, true),
          });
        }
        continue;
      }
      if (!v.dead && v.visit && v.visit.phase !== "approaching") continue;
      objects.push({
        depth: v.x + v.y,
        draw: () => this.person(v, w, selected),
      });
    }
    objects.sort((a, b) => a.depth - b.depth).forEach((o) => o.draw());
    const farm = this.project(
      field.x + field.width / 2,
      field.y + field.height / 2,
    );
    this.hits.push({ x: farm[0], y: farm[1], id: 9, kind: "building" });
    if (!w.settings.reducedMotion) {
      // Subtle moving cloud shadows and birds, never opaque over the town.
      const cloud = ((this.time * 8) % (this.width + 500)) - 250;
      this.ellipse(cloud, this.height * 0.4, 160, 35, "#1c302b0b");
      this.ellipse(cloud + 120, this.height * 0.4 + 30, 100, 25, "#1c302b09");
      drawSwallows(
        c,
        this.project(14, 14, 110),
        s,
        this.time,
        daylight(w.tick) * Math.min(1, Math.max(0, (0.7 - p) / 0.22)),
      );
      if (w.weather === "Neige légère") {
        // Flakes drift and wobble instead of falling straight.
        c.fillStyle = "#eef3f1";
        for (let i = 0; i < 90; i++) {
          const fall = 28 + noise(i, 34) * 30;
          const x =
              (noise(i, 33) * this.width +
                Math.sin(this.time * 0.9 + i) * 14 +
                this.time * 6) %
              this.width,
            y = (noise(i, 32) * this.height + this.time * fall) % this.height;
          c.globalAlpha = 0.45 + noise(i, 35) * 0.45;
          c.beginPath();
          c.arc(x, y, 0.8 + noise(i, 36) * 1.6, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      }
      const leaves = autumnColour(w.tick) * (1 - bareBranches(w.tick) * 0.6);
      if (leaves > 0.15 && p < 0.8) {
        // A few leaves let go and tumble across the island.
        for (let i = 0; i < Math.round(16 * leaves); i++) {
          const k =
            (this.time * (0.05 + noise(i, 41) * 0.04) + noise(i, 42)) % 1;
          const [lx, ly] = this.project(
            2 + noise(i, 43) * 25 + k * 5,
            2 + noise(i, 44) * 25 - k * 2,
            60 * (1 - k),
          );
          const spin = this.time * (2 + noise(i, 45) * 3) + i;
          c.save();
          c.translate(lx + Math.sin(spin * 0.7) * 6 * s, ly);
          c.rotate(spin);
          c.scale(1, Math.abs(Math.cos(spin)) * 0.8 + 0.2);
          c.globalAlpha = Math.min(1, Math.sin(Math.PI * k) * 2) * 0.9;
          c.fillStyle = ["#c0662a", "#d89a3a", "#a5462a", "#c98b2f"][i % 4];
          c.beginPath();
          c.ellipse(0, 0, 2.6 * s, 1.4 * s, 0, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }
      }
      if (w.weather === "Pluie légère") {
        c.strokeStyle = "#cad5ba55";
        c.lineWidth = 1;
        for (let i = 0; i < 65; i++) {
          const x = noise(i, 33) * this.width,
            y = (noise(i, 32) * this.height + this.time * 220) % this.height;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x - 3, y + 8);
          c.stroke();
        }
      }
      if (p > 0.65) {
        c.fillStyle = `rgba(189,153,99,${(p - 0.65) * 0.2})`;
        c.fillRect(0, 0, this.width, this.height);
      }
    }
    this.apocalypseScene(w);
    this.lighting(w);
  }
  /** Light follows the displayed clock: golden dawn and dusk, lit homes at night. */
  lighting(w: World) {
    const c = this.ctx,
      s = this.scale;
    const tick = w.tick + (w.settings.reducedMotion ? 0 : this.interpolation);
    const night = 1 - daylight(tick),
      warm = goldenHour(tick);
    if (warm > 0.01) {
      c.fillStyle = `rgba(226, 132, 64, ${warm * 0.1})`;
      c.fillRect(0, 0, this.width, this.height);
    }
    if (night <= 0.01) return;
    c.fillStyle = `rgba(8, 15, 36, ${night * 0.55})`;
    c.fillRect(0, 0, this.width, this.height);
    c.save();
    c.globalCompositeOperation = "lighter";
    const glow = (x: number, y: number, r: number, alpha: number, sx = 1.5) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(255, 172, 88, ${alpha})`);
      g.addColorStop(0.45, `rgba(255, 150, 70, ${alpha * 0.35})`);
      g.addColorStop(1, "rgba(255, 140, 60, 0)");
      c.save();
      c.translate(x, y);
      c.scale(sx, 0.62);
      c.fillStyle = g;
      c.fillRect(-r, -r, r * 2, r * 2);
      c.restore();
    };
    for (const b of w.buildings) {
      if (["well", "farm", "reservoir"].includes(b.type) || b.condition < 15)
        continue;
      const home = b.type === "home";
      if (home && w.villagers.every((v) => v.home !== b.id || v.dead)) continue;
      const width = home ? 1.8 : b.type === "market" ? 2.8 : 2.3,
        depth = home ? 1.5 : 1.9;
      const [x, y] = this.project(b.x + width / 2, b.y + depth / 2);
      const flicker =
        0.86 +
        0.14 *
          Math.sin(this.time * 5.3 + b.id * 1.7) *
          Math.sin(this.time * 2.1 + b.id);
      glow(
        x,
        y + 4 * s,
        58 * s,
        night * 0.3 * flicker * (0.5 + b.condition / 200),
      );
    }
    // Walkers out after dark carry a small lantern.
    for (const v of w.villagers) {
      if (v.dead || !v.route.length) continue;
      const previous = this.previousPositions.get(v.id);
      let x = v.x,
        y = v.y;
      if (previous && !w.settings.reducedMotion) {
        x = previous[0] + (x - previous[0]) * this.interpolation;
        y = previous[1] + (y - previous[1]) * this.interpolation;
      }
      const [px, py] = this.project(x, y);
      const sway = Math.sin(this.time * 6 + v.id) * 1.2 * s;
      glow(px + 7 * s + sway, py - 14 * s, 18 * s, night * 0.4, 1);
    }
    for (const e of w.disasters ?? [])
      if (e.kind === "fire") {
        const [x, y] = this.project(e.x + 0.5, e.y + 0.5);
        glow(
          x,
          y - 10 * s,
          120 * s,
          night * 0.42 * (0.9 + 0.1 * Math.sin(this.time * 9 + e.x)),
          1.3,
        );
      }
    c.restore();
  }
  apocalypseScene(w: World) {
    const c = this.ctx,
      s = this.scale,
      t = this.time;
    const darkness = Math.max(0, (w.pressure - 45) / 55);
    c.fillStyle = `rgba(35,14,28,${darkness * 0.26})`;
    c.fillRect(0, 0, this.width, this.height);
    for (const b of w.buildings) {
      if (
        b.condition < 80 &&
        (!this.damagedBuildings.ready ||
          ["well", "farm", "reservoir"].includes(b.type))
      ) {
        const [x, y] = this.project(b.x + 1, b.y + 1, 20);
        this.line(
          [
            [x - 12 * s, y - 8 * s],
            [x - 4 * s, y],
            [x - 8 * s, y + 5 * s],
            [x + 2 * s, y + 13 * s],
          ],
          "#3e352d",
          2,
        );
      }
    }
    for (const e of w.disasters ?? []) {
      const [x, y] = this.project(e.x + 0.5, e.y + 0.5);
      if (e.kind === "blight") {
        // Swarm of locusts drifting across the fields.
        c.save();
        c.fillStyle = "#3b2e16";
        const n = w.settings.reducedMotion ? 12 : 46;
        for (let i = 0; i < n; i++) {
          const a = this.time * (0.6 + noise(i, 1)) + i * 2.4;
          c.fillRect(
            x + Math.cos(a) * (60 + noise(i, 2) * 170) * s,
            y - 20 * s + Math.sin(a * 1.3) * (30 + noise(i, 3) * 80) * s,
            2.5 * s,
            1.6 * s,
          );
        }
        c.restore();
        continue;
      }
      if (e.kind === "quake" || e.kind === "plague") continue;
      if (e.kind === "fire") {
        const glow = c.createRadialGradient(
          x,
          y - 15 * s,
          0,
          x,
          y - 15 * s,
          75 * s,
        );
        glow.addColorStop(0, "#ff9b384d");
        glow.addColorStop(1, "#ff480000");
        c.fillStyle = glow;
        c.fillRect(x - 80 * s, y - 100 * s, 160 * s, 140 * s);
        if (this.flames.ready) {
          this.flames.draw(
            c,
            loopFrame(t, 12, 12, e.x * 3 + e.y, w.settings.reducedMotion),
            x,
            y + 4 * s,
            99 * s,
          );
        } else if (this.environment.ready) {
          this.environment.draw(c, 10, x, y + 4 * s, 58 * s, 99 * s);
        } else {
          for (let i = 0; i < 9; i++) {
            const dx = (i - 4) * 5 * s,
              h =
                (23 + noise(i, e.x) * 30) *
                (1 + 0.13 * Math.sin(t * 8 + i)) *
                s;
            this.poly(
              [
                [x + dx - 7 * s, y],
                [x + dx - 9 * s, y - h * 0.45],
                [x + dx + Math.sin(t * 5 + i) * 5 * s, y - h],
                [x + dx + 4 * s, y - h * 0.5],
                [x + dx + 8 * s, y],
              ],
              i % 2 ? "#e86324" : "#f19836",
            );
            this.poly(
              [
                [x + dx - 3 * s, y],
                [x + dx, y - h * 0.7],
                [x + dx + 4 * s, y],
              ],
              "#ffe291",
            );
          }
          for (let i = 0; i < 8; i++) {
            const k = (t * 0.15 + i / 8) % 1;
            this.ellipse(
              x + k * 28 * s,
              y - 45 * s - k * 90 * s,
              10 + k * 22,
              8 + k * 19,
              `rgba(39,33,32,${0.45 * (1 - k)})`,
            );
          }
        }
        this.bucketSplashes(w, e, x, y);
        for (let i = 0; i < 12; i++) {
          const k = (t * 0.4 + i / 12) % 1;
          c.fillStyle = "#ffc677";
          c.fillRect(
            x + (noise(i, 3) - 0.5) * 45 * s + k * 15 * s,
            y - k * 100 * s,
            2 * s,
            2 * s,
          );
        }
      } else if (e.kind === "monster") {
        const age = e.attackAt === undefined ? Infinity : w.tick - e.attackAt;
        const attacking = age >= 0 && age < 8;
        const phase = attacking
          ? 8 +
            (w.settings.reducedMotion
              ? 3
              : Math.min(7, Math.floor(Math.max(0, t / 0.2 - e.attackAt!))))
          : loopFrame(t, 8, 8, e.x + e.y, w.settings.reducedMotion);
        const victim = w.villagers[e.people[0]];
        const mirror = victim
          ? victim.x - e.x - (victim.y - e.y) < 0
          : e.x > 14;
        if (e.species === "wolf" || e.species === "wraith") {
          this.ellipse(x, y, 18, 5, "#10132155");
          if (e.species === "wolf") {
            this.wolves.draw(c, phase, x, y, 49 * s, mirror);
          } else {
            const drift = loopFrame(t, 8, 5, 0, w.settings.reducedMotion);
            const beat = attacking ? phase - 8 : -1;
            const thrust = beat < 0 ? 0 : [0, -3, -6, 9, 19, 12, 5, 0][beat];
            const direction = mirror ? -1 : 1;
            const sx = x + thrust * direction * s;
            this.wraiths.draw(c, drift, sx, y - 7 * s, 80 * s, mirror, 0.96);
            if (beat >= 3 && beat <= 5) {
              c.save();
              c.translate(sx, y - 32 * s);
              c.scale(direction * s, s);
              c.strokeStyle = beat === 4 ? "#e9fff0" : "#98d9c8a0";
              c.shadowColor = "#a4ffe0";
              c.shadowBlur = 9 * s;
              c.lineWidth = beat === 4 ? 3 : 1.5;
              c.beginPath();
              c.moveTo(5, -18);
              c.quadraticCurveTo(38, -12, 27, 13);
              c.stroke();
              c.restore();
            }
          }
          continue;
        }
        if (this.monsters.ready) {
          this.ellipse(x, y, 21, 7, "#100f1f66");
          this.monsters.draw(c, phase, x, y + 3 * s, 73 * s, mirror);
          continue;
        }
        if (this.environment.ready) {
          this.ellipse(x, y, 21, 7, "#100f1f66");
          c.save();
          c.translate(x, y);
          c.scale(e.x > 14 ? -1 : 1, 1);
          this.environment.draw(
            c,
            8 + (Math.floor(t * 3) % 2),
            0,
            3 * s,
            61 * s,
            73 * s,
          );
          c.restore();
          continue;
        }
        const bob = Math.sin(t * 3 + e.x) * 2 * s;
        this.ellipse(x, y, 16, 6, "#100f1f88");
        this.poly(
          [
            [x - 12 * s, y - 5 * s],
            [x - 15 * s, y - 25 * s + bob],
            [x - 8 * s, y - 39 * s + bob],
            [x + 7 * s, y - 41 * s + bob],
            [x + 15 * s, y - 24 * s + bob],
            [x + 10 * s, y - 3 * s],
          ],
          "#32343c",
        );
        this.poly(
          [
            [x - 8 * s, y - 34 * s + bob],
            [x - 16 * s, y - 53 * s + bob],
            [x - 3 * s, y - 40 * s + bob],
          ],
          "#a69e80",
        );
        this.poly(
          [
            [x + 5 * s, y - 39 * s + bob],
            [x + 17 * s, y - 55 * s + bob],
            [x + 11 * s, y - 32 * s + bob],
          ],
          "#ccc09a",
        );
        this.line(
          [
            [x - 10 * s, y - 25 * s + bob],
            [x - 22 * s, y - 16 * s],
            [x - 25 * s, y - 5 * s],
          ],
          "#42404a",
          5,
        );
        this.line(
          [
            [x + 12 * s, y - 26 * s + bob],
            [x + 24 * s, y - 18 * s],
            [x + 27 * s, y - 7 * s],
          ],
          "#42404a",
          5,
        );
        c.fillStyle = "#ff794d";
        c.fillRect(x - 7 * s, y - 32 * s + bob, 5 * s, 3 * s);
        c.fillRect(x + 3 * s, y - 32 * s + bob, 5 * s, 3 * s);
        for (const dx of [-6, 6])
          this.line(
            [
              [x + dx * s, y - 8 * s],
              [x + (dx + Math.sin(t * 5 + dx) * 3) * s, y + 3 * s],
            ],
            "#252932",
            5,
          );
      } else {
        for (let i = 0; i < 4; i++)
          this.ellipse(
            x + Math.sin(t * 4 + i) * 13 * s,
            y - 2 * s,
            6,
            3,
            "#bda17b44",
          );
      }
    }
    for (const v of w.villagers) {
      if (v.dead || (v.visit && v.visit.phase !== "approaching")) continue;
      const [x, y] = this.project(v.x, v.y);
      if (v.morale < 25) {
        c.fillStyle = "#decda4";
        c.font = `${12 * s}px Georgia`;
        c.textAlign = "center";
        c.fillText("…", x, y - 63 * s);
      }
    }
    if (darkness > 0) {
      for (let i = 0; i < 65; i++) {
        const x = noise(i, 57) * this.width,
          y =
            (noise(i, 58) * this.height + t * (8 + darkness * 16)) %
            this.height;
        c.fillStyle = i % 7 === 0 ? "#d9a47877" : "#b6ada244";
        c.fillRect(x, y, 1.5 * s, 1.5 * s);
      }
    }
  }
  /** Water thrown along arcs into the flames, and the steam it raises. */
  bucketSplashes(
    w: World,
    e: NonNullable<World["disasters"]>[number],
    x: number,
    y: number,
  ) {
    const c = this.ctx,
      s = this.scale,
      t = this.time;
    const crew = e.people
      .map((id) => w.villagers[id])
      .filter((v) => v && !v.dead && v.action.startsWith("Jette de l’eau"));
    if (!crew.length) return;
    for (const v of crew) {
      const [hx, hy] = this.project(v.x, v.y, 20);
      const arc = (k: number): Point => [
        hx + (x - hx) * k,
        hy + (y - 14 * s - hy) * k - Math.sin(Math.PI * k) * 26 * s,
      ];
      // The bucket's sheet of water, then the drops it breaks into.
      const head = (t * 1.7 + v.id * 0.31) % 1;
      c.strokeStyle = "#cfe7ea";
      c.lineCap = "round";
      c.lineWidth = 2.4 * s;
      c.globalAlpha = 0.7 * (1 - head);
      c.beginPath();
      for (let i = 0; i <= 6; i++) {
        const [px, py] = arc(
          Math.max(0, head - 0.25) + (Math.min(head, 0.25) * i) / 6,
        );
        if (i) c.lineTo(px, py);
        else c.moveTo(px, py);
      }
      c.stroke();
      for (let i = 0; i < 7; i++) {
        const k = (t * 1.7 + i / 7 + v.id * 0.31) % 1;
        const px = hx + (x - hx) * k,
          py = hy + (y - 14 * s - hy) * k - Math.sin(Math.PI * k) * 26 * s;
        c.globalAlpha = 0.85 - k * 0.4;
        c.fillStyle = i % 2 ? "#d7ecec" : "#9fcfd2";
        c.beginPath();
        c.ellipse(px, py, (1.8 + k) * s, (2.6 - k) * s, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    for (let i = 0; i < 6; i++) {
      const k = (t * 0.45 + i / 6) % 1;
      c.globalAlpha = 0.32 * (1 - k) * Math.min(1, crew.length / 2);
      c.fillStyle = "#dfe5e0";
      c.beginPath();
      c.ellipse(
        x + (noise(i, e.x) - 0.5) * 34 * s + k * 12 * s,
        y - 30 * s - k * 80 * s,
        (9 + k * 20) * s,
        (7 + k * 15) * s,
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    c.globalAlpha = 1;
  }
  hit(x: number, y: number): Hit | undefined {
    return (
      [...this.hits]
        .reverse()
        .filter((h) => h.kind === "person")
        .find((h) =>
          h.bounds
            ? x >= h.bounds.left &&
              x <= h.bounds.right &&
              y >= h.bounds.top &&
              y <= h.bounds.bottom
            : Math.abs(h.x - x) < 18 * this.scale &&
              Math.abs(h.y - y) < 30 * this.scale,
        ) ??
      [...this.hits]
        .reverse()
        .find((h) =>
          h.bounds
            ? x >= h.bounds.left &&
              x <= h.bounds.right &&
              y >= h.bounds.top &&
              y <= h.bounds.bottom
            : Math.hypot(h.x - x, h.y - y) < 28 * this.scale,
        )
    );
  }
}
