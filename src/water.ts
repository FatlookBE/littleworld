import { riverCenter, riverHalfWidth } from "./core/navigation";

type Point = [number, number];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/**
 * Displayed reserve. The simulation moves in 0.2 s ticks and by jumps
 * (intervention, drinking); the picture follows it continuously, and the
 * banks it uncovers stay damp for a while before drying.
 */
export class WaterLevel {
  shown: number | null = null;
  wet = 0;
  last = 0;
  update(target: number, time: number, instant = false) {
    const dt = Math.max(0, Math.min(1, time - this.last));
    this.last = time;
    if (this.shown === null || instant || Math.abs(target - this.shown) > 45) {
      this.shown = this.wet = target;
      return this;
    }
    this.shown += (target - this.shown) * (1 - Math.exp(-dt / 1.1));
    // Freshly exposed silt dries over roughly ten simulated seconds.
    this.wet = Math.max(this.shown, this.wet - dt * 0.9);
    return this;
  }
}

/** Deeper pools hold water longest; the channel near the brink stays deep. */
export const channelDepth = (y: number) => {
  const raw = 0.76 + 0.19 * Math.sin(y * 0.61 + 1.1) + 0.09 * Math.sin(y * 1.37 + 0.4);
  const lip = smooth(25.5, 28.4, y);
  return Math.max(0.45, Math.min(1, raw + (0.96 - raw) * lip));
};

/**
 * Visible half width of the stream at row y. Never wider than the navigation
 * channel, so residents never appear to walk on water.
 */
export const waterHalfWidth = (level: number, y: number) => {
  const a = Math.pow(clamp01(level / 100), 0.7);
  if (a <= 0) return 0;
  const shallow = (1 - channelDepth(y)) * 0.5;
  const k = Math.max(0, (a - shallow) / (1 - shallow));
  const bank = 0.93 + 0.07 * Math.sin(y * 2.3 + 0.7) * Math.sin(y * 0.9);
  return Math.min(riverHalfWidth({ water: level }), 1.6 * k * bank);
};

const channel = (level: number, grow = 0) => {
  const left: Point[] = [],
    right: Point[] = [];
  for (let y = -1; y <= 30.01; y += 0.12) {
    const c = riverCenter(y),
      h = waterHalfWidth(level, y);
    const g = h > 0 ? grow : 0;
    left.push([c - h - g, y]);
    right.push([c + h + g, y]);
  }
  const path = new Path2D();
  left.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  for (let i = right.length - 1; i >= 0; i--) path.lineTo(...right[i]);
  path.closePath();
  return path;
};

