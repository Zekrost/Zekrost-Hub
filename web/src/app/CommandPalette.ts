import { NixComponent, html, signal, type NixTemplate } from "@deijose/nix-js";
import { invalidateQueries } from "@deijose/nix-query";
import { router } from "../router";
import { docsApi, getToken, tasksApi, workspacesApi } from "../api/client";
import { currentRole } from "../api/role";
import { fuzzyMatch, showPrompt, showToast } from "../ui/kit";

type PaletteKind = "action" | "workspace" | "doc" | "task";

interface PaletteItem {
  kind: PaletteKind;
  label: string;
  sub: string;
  icon: string;
  action: () => void;
}

const ICONS: Record<PaletteKind, string> = {
  action:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  workspace:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  doc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  task: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>',
};

// Command palette universal (Ctrl+K): búsqueda difusa en acciones,
// workspaces, documentos y tareas. Teclado primero (Raycast-style).
export class CommandPalette extends NixComponent {
  private open = signal(false);
  private query = signal("");
  private selected = 0;
  private items = signal<PaletteItem[]>([]);

  toggle(): void {
    this.open.value = !this.open.value;
    if (this.open.value) {
      this.query.value = "";
      this.selected = 0;
      void this.build();
    }
  }

  close(): void {
    this.open.value = false;
  }

  private async build(): Promise<void> {
    const q = this.query.value.toLowerCase();
    const items: PaletteItem[] = [];

    items.push({
      kind: "action",
      label: "Nueva tarea…",
      sub: "Quick Add Magic",
      icon: "action",
      action: () => {
        void showPrompt("Nueva tarea", 'ej. "llamar al cliente mañana @ventas !alta"').then((text) => {
          if (!text) return;
          void currentRole().then((role) => {
            if (role === "viewer") {
              showToast("rol viewer: solo lectura");
              return;
            }
            tasksApi
              .quickAdd(text)
              .then((t) => {
                showToast(`Tarea creada: ${t.title}`);
                invalidateQueries("tasks/open");
                invalidateQueries("tasks/done");
              })
              .catch((e: Error) => showToast(e.message));
          });
        });
      },
    });
    items.push({ kind: "action", label: "Nuevo documento", sub: "Crear en el workspace", icon: "doc", action: () => router.navigate("/docs") });
    items.push({ kind: "action", label: "Ir a Tareas", sub: "Kanban · tabla · calendario", icon: "action", action: () => router.navigate("/tasks") });
    items.push({ kind: "action", label: "Ir al Grafo", sub: "Relaciones entre documentos", icon: "action", action: () => router.navigate("/graph") });

    if (getToken()) {
      try {
        const { workspaces } = await workspacesApi.list();
        for (const ws of workspaces) {
          items.push({
            kind: "workspace",
            label: ws.name,
            sub: `workspace · ${ws.role}`,
            icon: "workspace",
            action: () => router.navigate("/"),
          });
        }
        const { docs } = await docsApi.list();
        for (const d of docs) {
          items.push({ kind: "doc", label: d.title, sub: d.path, icon: "doc", action: () => router.navigate("/docs/" + d.id) });
        }
        const open = (await tasksApi.list(false)).tasks;
        const done = (await tasksApi.list(true)).tasks;
        for (const t of [...open, ...done].slice(0, 30)) {
          items.push({
            kind: "task",
            label: t.title,
            sub: t.done === 1 ? "hecha" : t.project ? "@" + t.project : "tarea",
            icon: "task",
            action: () => router.navigate("/docs/" + t.doc_id),
          });
        }
      } catch {
        /* sin sesión */
      }
    }

    this.items.value = q ? items.filter((it) => fuzzyMatch(q, it.label + " " + it.sub)) : items;
    this.selected = 0;
  }

  private keydown(ev: KeyboardEvent): void {
    if (ev.key === "Escape") {
      this.close();
    } else if (ev.key === "ArrowDown") {
      ev.preventDefault();
      this.selected = Math.min(this.items.value.length - 1, this.selected + 1);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      this.selected = Math.max(0, this.selected - 1);
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      const it = this.items.value[this.selected];
      if (it) {
        it.action();
        this.close();
      }
    }
  }

  render(): NixTemplate {
    const groupLabel: Record<PaletteKind, string> = {
      action: "Acciones",
      workspace: "Workspaces",
      doc: "Documentos",
      task: "Tareas",
    };
    const order: PaletteKind[] = ["action", "workspace", "doc", "task"];
    return html`
      ${() =>
        this.open.value
          ? html`
              <div class="palette-backdrop" @click=${(ev: MouseEvent) => {
                if ((ev.target as HTMLElement).classList.contains("palette-backdrop")) this.close();
              }}>
                <div class="palette">
                  <div class="palette-input">
                    <span class="palette-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    </span>
                    <input autocomplete="off" placeholder="Buscar documentos, tareas o ejecutar acciones…"
                      value=${() => this.query.value}
                      @input=${(ev: Event) => {
                        this.query.value = (ev.target as HTMLInputElement).value;
                        void this.build();
                      }}
                      @keydown=${(ev: KeyboardEvent) => this.keydown(ev)} />
                  </div>
                  <div class="palette-results">
                    ${() =>
                      order.map((kind) => {
                        const group = this.items.value.filter((it) => it.kind === kind);
                        if (!group.length) return "";
                        return html`
                          <div class="palette-section-label">${groupLabel[kind]}</div>
                          ${group.map((it) => html`
                            <div class=${"palette-item" + (this.items.value.indexOf(it) === this.selected ? " selected" : "")}
                              @click=${() => {
                                it.action();
                                this.close();
                              }}
                              @mouseenter=${() => (this.selected = this.items.value.indexOf(it))}>
                              <span class="pi-icon">${ICONS[it.kind]}</span>
                              <span class="pi-text">${it.label}<span class="pi-sub"> · ${it.sub}</span></span>
                            </div>`)}`;
                      })}
                    ${() =>
                      this.items.value.length === 0
                        ? html`<div class="palette-empty">Sin resultados</div>`
                        : ""}
                  </div>
                  <div class="palette-footer">
                    <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
                    <span><kbd>Enter</kbd> abrir</span>
                    <span><kbd>Esc</kbd> cerrar</span>
                  </div>
                </div>
              </div>
            `
          : ""}
    `;
  }
}
