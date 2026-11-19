import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
export const services = [
  {
    name: "application",
    port: 5174,
    args: [
      resolve(root, "node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "5174",
      "--strictPort",
    ],
  },
  {
    name: "pont",
    port: 5175,
    args: [resolve(root, "scripts/usage-server.mjs"), "5175"],
  },
];
export function checkPort(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error) =>
      reject(
        new Error(
          error.code === "EADDRINUSE"
            ? `Le port ${port} est déjà utilisé. Arrêtez le service existant avant de relancer npm start. Aucun processus existant n’a été arrêté.`
            : `Impossible d’ouvrir le port ${port} (${error.code}).`,
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}

/** Owns only its two children; never kills another process using these ports. */
export async function startServices({
  probe = checkPort,
  spawnChild = spawn,
  signals = process,
  log = console.log,
} = {}) {
  for (const service of services) await probe(service.port);
  const children = new Set();
  let stopping = false,
    exitCode = 0,
    forceTimer;
  let finish;
  const done = new Promise((resolve) => {
    finish = resolve;
  });
  const complete = () => {
    if (!stopping || children.size) return;
    clearTimeout(forceTimer);
    signals.removeListener("SIGINT", interrupt);
    signals.removeListener("SIGTERM", interrupt);
    finish(exitCode);
  };
  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true;
    exitCode = code;
    forceTimer = setTimeout(() => {
      for (const child of children) child.kill("SIGKILL");
    }, 3000);
    for (const child of children) child.kill("SIGTERM");
    complete();
  };
  const interrupt = () => stop(0);
  signals.on("SIGINT", interrupt);
  signals.on("SIGTERM", interrupt);
  log(
    "Démarrage de Tokenfall : http://localhost:5174/ et pont local :5175. Ctrl+C arrête les deux services.",
  );
  for (const service of services) {
    if (stopping) break;
    let child;
    try {
      child = spawnChild(process.execPath, service.args, {
        cwd: root,
        stdio: "inherit",
      });
    } catch (error) {
      log(`Échec du démarrage ${service.name} : ${error.message}`);
      stop(1);
      break;
    }
    children.add(child);
    child.once("error", (error) => {
      log(`Échec du démarrage ${service.name} : ${error.message}`);
      stop(1);
    });
    child.once("close", (code, signal) => {
      children.delete(child);
      if (!stopping) {
        log(
          `Le service ${service.name} s’est arrêté (${signal ?? code}). Arrêt de l’ensemble.`,
        );
        stop(code || 1);
      }
      complete();
    });
  }
  return { stop, done };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const running = await startServices();
    process.exitCode = await running.done;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
