import { ReplayAdapter } from "./core/telemetry";

/** Read-only local bridge: errors distinguish connection, server and data issues. */
export async function readUsageBridge(signal: AbortSignal) {
  let response: Response;
  try {
    response = await fetch("http://127.0.0.1:5175/usage?format=2", {
      cache: "no-store",
      signal,
    });
  } catch {
    throw new Error(
      signal.aborted
        ? "Le pont ne répond pas dans le délai de 8 secondes."
        : "Connexion au pont local impossible. Vérifiez qu’il est démarré.",
    );
  }
  if (!response.ok)
    throw new Error(`Le pont a renvoyé une erreur HTTP ${response.status}.`);
  try {
    const payload = await response.json();
    const daily = payload?.version === 2 && Array.isArray(payload.events);
    const events = new ReplayAdapter().read(
      JSON.stringify(daily ? payload.events : payload),
    );
    return {
      events,
      codexSessions:
        daily && Array.isArray(payload.codexSessions)
          ? payload.codexSessions.filter(
              (id: unknown): id is string => typeof id === "string",
            )
          : [],
      incomplete:
        daily &&
        Number.isSafeInteger(payload.incompleteCodexSessions) &&
        payload.incompleteCodexSessions > 0
          ? (payload.incompleteCodexSessions as number)
          : 0,
    };
  } catch {
    throw new Error(
      signal.aborted
        ? "Le pont ne répond pas dans le délai de 8 secondes."
        : "Les données reçues du pont sont illisibles ou incompatibles.",
    );
  }
}
