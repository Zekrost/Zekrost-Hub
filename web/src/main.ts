// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { mount } from "@deijose/nix-js";
import { App } from "./app/App";
import { initSyncAuto } from "./sync/client";
import "./style.css";

mount(new App(), "#app");

// Offline-first (P2): al reconectar se replaya la cola de comandos.
initSyncAuto();

// PWA: registro del service worker (sección 8.3 — canal móvil v1.0)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("/sw.js").catch(() => {
    /* offline-first con el índice local; el SW es progresivo */
  });
}
