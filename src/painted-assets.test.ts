/// <reference types="node" />
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("ships every full-resolution ruined pose pair and every gaunt animation sheet", () => {
  const names = [
    ...["withered", "ruined", "horror"].map(
      (stage) => `elephant-${stage}-cycle`,
    ),
    ...["withered", "ruined", "horror"].flatMap((stage) =>
      Array.from({ length: 4 }, (_, i) => `turtle-${stage}-hd-${i}`),
    ),
    ...["walk", "gather", "work", "drink", "eat", "hit"].map(
      (action) => `residents-gaunt-${action}`,
    ),
  ];
  for (const name of names) {
    const png = readFileSync(
      new URL(`../public/assets/${name}.png`, import.meta.url),
    );
    expect(png.subarray(1, 4).toString(), name).toBe("PNG");
    expect(png.readUInt32BE(16), `${name} width`).toBe(1536);
    expect(png.readUInt32BE(20), `${name} height`).toBe(1024);
  }
});

it("ships matching cliff and surface materials for every degraded earth stage", () => {
  for (const stage of ["withered", "ruined", "horror"]) {
    for (const [name, width, height] of [
      [`world-slab-${stage}`, 1536, 1024],
      [`terrain-${stage}`, 1254, 1254],
    ] as const) {
      const png = readFileSync(
        new URL(`../public/assets/${name}.png`, import.meta.url),
      );
      expect(png.subarray(1, 4).toString(), name).toBe("PNG");
      expect(png.readUInt32BE(16), name).toBe(width);
      expect(png.readUInt32BE(20), name).toBe(height);
    }
  }
});
