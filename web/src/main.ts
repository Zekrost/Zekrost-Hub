import { mount } from "@deijose/nix-js";
import { App } from "./app/App";
import { initSyncAuto } from "./sync/client";
import { initLocal } from "./data/store";
import "./style.css";

mount(new App(), "#app");

// Offline-first (P2): el mirror local es la fuente de lectura; el sync
// es opcional y converge.
initLocal();
initSyncAuto();
