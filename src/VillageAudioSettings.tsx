import type { useVillageAudio } from "./use-village-audio";

export function VillageAudioSettings({
  enabled,
  pending,
  volume,
  error,
  toggle,
  changeVolume,
}: ReturnType<typeof useVillageAudio>) {
  return (
    <fieldset className="village-audio-settings">
      <legend>Ambiance sonore</legend>
      <label className="check">
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending}
          onChange={(e) => void toggle(e.target.checked)}
        />{" "}
        Activer l’ambiance du village
      </label>
      <label className="field">
        Volume de l’ambiance · {volume} %
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={volume}
          onChange={(e) => changeVolume(e.target.valueAsNumber)}
        />
      </label>
      {pending && <p role="status">Démarrage du son…</p>}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
