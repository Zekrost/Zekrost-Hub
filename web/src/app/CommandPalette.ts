// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { NixComponent, html, signal, type NixTemplate } from "@deijose/nix-js";
import { invalidateQueries } from "@deijose/nix-query";
import { router } from "../router";
import { tasksApi } from "../api/client";
import { currentRole } from "../api/role";

const NAV_ITEMS = [
  { to: "/", label: "Inicio", hint: "ir a inicio" },
  { to: "/docs", label: "Documentos", hint: "listar documentos" },
  { to: "/tasks", label: "Tareas", hint: "ver el kanban" },
  { to: "/search", label: "Búsqueda", hint: "buscar en FTS" },
  { to: "/graph", label: "Grafo", hint: "relaciones entre docs" },
  { to: "/settings", label: "Ajustes", hint: "workspaces y export" },
];

// Command palette universal (Ctrl+K, sección 9.1): navegar, crear
// tareas con Quick Add Magic (sección 6.4) y ejecutar acciones. Cero
// fricción: todo por teclado.
export class CommandPalette extends NixComponent {
  private open = signal(false);
  private text = signal("");
  private status = signal("");

  toggle(): void {
    this.open.value = !this.open.value;
    if (this.open.value) {
      this.text.value = "";
      this.status.value = "";
    }
  }

  private close(): void {
    this.open.value = false;
  }

  private go(to: string): void {
    router.navigate(to);
    this.close();
  }

  private quickAdd(): void {
    const raw = this.text.value.trim();
    if (!raw) return;
    void currentRole().then((role) => {
      if (role === "viewer") {
        this.status.value = "rol viewer: solo lectura";
        return;
      }
      this._quickAdd(raw);
    });
  }

  private _quickAdd(raw: string): void {
    this.status.value = "creando…";
    tasksApi
      .quickAdd(raw)
      .then((t) => {
        this.status.value = `✓ tarea creada: ${t.title}`;
        this.text.value = "";
        // el kanban (y demás vistas) son proyecciones: se invalidan
        invalidateQueries("tasks/open");
        invalidateQueries("tasks/done");
      })
      .catch((e: Error) => (this.status.value = `error: ${e.message}`));
  }

  render(): NixTemplate {
    return html`
      ${() =>
        this.open.value
          ? html`
              <div class="palette-backdrop" @click=${() => this.close()}>
                <div class="palette" @click=${(ev: Event) => ev.stopPropagation()}>
                  <input
                    class="palette-input"
                    placeholder="Nueva tarea… (ej. revisar facturas #mañana @zekrost !alta)"
                    value=${() => this.text.value}
                    @input=${(ev: Event) => (this.text.value = (ev.target as HTMLInputElement).value)}
                    @keydown=${(ev: KeyboardEvent) => {
                      if (ev.key === "Escape") this.close();
                      if (ev.key === "Enter") this.quickAdd();
                    }}
                  />
                  <p class="palette-hint">
                    Quick Add Magic: la tarea se anexa a Inbox.md y se indexa
                  </p>
                  <nav class="palette-nav">
                    ${NAV_ITEMS.map(
                      (item) => html`
                        <button class="palette-item" @click=${() => this.go(item.to)}>
                          ${item.label}
                          <span class="muted">${item.hint}</span>
                        </button>
                      `,
                    )}
                  </nav>
                  <p class="palette-status">${() => this.status.value}</p>
                </div>
              </div>
            `
          : ""}
    `;
  }
}
