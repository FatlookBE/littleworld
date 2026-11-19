import { useEffect, useRef, useState } from "react";
import { VillageAudio } from "./village-audio";
import type { World } from "./core/types";

const volumeKey = "tokenfall-ambiance-volume";

function storedVolume() {
  try {
    const value = localStorage.getItem(volumeKey);
    if (value !== null && /^\d{1,3}$/.test(value))
      return Math.min(100, Number(value));
  } catch {
    // The volume remains usable if browser storage is disabled.
  }
  return 40;
}

export function useVillageAudio(world: World, paused: boolean) {
  const audio = useRef<VillageAudio | null>(null);
  const request = useRef(0);
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [volume, setVolume] = useState(storedVolume);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      request.current++;
      audio.current?.dispose();
      audio.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    const updateVolume = () => {
      audio.current?.setMix(volume / 100, !paused && !document.hidden);
    };
    updateVolume();
    document.addEventListener("visibilitychange", updateVolume);
    return () => document.removeEventListener("visibilitychange", updateVolume);
  }, [enabled, paused, volume]);

  useEffect(() => {
    if (enabled) audio.current?.setWorld(world);
  }, [enabled, world]);

  function changeVolume(value: number) {
    setVolume(value);
    try {
      localStorage.setItem(volumeKey, String(value));
    } catch {
      // The current volume still applies.
    }
  }

  async function toggle(on: boolean) {
    if (!on) {
      request.current++;
      audio.current?.dispose();
      audio.current = null;
      setEnabled(false);
      setPending(false);
      return;
    }
    if (audio.current) return;
    const activation = ++request.current;
    setPending(true);
    setError("");
    let engine: VillageAudio | undefined;
    let context: AudioContext | undefined;
    try {
      context = new AudioContext();
      engine = new VillageAudio(context);
      audio.current = engine;
      await engine.resume();
      if (request.current !== activation) return;
      // Prime previously running events before the master becomes audible.
      engine.setWorld(world);
      setEnabled(true);
    } catch {
      if (request.current !== activation) return;
      if (engine) engine.dispose();
      else if (context) void context.close().catch(() => {});
      audio.current = null;
      setError("Le navigateur n’a pas pu démarrer le son.");
    } finally {
      if (request.current === activation) setPending(false);
    }
  }

  return { enabled, pending, volume, error, toggle, changeVolume };
}
