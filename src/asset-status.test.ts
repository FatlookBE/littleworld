import { expect, it } from "vitest";
import { failedPaintedImages, loadPaintedImage } from "./asset-status";

it("reports only a requested image that failed and clears its failure on a successful retry", () => {
  const path = "/assets/test-painted-tile.png";
  const image = () => new EventTarget() as HTMLImageElement;
  const failed = image();
  loadPaintedImage(failed, path);
  expect(failedPaintedImages()).not.toContain(path);
  failed.dispatchEvent(new Event("error"));
  expect(failedPaintedImages()).toContain(path);
  const retried = image();
  loadPaintedImage(retried, path);
  retried.dispatchEvent(new Event("load"));
  expect(failedPaintedImages()).not.toContain(path);
});
