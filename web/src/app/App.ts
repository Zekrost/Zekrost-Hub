// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Link, NixComponent, RouterView, html, signal, type NixTemplate } from "@deijose/nix-js";
import { CommandPalette } from "./CommandPalette";
import { queueLength } from "../sync/queue";

const NAV = [
  { to: "/", label: "Inicio", icon: "🏠" },
  { to: "/docs", label: "Documentos", icon: "📄" },
  { to: "/tasks", label: "Tareas", icon: "✅" },
  { to: "/search", label: "Búsqueda", icon: "🔍" },
  { to: "/graph", label: "Grafo", icon: "🕸" },
  { to: "/settings", label: "Ajustes", icon: "⚙️" },
];

// Shell de la aplicación: navegación lateral + outlet del router +
// command palette global (Ctrl+K) + estado de sync.
export class App extends NixComponent {
  private palette = new CommandPalette();
  private online = signal(navigator.onLine);
  private pending = signal(0);

  onMount(): (() => void) | void {
    const refresh = () => {
      this.online.value = navigator.onLine;
      queueLength().then((n) => (this.pending.value = n));
    };
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        this.palette.toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    void refresh();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }

  render(): NixTemplate {
    return html`
      <div class="app-shell">
        <aside class="sidebar">
          <h1 class="brand">Zekrost Hub</h1>
          <p class="sync-indicator">
            <span class="dot ${() => (this.online.value ? "dot-on" : "dot-off")}"></span>
            ${() => (this.online.value ? "en línea" : "sin conexión")}
            ${() => (this.pending.value > 0 ? html` · ${this.pending.value} pendientes` : "")}
          </p>
          <nav>
            ${() =>
              NAV.map(
                (item) => new Link(item.to, `${item.icon} ${item.label}`),
              )}
          </nav>
          <button class="btn palette-trigger" @click=${() => this.palette.toggle()}>
            Buscar o crear… <kbd>Ctrl K</kbd>
          </button>
        </aside>
        <main class="content">${new RouterView()}</main>
        ${this.palette}
      </div>
    `;
  }
}
