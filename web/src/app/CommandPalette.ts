import { NixComponent, html, signal, type NixTemplate } from "@deijose/nix-js";
import { router } from "../router";
import { localDocs, localTasks } from "../data/store";
import { quickAddLocal } from "../data/mutations";
import { currentRole } from "../api/role";
import { fuzzyMatch, showPrompt, showToast } from "../ui/kit";

type PaletteKind = "action" | "doc" | "task";

interface PaletteItem {
  kind: PaletteKind;
  label: string;
  sub: string;
  action: () => void;
}

// Command palette (Ctrl+K) local-first: busca en el índice local
// (docs + tareas) — funciona sin conexión.
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
      this.rebuild();
    }
  }

  close(): void {
    this.open.value = false;
  }

  private rebuild(): void {
    const q = this.query.value.toLowerCase();
    const items: PaletteItem[] = [
      {
        kind: "action",
        label: "Nueva tarea…",
        sub: "Quick Add Magic",
        action: () => {
          void showPrompt("Nueva tarea", 'ej. "llamar al cliente mañana @ventas !alta"').then((text) => {
            if (!text) return;
            void currentRole().then((role) => {
              if (role === "viewer") {
                showToast("rol viewer: solo lectura");
                return;
              }
              quickAddLocal(text)
                .then((t) => showToast(t ? `Tarea creada: ${t.title}` : "No se pudo interpretar"))
                .catch((e: Error) => showToast(e.message));
            });
          });
        },
      },
      { kind: "action", label: "Nuevo documento", sub: "Crear en el workspace", action: () => router.navigate("/docs") },
      { kind: "action", label: "Ir a Tareas", sub: "Kanban · tabla · calendario", action: () => router.navigate("/tasks") },
      { kind: "action", label: "Ir al Grafo", sub: "Relaciones entre documentos", action: () => router.navigate("/graph") },
    ];

    for (const d of localDocs.value) {
      items.push({ kind: "doc", label: d.title, sub: d.path, action: () => router.navigate("/docs/" + d.id) });
    }
    for (const t of localTasks.value.slice(0, 40)) {
      items.push({
        kind: "task",
        label: t.title,
        sub: t.done ? "hecha" : t.project ? "@" + t.project : "tarea",
        action: () => router.navigate("/docs/" + t.docId),
      });
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
    const groupLabel: Record<PaletteKind, string> = { action: "Acciones", doc: "Documentos", task: "Tareas" };
    const order: PaletteKind[] = ["action", "doc", "task"];
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
                        this.rebuild();
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
