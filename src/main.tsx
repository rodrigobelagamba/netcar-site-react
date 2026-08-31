import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { recoverFromChunkLoadError } from "@/lib/lazyWithRetry";
import { initAnalytics } from "@/lib/analytics";
import "./index.css";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  recoverFromChunkLoadError();
});

async function startApplication() {
  if (import.meta.env.DEV) {
    const { installDevelopmentBootstrap } = await import(
      "@/lib/developmentBootstrap"
    );
    await installDevelopmentBootstrap();
  }

  initAnalytics();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void startApplication();
