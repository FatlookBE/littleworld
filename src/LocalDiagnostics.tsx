import { useState } from "react";
import { failedPaintedImages } from "./asset-status";
import { restore } from "./core/persistence";
import type { World } from "./core/types";

type Report = {
  backup: string;
  duplicateCount: number;
  failedImages: string[];
};

export function LocalDiagnostics({
  world,
  saveStatus,
  syncError,
}: {
  world: World;
  saveStatus: string;
  syncError: string;
}) {
  const [report, setReport] = useState<Report | null>(null);
  function check() {
    const ids = new Set(
      world.usage.map((event) => JSON.stringify([event.origin, event.id])),
    );
    let backup = "L’export de ce village peut être restauré.";
    try {
      restore(JSON.stringify(world));
    } catch (error) {
      backup =
        error instanceof Error ? error.message : "Export impossible à valider.";
    }
    setReport({
      backup,
      duplicateCount: world.usage.length - ids.size,
      failedImages: failedPaintedImages(),
    });
  }
  return (
    <details>
      <summary>Diagnostic local</summary>
      <p className="fine-print">
        {saveStatus}. {syncError || "L’état du pont figure en haut du panneau."}
      </p>
      <button className="full-button" onClick={check}>
        Vérifier les données et les images
      </button>
      {report && (
        <div role="status">
          <p>{report.backup}</p>
          <p>
            {report.duplicateCount === 0
              ? "Aucun doublon dans les relevés conservés."
              : `${report.duplicateCount} doublon(s) détecté(s) dans les relevés.`}
          </p>
          {report.failedImages.length === 0 ? (
            <p>Aucun échec parmi les images demandées.</p>
          ) : (
            <>
              <p>Images que le jeu n’a pas pu charger :</p>
              <ul>
                {report.failedImages.map((path) => (
                  <li key={path}>{path.split("/").at(-1)}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </details>
  );
}
