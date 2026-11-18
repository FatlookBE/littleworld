import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

import DecayDemo from "./DecayDemo";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {new URLSearchParams(location.search).get("demo") === "degradation" ? (
      <DecayDemo />
    ) : (
      <App />
    )}
  </StrictMode>,
);
