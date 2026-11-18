import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

import VillageDemo from "./VillageDemo";

const demo = new URLSearchParams(location.search).get("demo");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {demo === "village" || demo === "degradation" ? <VillageDemo /> : <App />}
  </StrictMode>,
);
