import { afterEach, expect, it, vi } from "vitest";

class AtlasImage {
  src = "";
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;
}

afterEach(() => vi.unstubAllGlobals());

it("keeps the fallback until the atlas is ready, then draws the cell at its ground anchor", async () => {
  const atlas = new AtlasImage();
  vi.stubGlobal("Image", vi.fn(function () { return atlas; }));
  const { drawPaintedProp } = await import("./painted-props");
  const drawImage = vi.fn();
  const c = { drawImage } as unknown as CanvasRenderingContext2D;

  expect(drawPaintedProp(c, "lantern", 13, 2, 24)).toBe(false);
  expect(atlas.src).toBe("/assets/painted-props.webp");
  atlas.complete = true;
  expect(drawPaintedProp(c, "lantern", 13, 2, 24)).toBe(false);
  expect(drawImage).not.toHaveBeenCalled();

  atlas.naturalWidth = 384;
  atlas.naturalHeight = 192;
  expect(drawPaintedProp(c, "lantern", 13, 2, 24)).toBe(true);
  expect(drawImage).toHaveBeenCalledWith(atlas, 192, 96, 96, 96, 1, -22, 24, 24);
  expect(drawPaintedProp(c, "bucket", -5, 3, 12)).toBe(true);
  expect(drawImage).toHaveBeenLastCalledWith(atlas, 96, 0, 96, 96, -11, -9, 12, 12);
});
