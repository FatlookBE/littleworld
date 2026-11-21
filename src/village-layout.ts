// Coordinates are in village tiles, shared by the painted and loading terrain.
export const field = { x: 6, y: 21, width: 6, height: 5 };
export const lanes: [number, number][][] = [
  [
    [3.7, 15.5],
    [5, 15.7],
    [6, 16.45],
    [9, 16.65],
    [13, 16.55],
    [16, 17.05],
    [18.7, 17.05],
    [19.35, 16.05],
    [19.35, 15.1],
    [22.2, 14.8],
    [28, 15],
  ],
  [
    [11.8, 10.95],
    [11.85, 13.5],
    [12, 16.6],
    [12.4, 20.15],
    [10.9, 20.36],
    [8.2, 20.36],
  ],
  [
    [7.5, 11.4],
    [10, 11.4],
    [11.8, 10.95],
    [15.3, 11.05],
    [18.7, 10.85],
  ],
  [
    [11.85, 14.55],
    [12.55, 14.75],
    [13.5, 14.85],
  ],
];
export function onLane(x: number, y: number) {
  return lanes.some((points) =>
    points.some(([bx, by], i) => {
      if (!i) return false;
      const [ax, ay] = points[i - 1];
      const dx = bx - ax,
        dy = by - ay;
      const t = Math.max(
        0,
        Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)),
      );
      return Math.hypot(x - ax - t * dx, y - ay - t * dy) < 0.55;
    }),
  );
}
