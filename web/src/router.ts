import { createRouter, type RouteRecord } from "@deijose/nix-js";
import { HomePage } from "./modules/home/HomePage";
import { DocsPage } from "./modules/docs/DocsPage";
import { DocEditorPage } from "./modules/docs/DocEditorPage";
import { TasksPage } from "./modules/tasks/TasksPage";
import { SearchPage } from "./modules/search/SearchPage";
import { GraphPage } from "./modules/graph/GraphPage";
import { SettingsPage } from "./modules/settings/SettingsPage";

// Rutas con carga directa: el bundle es pequeño (<20 KB) y la navegación
// es instantánea sin estados de carga intermedios.
const routes: RouteRecord[] = [
  { path: "/", component: () => HomePage(), meta: { auth: false } },
  { path: "/docs", component: () => new DocsPage(), meta: { auth: false } },
  { path: "/docs/:id", component: () => new DocEditorPage(), meta: { auth: false } },
  { name: "tasks", path: "/tasks", component: () => new TasksPage(), meta: { auth: false } },
  { path: "/search", component: () => SearchPage(), meta: { auth: false } },
  { path: "/graph", component: () => new GraphPage(), meta: { auth: false } },
  { path: "/settings", component: () => SettingsPage(), meta: { auth: false } },
];

export const router = createRouter(routes, { mode: "hash" });
