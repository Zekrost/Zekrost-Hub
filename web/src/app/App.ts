import { NixComponent, RouterView, html, signal, type NixTemplate } from "@deijose/nix-js";
import { CommandPalette } from "./CommandPalette";
import { router } from "../router";
import { docsApi, getToken, workspacesApi, type DocSummary } from "../api/client";
import { queueLength } from "../sync/queue";
import { escapeHtml } from "../ui/kit";

const NAV = [
  { to: "/", label: "Inicio", icon: "🏠" },
  { to: "/docs", label: "Documentos", icon: "📄" },
  { to: "/tasks", label: "Tareas", icon: "✅" },
  { to: "/search", label: "Búsqueda", icon: "🔍" },
  { to: "/graph", label: "Grafo", icon: "🕸" },
  { to: "/settings", label: "Ajustes", icon: "⚙️" },
];

const WS_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#3b82f6", "#8b5cf6"];

// Shell: sidebar (workspaces + docs + búsqueda) y topbar (breadcrumb,
// Cmd+K, estado de sync). La navegación sigue siendo el router.
export class App extends NixComponent {
  private palette = new CommandPalette();
  private online = signal(navigator.onLine);
  private pending = signal(0);
  private authed = signal(getToken() !== null);
  private workspaces = signal<Array<{ id: string; slug: string; name: string; role: string }>>([]);
  private docs = signal<DocSummary[]>([]);
  private activeWs = signal<string | null>(null);
  private searchQ = signal("");
  private sidebarOpen = signal(false);

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
      } else if (ev.key === "Escape") {
        this.palette.close();
      }
    };
    const onOpenDoc = (ev: Event) => {
      const id = (ev as CustomEvent<string>).detail;
      if (id) router.navigate("/docs/" + id);
    };
    const onDocsChanged = () => {
      if (this.activeWs.value) void this.loadDocs(this.activeWs.value);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("hub:open-doc", onOpenDoc);
    window.addEventListener("hub:docs-changed", onDocsChanged);
    void refresh();
    void this.loadWorkspaces();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hub:open-doc", onOpenDoc);
      window.removeEventListener("hub:docs-changed", onDocsChanged);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }

  private async loadWorkspaces(): Promise<void> {
    if (!getToken()) return;
    try {
      const { workspaces } = await workspacesApi.list();
      this.workspaces.value = workspaces;
      if (workspaces.length && !this.activeWs.value) {
        this.activeWs.value = workspaces[0].id;
        await this.loadDocs(workspaces[0].id);
      }
    } catch {
      /* sin sesión */
    }
  }

  private async loadDocs(wsId: string): Promise<void> {
    try {
      const { docs } = await docsApi.list();
      this.docs.value = docs;
      void wsId;
    } catch {
      this.docs.value = [];
    }
  }

  private selectWs(id: string): void {
    this.activeWs.value = id;
    void this.loadDocs(id);
  }

  render(): NixTemplate {
    return html`
      <div class="app-shell">
        <aside class=${"sidebar" + (this.sidebarOpen.value ? " open" : "")}>
          <div class="logo">
            <div class="logo-mark">Z</div>
            <span>Zekrost Hub</span>
          </div>
          <div class="sidebar-search">
            <input placeholder="Buscar en el workspace..."
              value=${() => this.searchQ.value}
              @input=${(ev: Event) => (this.searchQ.value = (ev.target as HTMLInputElement).value)} />
          </div>
          ${() =>
            this.authed.value
              ? html`
                  <div class="sidebar-section">
                    <div class="section-label">Workspaces</div>
                    <div class="ws-list">
                      ${this.workspaces.value.map((ws, i) => html`
                        <button class=${"ws-item" + (this.activeWs.value === ws.id ? " active" : "")}
                          @click=${() => this.selectWs(ws.id)}>
                          <span class="ws-dot" style=${"background:" + WS_COLORS[i % WS_COLORS.length]}></span>
                          <span class="ws-name">${ws.name}</span>
                          <span class="role-badge">${ws.role}</span>
                        </button>`)}
                    </div>
                  </div>
                  <div class="sidebar-section">
                    <div class="section-label">Documentos</div>
                    <div class="docs-list">
                      ${() =>
                        this.docs.value
                          .filter(
                            (d) =>
                              !this.searchQ.value ||
                              d.title.toLowerCase().includes(this.searchQ.value.toLowerCase()) ||
                              d.path.toLowerCase().includes(this.searchQ.value.toLowerCase()),
                          )
                          .map(
                            (d) => html`
                              <button class="doc-item" @click=${() => {
                                this.sidebarOpen.value = false;
                                router.navigate("/docs/" + d.id);
                              }}>
                                <svg class="doc-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                <span class="doc-name">${escapeHtml(d.title)}</span>
                              </button>`,
                          )}
                    </div>
                  </div>
                  <div class="sidebar-spacer"></div>
                  <button class="new-doc-btn" @click=${() => {
                    this.sidebarOpen.value = false;
                    router.navigate("/docs");
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    Nuevo documento
                  </button>
                `
              : html`<div class="sidebar-spacer"></div>`}
        </aside>

        <main class="main">
          <header class="topbar">
            <button class="menu-toggle" @click=${() => (this.sidebarOpen.value = !this.sidebarOpen.value)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div class="doc-breadcrumb">
              <span class="ws-tag" style=${"--ws-color:" + (this.activeWs.value ? this.workspaces.value.find((w) => w.id === this.activeWs.value)?.slug ?? "" : "")}>
                ${() => this.workspaces.value.find((w) => w.id === this.activeWs.value)?.name ?? "Zekrost Hub"}
              </span>
              <span class="sep">/</span>
              <span class="doc-name">
                ${() =>
                  this.docs.value.find((d) => d.id === (router.current.value.match(/^\/docs\/(.+)$/)?.[1] ?? ""))?.title ?? ""}
              </span>
            </div>
            <div class="view-switcher">
              ${(() => {
                const views: Array<{ label: string; isActive: (cur: string) => boolean; go: () => void }> = [
                  { label: "Documentos", isActive: (c) => c.startsWith("/docs"), go: () => router.navigate("/docs") },
                  { label: "Kanban", isActive: (c) => c.startsWith("/tasks") && !c.includes("view="), go: () => router.navigate("/tasks") },
                  { label: "Tabla", isActive: (c) => c.includes("view=tabla"), go: () => router.navigate({ name: "tasks", query: { view: "tabla" } }) },
                  { label: "Calendario", isActive: (c) => c.includes("view=calendario"), go: () => router.navigate({ name: "tasks", query: { view: "calendario" } }) },
                  { label: "Grafo", isActive: (c) => c.startsWith("/graph"), go: () => router.navigate("/graph") },
                  { label: "Ajustes", isActive: (c) => c.startsWith("/settings"), go: () => router.navigate("/settings") },
                ];
                return views.map((v) => html`<button class=${"tab" + (v.isActive(router.current.value) ? " active" : "")}
                  @click=${() => v.go()}>${v.label}</button>`);
              })()}
            </div>
            <div class="sync-indicator">
              <span class=${"dot " + (this.online.value ? "dot-on" : "dot-off")}></span>
              <span class="text">${() => (this.online.value ? "en línea" : "sin conexión")}</span>
              ${() => (this.pending.value > 0 ? html` · ${this.pending.value} pendientes` : "")}
            </div>
            <button class="cmd-btn" @click=${() => this.palette.toggle()}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              Buscar <kbd>⌘K</kbd>
            </button>
          </header>
          <main class="content">${new RouterView()}</main>
        </main>
        ${this.palette}
      </div>
    `;
  }
}