/** River surface in island (tile) coordinates; the caller sets the iso transform. */
export function drawRiver(
  ctx: CanvasRenderingContext2D,
  level: number,
  wet: number,
  time: number,
  texture: HTMLCanvasElement,
  rain = false,
  frost = 0,
) {
  const a = Math.pow(clamp01(level / 100), 0.7);
  if (wet > level + 0.2) {
    // Damp silt where the water has just withdrawn.
    const damp = channel(wet, 0.06);
    ctx.globalAlpha = 0.5 * clamp01((wet - level) / 6);
    ctx.fillStyle = "#3a3021";
    ctx.fill(damp);
    ctx.strokeStyle = "#2b2418";
    ctx.lineWidth = 0.06;
    ctx.stroke(damp);
    ctx.globalAlpha = 1;
  }
  if (level <= 0.05) return;
  const water = channel(level);
  ctx.strokeStyle = "#3b3423b0";
  ctx.lineWidth = 0.18;
  ctx.lineJoin = "round";
  ctx.stroke(water);
  ctx.save();
  ctx.clip(water);
  ctx.fillStyle = "#2a6266";
  ctx.fillRect(-1, -1, 31, 31);
  // Two painted layers drift downstream at different speeds: the current.
  const flow = time * (0.18 + 0.75 * a);
  const layer = (size: number, dx: number, dy: number) => {
    const p = ctx.createPattern(texture, "repeat")!;
    p.setTransform(
      new DOMMatrix().translate(dx % size, dy % size).scale(size / 512),
    );
    return p;
  };
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = layer(7, 0, flow);
  ctx.fillRect(-1, -1, 31, 31);
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = layer(4.3, 1.7, flow * 1.7);
  ctx.fillRect(-1, -1, 31, 31);
  ctx.globalCompositeOperation = "color";
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#56817a";
  ctx.fillRect(-1, -1, 31, 31);
  ctx.globalCompositeOperation = "source-over";
  // Deep water darkens towards the channel's centre line.
  const center = new Path2D();
  for (let y = -1; y <= 30; y += 0.2)
    if (y === -1) center.moveTo(riverCenter(y), y);
    else center.lineTo(riverCenter(y), y);
  ctx.lineCap = "round";
  for (const [width, alpha] of [
    [1.9, 0.08],
    [1.3, 0.1],
    [0.7, 0.12],
  ]) {
    ctx.globalAlpha = alpha * a;
    ctx.strokeStyle = "#103743";
    ctx.lineWidth = width * a;
    ctx.stroke(center);
  }
  // Shallow, lighter margins and a lapping foam line along both banks.
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = "#86bba6";
  ctx.lineWidth = 0.62;
  ctx.stroke(water);
  ctx.globalAlpha = 0.38 + 0.14 * Math.sin(time * 1.6);
  ctx.strokeStyle = "#d9e6cc";
  ctx.lineWidth = 0.17;
  ctx.stroke(water);
  // Current lines follow the bed and run faster as they near the brink.
  ctx.strokeStyle = "#dbe9d8";
  ctx.lineWidth = 0.04;
  for (let k = 0; k < 56; k++) {
    const u = hash(k, 3) * 1.5 - 0.75,
      speed = (0.8 + hash(k, 5) * 0.9) * (0.12 + 0.95 * a),
      len = 0.9 + hash(k, 7) * 1.6;
    const head = ((time * speed + hash(k, 9) * 31) % 31) - 1;
    const rapid = 1 + smooth(25, 29, head) * 1.3;
    const fade = Math.min(1, (head + 1) / 2, (29.4 - head) / 1.2);
    if (fade <= 0 || waterHalfWidth(level, head) < 0.12) continue;
    ctx.globalAlpha = 0.22 * fade * (0.35 + 0.65 * a) * Math.min(1.5, rapid);
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const y = head - (len * rapid * i) / 6;
      const wave = Math.sin(y * 3.1 + k) * 0.06;
      const x = riverCenter(y) + (u + wave) * waterHalfWidth(level, y);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  // The smooth dark tongue, then the bright roll where water tips over the edge.
  const lipC = riverCenter(28.95),
    lipH = waterHalfWidth(level, 28.95);
  ctx.globalAlpha = 0.28 * a;
  ctx.strokeStyle = "#163f48";
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(lipC - lipH, 28.45);
  ctx.lineTo(lipC + lipH, 28.45);
  ctx.stroke();
  ctx.globalAlpha = 0.5 * Math.min(1, a * 3);
  ctx.strokeStyle = "#e6f0e2";
  ctx.lineWidth = 0.1;
  ctx.beginPath();
  ctx.moveTo(lipC - lipH, 28.95);
  ctx.lineTo(lipC + lipH, 28.95);
  ctx.stroke();
  // Raindrops ring the surface.
  if (rain) {
    ctx.strokeStyle = "#e3eee2";
    ctx.lineWidth = 0.03;
    for (let i = 0; i < 70; i++) {
      const y = hash(i, 17) * 29.5,
        h = waterHalfWidth(level, y);
      if (h < 0.15) continue;
      const q = (time * (0.9 + hash(i, 19) * 0.5) + hash(i, 23)) % 1;
      ctx.globalAlpha = 0.5 * (1 - q);
      ctx.beginPath();
      ctx.ellipse(
        riverCenter(y) + (hash(i, 29) * 1.6 - 0.8) * h,
        y,
        0.05 + q * 0.28,
        0.05 + q * 0.28,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  }
  // Thin ice creeps out from both banks in winter.
  if (frost > 0) {
    ctx.globalAlpha = 0.75 * frost;
    ctx.strokeStyle = "#e4eeee";
    ctx.lineWidth = 0.55 * frost;
    ctx.stroke(water);
    ctx.globalAlpha = 0.5 * frost;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.12;
    ctx.stroke(water);
  }
  // Sun glints that come and go on the surface.
  ctx.fillStyle = "#f6f1d8";
  for (let i = 0; i < 30; i++) {
    const y = hash(i, 11) * 29.5,
      h = waterHalfWidth(level, y);
    if (h < 0.2) continue;
    const twinkle = Math.max(0, Math.sin(time * 2.1 + i * 1.7));
    ctx.globalAlpha = 0.55 * Math.pow(twinkle, 6);
    ctx.beginPath();
    ctx.ellipse(
      riverCenter(y) + (hash(i, 13) * 1.4 - 0.7) * h,
      y + ((time * 0.4 * a) % 1) * 0.4,
      0.13,
      0.05,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}

type FallOptions = {
  left: Point;
  right: Point;
  wetLeft: Point;
  wetRight: Point;
  level: number;
  wet: number;
  time: number;
  scale: number;
  dpr: number;
  texture: HTMLCanvasElement | null;
};

/**
 * Painted curtain hanging from the island's front edge. It is composed on an
 * offscreen layer so that its texture, threads and foam share one soft mask,
 * then thins into strands, then into drops as the reserve empties.
 */
export class Waterfall {
  layer = document.createElement("canvas");
  mask = document.createElement("canvas");
  draw(c: CanvasRenderingContext2D, o: FallOptions) {
    const { time, scale: s } = o;
    const a = Math.pow(clamp01(o.level / 100), 0.7);
    const aw = Math.pow(clamp01(o.wet / 100), 0.7);
    // Outward is the cliff face's normal, projected: towards the viewer, left.
    const out: Point = [-0.89, 0.45];
    const fallLen = (150 + 300 * Math.sqrt(a)) * s;
    const arc = (4 + 18 * a) * s;
    const spread = (3 + 16 * a) * s;
    const at = (u: number, v: number): Point => {
      const bx = o.left[0] + (o.right[0] - o.left[0]) * u,
        by = o.left[1] + (o.right[1] - o.left[1]) * u;
      const push = arc * Math.sqrt(Math.min(1, v * 2.2));
      const sway = Math.sin(v * 5 - time * 1.8 + u * 3) * 1.3 * s * v;
      return [
        bx + out[0] * push + (u - 0.5) * 2 * spread * v + sway,
        by + out[1] * push + v * fallLen,
      ];
    };

    // Wet, darker rock behind the curtain lingers after the flow weakens.
    if (aw > 0.01) {
      const rock = (130 * s) / fallLen;
      const g = c.createLinearGradient(0, o.wetLeft[1], 0, o.wetLeft[1] + 130 * s);
      g.addColorStop(0, `rgba(10, 22, 22, ${0.38 * aw})`);
      g.addColorStop(1, "rgba(10, 22, 22, 0)");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(o.wetLeft[0] - 6 * s, o.wetLeft[1]);
      c.lineTo(o.wetRight[0] + 6 * s, o.wetRight[1]);
      c.lineTo(o.wetRight[0] + 9 * s, o.wetRight[1] + rock * fallLen);
      c.lineTo(o.wetLeft[0] - 9 * s, o.wetLeft[1] + rock * fallLen);
      c.closePath();
      c.fill();
    }
    if (a <= 0.004) return;

    const widthPx = Math.hypot(o.right[0] - o.left[0], o.right[1] - o.left[1]);
    const columns = Math.max(1, Math.min(36, Math.round(widthPx / (5 * s))));
    // Below ~45 % of the flow the sheet tears apart into separate strands.
    const tear = clamp01((0.5 - a) / 0.5) * 0.6;
    const strands: { u0: number; u1: number; len: number; tone: number }[] = [];
    for (let j = 0; j < columns; j++) {
      if (columns > 2 && hash(j, 21) < tear * 0.55) continue;
      const mid = (j + 0.5) / columns + (hash(j, 4) - 0.5) * tear * 0.6 / columns;
      const half = (0.5 / columns) * (1 - tear * (0.6 + hash(j, 6) * 0.4)) + 0.004;
      strands.push({
        u0: mid - half,
        u1: mid + half,
        len: 0.62 + hash(j, 2) * 0.38,
        tone: hash(j, 8),
      });
    }

    // Offscreen bounds, in CSS pixels.
    const pad = 14 * s;
    const minX = Math.min(o.left[0], at(0, 1)[0], at(0, 0.45)[0]) - pad;
    const maxX = Math.max(o.right[0], at(1, 1)[0]) + pad;
    const minY = Math.min(o.left[1], o.right[1]) - pad;
    const maxY = Math.max(o.left[1], o.right[1]) + fallLen + pad;
    const W = Math.ceil((maxX - minX) * o.dpr),
      H = Math.ceil((maxY - minY) * o.dpr);
    if (W < 2 || H < 2) return;
    for (const canvas of [this.layer, this.mask])
      if (canvas.width < W || canvas.height < H) {
        canvas.width = Math.max(canvas.width, W);
        canvas.height = Math.max(canvas.height, H);
      }
    const L = this.layer.getContext("2d")!,
      M = this.mask.getContext("2d")!;
    for (const ctx of [L, M]) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      ctx.setTransform(o.dpr, 0, 0, o.dpr, -minX * o.dpr, -minY * o.dpr);
    }
    // Ragged, slowly writhing strand edges instead of ruled lines.
    const edge = (u: number, v: number, seed: number): Point => {
      const [x, y] = at(u, v);
      const fray =
        (Math.sin(v * 13 + seed * 7.3 - time * 2.6) * 0.7 +
          Math.sin(v * 29 + seed * 3.1 - time * 4.1) * 0.35) *
        s *
        (0.4 + v * 2.2);
      return [x + fray, y];
    };
    const strandPath = (u0: number, u1: number, len: number) => {
      const p = new Path2D();
      for (let i = 0; i <= 16; i++) {
        const [x, y] = edge(u0, (i / 16) * len, u0 * 31);
        if (i) p.lineTo(x, y);
        else p.moveTo(x, y);
      }
      // A rounded, uneven foot rather than a square cut.
      const [bx, by] = at((u0 + u1) / 2, len);
      p.quadraticCurveTo(bx, by + 10 * s * (0.5 + hash(u0 * 97, 1)), ...edge(u1, len, u1 * 31));
      for (let i = 16; i >= 0; i--) p.lineTo(...edge(u1, (i / 16) * len, u1 * 31));
      p.closePath();
      return p;
    };

    // 1. Body colour, strand by strand, and the soft mask that shapes it.
    for (const st of strands) {
      const top = at((st.u0 + st.u1) / 2, 0)[1];
      const body = strandPath(st.u0 - 0.004, st.u1 + 0.004, st.len);
      const g = L.createLinearGradient(0, top, 0, top + fallLen * st.len);
      // Smooth and river-dark at the brink, breaking into white water lower down.
      g.addColorStop(0, "#3f7674");
      g.addColorStop(0.1, st.tone > 0.5 ? "#4d8682" : "#447b7a");
      g.addColorStop(0.3, st.tone > 0.6 ? "#3c6f72" : "#4b7f7f");
      g.addColorStop(0.55, st.tone > 0.35 ? "#6a9f98" : "#5a8e8b");
      g.addColorStop(0.78, "#9fc4ba");
      g.addColorStop(1, "#d6e6dc");
      L.fillStyle = g;
      L.fill(body);
      const m = M.createLinearGradient(0, top, 0, top + fallLen * st.len);
      m.addColorStop(0, "rgba(255,255,255,0.97)");
      m.addColorStop(0.5, "rgba(255,255,255,0.86)");
      m.addColorStop(0.8, "rgba(255,255,255,0.4)");
      m.addColorStop(1, "rgba(255,255,255,0)");
      M.fillStyle = m;
      M.fill(strandPath(st.u0, st.u1, st.len));
    }

    // 2. Painted water texture, stretched by the fall and racing downwards.
    if (o.texture) {
      const fast = (scaleX: number, scaleY: number, speed: number, dx: number) => {
        const p = L.createPattern(o.texture!, "repeat")!;
        const period = 512 * scaleY;
        p.setTransform(
          new DOMMatrix()
            .translate(minX + dx, minY + ((time * speed) % period))
            .scale(scaleX, scaleY),
        );
        return p;
      };
      L.globalAlpha = 0.7;
      L.globalCompositeOperation = "overlay";
      L.fillStyle = fast(0.16 * s, 0.95 * s, (150 + 120 * a) * s, 0);
      L.fillRect(minX, minY, maxX - minX, maxY - minY);
      L.globalCompositeOperation = "screen";
      L.globalAlpha = 0.22;
      L.fillStyle = fast(0.09 * s, 1.5 * s, (240 + 160 * a) * s, 37 * s);
      L.fillRect(minX, minY, maxX - minX, maxY - minY);
      L.globalCompositeOperation = "source-over";
    }

    // 3. White threads riding the curtain.
    L.lineCap = "round";
    const threads = Math.round(10 + 70 * a);
    for (let k = 0; k < threads; k++) {
      const st = strands[Math.floor(hash(k, 31) * strands.length)];
      if (!st) continue;
      const u = st.u0 + (st.u1 - st.u0) * hash(k, 33);
      const speed = (0.55 + hash(k, 35) * 0.5) * (0.75 + 0.25 * a);
      const v = (time * speed + hash(k, 37)) % 1;
      const len = (0.05 + hash(k, 39) * 0.1) * (0.6 + v);
      const [x0, y0] = at(u, v * st.len),
        [x1, y1] = at(u, Math.min(st.len, (v + len) * st.len));
      L.globalAlpha = (0.5 * Math.sin(Math.PI * v) + 0.12) * Math.min(1, 0.25 + v * 2);
      L.strokeStyle = hash(k, 41) > 0.3 ? "#f1f7ee" : "#bfe2d8";
      L.lineWidth = (0.45 + hash(k, 43) * 1.05) * s;
      L.beginPath();
      L.moveTo(x0, y0);
      L.lineTo(x1, y1);
      L.stroke();
    }
    // 4. Foam on the outer edges and the glossy roll at the brink.
    L.globalAlpha = 0.55 * clamp01(a * 3);
    L.strokeStyle = "#e9f3ea";
    L.lineWidth = 1.8 * s;
    for (const st of [strands[0], strands[strands.length - 1]]) {
      if (!st) continue;
      for (const u of st === strands[0] ? [st.u0 + 0.01] : [st.u1 - 0.01]) {
        L.beginPath();
        for (let i = 0; i <= 10; i++) {
          const [x, y] = at(u, (i / 10) * st.len * 0.8);
          if (i) L.lineTo(x, y);
          else L.moveTo(x, y);
        }
        L.stroke();
      }
    }
    // Broken highlights where the water rolls over the brink.
    L.strokeStyle = "#f4f9f0";
    L.lineWidth = 1.3 * s;
    for (let k = 0; k < 7; k++) {
      const u0 = hash(k, 101) * 0.85,
        u1 = Math.min(1, u0 + 0.08 + hash(k, 103) * 0.2);
      L.globalAlpha = 0.45 + 0.3 * Math.sin(time * 3 + k * 1.9);
      L.beginPath();
      for (let i = 0; i <= 4; i++) {
        const [x, y] = at(u0 + ((u1 - u0) * i) / 4, 0.006 + hash(k, 105) * 0.012);
        if (i) L.lineTo(x, y);
        else L.moveTo(x, y);
      }
      L.stroke();
    }

    // 5. Keep only the curtain, with its frayed, fading foot.
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.globalAlpha = 1;
    L.globalCompositeOperation = "destination-in";
    L.drawImage(this.mask, 0, 0);
    L.globalCompositeOperation = "source-over";
    c.save();
    c.globalAlpha = clamp01(a * 8);
    c.drawImage(this.layer, 0, 0, W, H, minX, minY, W / o.dpr, H / o.dpr);

    // 6. Spray falling free of the curtain, and mist where it dissolves.
    c.fillStyle = "#e4f0ea";
    const drops = Math.round(8 + 46 * a);
    for (let k = 0; k < drops; k++) {
      const st = strands[Math.floor(hash(k, 51) * strands.length)];
      if (!st) continue;
      const u = st.u0 + (st.u1 - st.u0) * hash(k, 53);
      const [sx, sy] = at(u, st.len * (0.45 + hash(k, 55) * 0.5));
      const q = (time * (0.5 + hash(k, 57) * 0.6) + hash(k, 59)) % 1;
      const r = (0.7 + hash(k, 61) * 1.4) * s;
      c.globalAlpha = 0.55 * (1 - q) * (0.4 + 0.6 * a);
      c.beginPath();
      c.ellipse(
        sx + (out[0] * 8 + (hash(k, 63) - 0.5) * 30) * q * s,
        sy + q * q * 120 * s,
        r * 0.6,
        r * 1.5,
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    const foot = at(0.5, 0.72);
    const mistWidth = Math.max(18 * s, widthPx * 0.7 + spread);
    for (let k = 0; k < 12; k++) {
      const q = (time * 0.08 + hash(k, 71)) % 1;
      const x =
        foot[0] + (hash(k, 73) - 0.5) * mistWidth * 1.8 + out[0] * 26 * q * s;
      const y = foot[1] + (q * 150 - 40) * s;
      const r = (22 + 46 * q) * s * (0.4 + 0.6 * a) * (0.7 + mistWidth / (160 * s));
      // Flattened veils rather than round puffs.
      const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
      const alpha = 0.06 * a * Math.sin(Math.PI * q);
      g.addColorStop(0, `rgba(222, 236, 230, ${alpha})`);
      g.addColorStop(0.6, `rgba(222, 236, 230, ${alpha * 0.4})`);
      g.addColorStop(1, "rgba(222, 236, 230, 0)");
      c.globalAlpha = 1;
      c.fillStyle = g;
      c.save();
      c.translate(x, y);
      c.scale(1.7, 0.75);
      c.fillRect(-r, -r, r * 2, r * 2);
      c.restore();
    }
    // Spray beads bouncing on the brink.
    c.fillStyle = "#f2f8f0";
    for (let k = 0; k < Math.round(3 + 10 * a); k++) {
      const u = hash(k, 81);
      const [x, y] = at(u, 0);
      const flick = Math.max(0, Math.sin(time * 9 + k * 2.3));
      c.globalAlpha = 0.6 * flick * Math.min(1, a * 3);
      c.beginPath();
      c.arc(x + out[0] * 3 * s * flick, y - 2 * s * flick, (0.6 + hash(k, 83)) * s, 0, Math.PI * 2);
      c.fill();
    }
    // As the stream fails, beads swell on the lip and drop one by one.
    const drip = clamp01((0.5 - a) / 0.25) * clamp01(o.level / 0.8);
    if (drip > 0) {
      c.fillStyle = "#bfe0d6";
      for (let k = 0; k < 5; k++) {
        const period = 0.9 + hash(k, 91) * 1.6;
        const q = (time / period + hash(k, 93)) % 1;
        const [x, y] = at(0.15 + hash(k, 95) * 0.7, 0);
        const swell = Math.min(1, q / 0.35);
        const fall = Math.max(0, (q - 0.35) / 0.65);
        const r = (0.8 + 1.2 * swell) * s;
        c.globalAlpha = drip * 0.85 * (1 - fall * fall);
        c.beginPath();
        c.ellipse(
          x + out[0] * 3 * s * fall,
          y + 1.5 * s + fall * fall * 260 * s,
          r * 0.75,
          r * (1 + fall * 1.6),
          0,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }
    c.restore();
  }
}
