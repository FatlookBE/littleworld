/**
 * Small ambient creatures living in the void around the world: glowing
 * jellyfish below the turtle, a tiny whale that crosses now and then, and
 * shooting stars. Purely decorative, deterministic from time, drawn behind
 * the world. Skipped entirely when reduced motion is requested.
 */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function jellyfish(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  t: number,
  hue: number,
) {
  const pulse = 1 + Math.sin(t * 2.2) * 0.12;
  const glow = c.createRadialGradient(x, y, 0, x, y, r * 3);
  glow.addColorStop(0, `hsla(${hue},80%,65%,0.28)`);
  glow.addColorStop(1, `hsla(${hue},80%,65%,0)`);
  c.fillStyle = glow;
  c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  c.strokeStyle = `hsla(${hue},70%,75%,0.45)`;
  c.lineWidth = Math.max(1, r * 0.08);
  for (let i = -2; i <= 2; i++) {
    c.beginPath();
    for (let k = 0; k <= 8; k++) {
      const yy = y + (k / 8) * r * 2.2;
      const xx =
        x + i * r * 0.32 + Math.sin(t * 2 + k * 0.7 + i) * r * 0.14 * (k / 8);
      if (k === 0) c.moveTo(xx, yy);
      else c.lineTo(xx, yy);
    }
    c.stroke();
  }
  c.fillStyle = `hsla(${hue},75%,72%,0.55)`;
  c.beginPath();
  c.ellipse(x, y, r, r * 0.7 * pulse, 0, Math.PI, 0);
  c.fill();
  c.fillStyle = `hsla(${hue},90%,88%,0.5)`;
  c.beginPath();
  c.ellipse(
    x - r * 0.25,
    y - r * 0.2,
    r * 0.25,
    r * 0.12,
    -0.4,
    0,
    Math.PI * 2,
  );
  c.fill();
}

function whale(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  t: number,
  dir: 1 | -1,
) {
  c.save();
  c.translate(x, y + Math.sin(t * 1.4) * 5 * s);
  c.scale(dir, 1);
  c.rotate(Math.sin(t * 1.4 + 1) * 0.05);
  c.fillStyle = "#3d5a6e";
  c.beginPath();
  c.ellipse(0, 0, 26 * s, 11 * s, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#6c8fa5";
  c.beginPath();
  c.ellipse(2 * s, 4 * s, 20 * s, 5 * s, 0, 0, Math.PI);
  c.fill();
  // Tail, flapping.
  c.save();
  c.translate(-24 * s, 0);
  c.rotate(Math.sin(t * 4) * 0.35);
  c.fillStyle = "#3d5a6e";
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(-9 * s, -4 * s, -14 * s, -11 * s);
  c.quadraticCurveTo(-10 * s, 0, -14 * s, 11 * s);
  c.quadraticCurveTo(-9 * s, 4 * s, 0, 0);
  c.fill();
  c.restore();
  c.fillStyle = "#101820";
  c.beginPath();
  c.arc(14 * s, -2 * s, 1.5 * s, 0, Math.PI * 2);
  c.fill();
  // Spout of little droplets.
  c.fillStyle = "#cfe8f288";
  for (let i = 0; i < 6; i++) {
    const k = (t * 1.2 + i / 6) % 1;
    c.beginPath();
    c.arc(
      10 * s + Math.sin(i * 2.1) * 6 * s * k,
      -10 * s - k * 24 * s,
      (1.8 - k) * s + 0.4,
      0,
      Math.PI * 2,
    );
    c.fill();
  }
  c.restore();
}

export function drawCritters(
  c: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number,
  cx: number,
  cy: number,
  scale: number,
) {
  // Jellyfish drifting in slow ellipses around the lower half of the turtle.
  for (let i = 0; i < 6; i++) {
    const a = time * (0.1 + hash(i) * 0.07) + i * 1.9,
      side = i % 2 ? 1 : -1;
    const x = cx + side * (620 + hash(i + 9) * 300 + Math.cos(a) * 60) * scale;
    const y = cy + (300 + hash(i + 3) * 700 + Math.sin(a * 1.3) * 50) * scale;
    jellyfish(
      c,
      x,
      y,
      (22 + hash(i + 5) * 16) * scale,
      time + i * 3,
      170 + i * 38,
    );
  }
  // A tiny whale swims across every 48 seconds.
  const cycle = 48,
    k = (time % cycle) / 16;
  if (k < 1) {
    const dir = Math.floor(time / cycle) % 2 ? -1 : 1;
    const x =
      dir === 1 ? -60 + k * (width + 120) : width + 60 - k * (width + 120);
    whale(
      c,
      x,
      cy + (380 + hash(Math.floor(time / cycle)) * 160) * scale,
      scale * 0.9,
      time,
      dir,
    );
  }
  // Shooting star every 13 seconds.
  const q = (time % 13) / 1.1;
  if (q < 1) {
    const n = Math.floor(time / 13),
      sx = hash(n) * width * 0.9,
      sy = hash(n + 1) * height * 0.35,
      x = sx + q * 260,
      y = sy + q * 130;
    const g = c.createLinearGradient(x, y, x - 90, y - 45);
    g.addColorStop(0, `rgba(255,244,214,${1 - q})`);
    g.addColorStop(1, "rgba(255,244,214,0)");
    c.strokeStyle = g;
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - 90, y - 45);
    c.stroke();
  }
}
