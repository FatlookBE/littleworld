const failures = new Set<string>();

/** Observe existing image requests without issuing additional requests. */
export function loadPaintedImage(image: HTMLImageElement, path: string) {
  image.addEventListener?.("error", () => failures.add(path), { once: true });
  image.addEventListener?.("load", () => failures.delete(path), { once: true });
  image.src = path;
}

export function failedPaintedImages() {
  return [...failures].sort();
}
