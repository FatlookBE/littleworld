import { useEffect, useRef, useState } from "react";
import { createWorld, step } from "./core/engine";
import { advanceDecayDemo } from "./core/decay-demo";
import { WorldRenderer } from "./world";

const monsterPreview =
  new URLSearchParams(location.search).get("vue") === "monstres";

export default function VillageDemo() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const zoom = useRef(1);
  const [run, setRun] = useState(0);
  const [pressure, setPressure] = useState(0);
  useEffect(() => {
    if (!canvas.current) return;
    const world = createWorld();
    if (monsterPreview) {
      while (world.tick <= 732) advanceDecayDemo(world);
    } else {
      world.replayOn = true;
    }
    world.settings.reducedMotion = matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const renderer = new WorldRenderer(canvas.current);
    let frame = 0,
      last = performance.now(),
      acc = 0;
    const draw = (now: number) => {
      acc += Math.min((now - last) / 1000, 0.25);
      last = now;
      while (acc >= 0.2) {
        renderer.capturePositions(world);
        if (monsterPreview) advanceDecayDemo(world);
        else step(world);
        acc -= 0.2;
      }
      renderer.interpolation = acc / 0.2;
      // Bring the village into view as the creatures reach the square.
      if (monsterPreview)
        renderer.zoom = world.settings.reducedMotion
          ? 2
          : 1 + 1.6 * Math.min(1, Math.max(0, (world.tick - 400) / 200));
      else renderer.zoom = zoom.current;
      const spectre = world.disasters?.find((e) => e.species === "wraith");
      if (
        monsterPreview &&
        spectre &&
        !world.settings.reducedMotion &&
        renderer.width
      ) {
        const [x, y] = renderer.project(spectre.x + 0.5, spectre.y + 0.5);
        renderer.pan[0] += (renderer.width * 0.5 - x) * 0.08;
        renderer.pan[1] += (renderer.height * 0.48 - y) * 0.08;
      }
      renderer.render(world, world.tick * 0.2 + acc, null);
      setPressure(Math.round(world.pressure));
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [run]);
  return (
    <main className="app">
      <canvas
        className="world"
        ref={canvas}
        onWheel={(e) => {
          zoom.current = Math.min(
            8,
            Math.max(0.55, zoom.current * Math.exp(-e.deltaY * 0.001)),
          );
        }}
        aria-label="Village de démonstration"
      />
      <nav className="demo-nav" aria-label="Commandes de la démo">
        <span>
          Démo simulée{monsterPreview ? " · Monstres" : ""} · Pression {pressure} %
        </span>
        {!monsterPreview && (
          <a href="?demo=village&vue=monstres">Voir les monstres</a>
        )}
        <button onClick={() => setRun(run + 1)}>Rejouer la démo</button>
        <a href="./">Retour à mon village</a>
      </nav>
    </main>
  );
}
