import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { clearChunkReloadFlag } from "@/lib/lazyWithRetry";
import "./index.css";

clearChunkReloadFlag();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
