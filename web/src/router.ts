// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { createRouter, lazy } from "@deijose/nix-js";
import { HomePage } from "./modules/home/HomePage";

// Rutas con meta.auth; carga perezosa por módulo (sección 7.1).
export const router = createRouter(
  [
    { path: "/", component: () => HomePage(), meta: { auth: false } },
    {
      path: "/docs",
      component: lazy(() => import("./modules/docs/DocsPage")),
      meta: { auth: false },
    },
    {
      path: "/docs/:id",
      component: lazy(() => import("./modules/docs/DocEditorPage")),
      meta: { auth: false },
    },
    {
      path: "/tasks",
      component: lazy(() => import("./modules/tasks/TasksPage")),
      meta: { auth: false },
    },
    {
      path: "/search",
      component: lazy(() => import("./modules/search/SearchPage")),
      meta: { auth: false },
    },
    {
      path: "/graph",
      component: lazy(() => import("./modules/graph/GraphPage")),
      meta: { auth: false },
    },
    {
      path: "/settings",
      component: lazy(() => import("./modules/settings/SettingsPage")),
      meta: { auth: false },
    },
  ],
  { mode: "hash" }, // ADR-05: hash funciona dentro del WebView sin servidor
);
