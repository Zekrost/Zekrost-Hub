import { NixComponent, html, ref, signal, type NixTemplate } from "@deijose/nix-js";
import { marked } from "marked";
import { router } from "../../router";
import { docsApi } from "../../api/client";
import { pushPending, queueDocUpdate } from "../../sync/client";
import { MarkdownEditor } from "./MarkdownEditor";
import { escapeHtml, formatDate, isOverdue, showToast } from "../../ui/kit";

// Vista de edición con preview en vivo: CodeMirror a la izquierda,
// documento renderizado (tareas interactivas) a la derecha. El guardado
// pasa por la cola offline (P2).
export class DocEditorPage extends NixComponent {
  private editor = new MarkdownEditor("", (text) => this.updatePreview(text));
  private status = signal("");
  private current: { id: string; path: string; title: string } | null = null;
  private previewRef = ref<HTMLDivElement>();

  onMount(): void {
    const id = router.params.value.id ?? "";
    if (!id) {
      this.status.value = "error: sin id de documento";
      return;
    }
    docsApi
      .get(id)
      .then((doc) => {
        this.current = { id: doc.id, path: doc.path, title: doc.title };
        this.editor.setDoc(doc.content);
        this.updatePreview(doc.content);
      })
      .catch((e: Error) => {
        this.status.value = `error: ${e.message}`;
      });
  }

  render(): NixTemplate {
    return html`
      <div class="page">
        <div class="page-header">
          <div class="doc-breadcrumb">
            <span class="doc-name">${() => this.current?.title ?? "Documento"}</span>
            <span class=${() => "save-indicator" + (this.status.value ? " visible" : "")}>${() => this.status.value || "Guardado"}</span>
          </div>
          <button class="btn" @click=${() => this.save()}>Guardar</button>
        </div>
        <div class="doc-split">
          ${this.editor}
          <div class="doc-preview" ref=${this.previewRef}></div>
        </div>
      </div>
    `;
  }

  private updatePreview(md: string): void {
    const preview = this.previewRef.el;
    if (!preview) return;
    let html: string;
    try {
      html = marked.parse(md, { breaks: true, gfm: true }) as string;
    } catch {
      html = `<pre>${escapeHtml(md)}</pre>`;
    }
    preview.innerHTML = html;
    this.enhanceTaskLines(preview);
  }

  // Convierte los <li> de tareas en líneas interactivas con checkbox y
  // badges (mismo patrón del documento de referencia).
  private enhanceTaskLines(preview: HTMLElement): void {
    const items = Array.from(preview.querySelectorAll("li"));
    for (const li of items) {
      const text = li.textContent ?? "";
      const m = text.match(/^\[([ xX~])\]\s+(.+)$/s);
      if (!m) continue;
      const state = m[1].toLowerCase();
      const done = state === "x";
      const doing = state === "~";
      const rest = m[2];
      const date = rest.match(/#(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
      const project = rest.match(/@([\w.-]+)/i)?.[1] ?? null;
      const priority = rest.match(/!(alta|media|baja)/i)?.[1]?.toLowerCase() ?? null;
      const title = rest.replace(/#\d{4}-\d{2}-\d{2}/, "").replace(/@[\w.-]+/i, "").replace(/!(alta|media|baja)/i, "").trim();

      const badges: string[] = [];
      if (date) badges.push(`<span class="badge date ${isOverdue(date) ? "overdue" : ""}">${formatDate(date)}</span>`);
      if (project) badges.push(`<span class="badge project">@${escapeHtml(project)}</span>`);
      if (priority) badges.push(`<span class="badge priority-${escapeHtml(priority)}">${escapeHtml(priority)}</span>`);

      const div = document.createElement("div");
      div.className = `task-line ${done ? "done" : doing ? "doing" : ""}`;
      div.innerHTML = `
        <div class="task-checkbox ${done ? "checked" : doing ? "in-progress" : ""}"></div>
        <div class="task-body">
          <span class="task-text">${escapeHtml(title)}</span>
          <span class="task-badges">${badges.join("")}</span>
        </div>`;
      li.replaceWith(div);
    }
  }

  private save(): void {
    const doc = this.current;
    if (!doc) return;
    this.status.value = "guardando…";
    queueDocUpdate({
      id: doc.id,
      path: doc.path,
      title: doc.title,
      content: this.editor.getDoc(),
      updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
    })
      .then(() => {
        this.status.value = "Guardado";
        window.dispatchEvent(new CustomEvent("hub:docs-changed"));
      })
      .catch(() => {
        this.status.value = "error al encolar";
        showToast("No se pudo guardar");
      })
      .then(() => pushPending())
      .catch(() => undefined);
  }
}
export default DocEditorPage;
