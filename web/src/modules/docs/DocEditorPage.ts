import { NixComponent, html, ref, signal, type NixTemplate } from "@deijose/nix-js";
import { marked } from "marked";
import { router } from "../../router";
import { getLocalDocById, saveDocLocal } from "../../data/mutations";
import { MarkdownEditor } from "./MarkdownEditor";
import { parseLine } from "../../tasks/parser";
import { escapeHtml, formatDate, isOverdue, showToast } from "../../ui/kit";

// Vista de edición local-first: el documento se lee del mirror (100%
// offline); el guardado escribe el mirror, reindexa y encola el sync.
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
    void this.load(id);
  }

  private async load(id: string): Promise<void> {
    const doc = await getLocalDocById(id);
    if (!doc) {
      this.status.value = "no encontrado";
      return;
    }
    this.current = { id: doc.id, path: doc.path, title: doc.title };
    this.editor.setDoc(doc.content);
    this.updatePreview(doc.content);
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

  private enhanceTaskLines(preview: HTMLElement): void {
    const items = Array.from(preview.querySelectorAll("li"));
    for (const li of items) {
      // GFM convierte '- [ ]' / '- [x]' en <input type="checkbox">
      // (el texto del li ya no empieza por '['); '- [~]' queda literal.
      const box = li.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      const text = li.textContent ?? "";
      if (!box && !/^\[[ xX~]\]\s/.test(text)) continue;

      const state = box ? (box.checked ? "x" : " ") : text[1];
      const clone = li.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("input").forEach((n) => n.remove());
      let rest = (clone.textContent ?? "").trim();
      // '- [~]' lo deja marked como literal: quitar el prefijo '[~]'
      if (!box) rest = rest.replace(/^\[[ xX~]\]\s*/, "");

      const task = parseLine(`- [${state}] ${rest}`);
      if (!task) continue;

      const badges: string[] = [];
      if (task.dueDate) {
        badges.push(`<span class="badge date ${isOverdue(task.dueDate) ? "overdue" : ""}">${formatDate(task.dueDate)}</span>`);
      }
      if (task.project) badges.push(`<span class="badge project">@${escapeHtml(task.project)}</span>`);
      if (task.priority) badges.push(`<span class="badge priority-${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span>`);
      if (task.assignee) badges.push(`<span class="badge assignee">~${escapeHtml(task.assignee)}</span>`);
      for (const tg of task.tags) badges.push(`<span class="badge tag">+${escapeHtml(tg)}</span>`);

      const div = document.createElement("div");
      div.className = `task-line ${task.done ? "done" : task.inProgress ? "doing" : ""}`;
      div.innerHTML = `
        <div class="task-checkbox ${task.done ? "checked" : task.inProgress ? "in-progress" : ""}"></div>
        <div class="task-body">
          <span class="task-text">${escapeHtml(task.title)}</span>
          <span class="task-badges">${badges.join("")}</span>
        </div>`;
      li.replaceWith(div);
    }
  }

  private save(): void {
    const doc = this.current;
    if (!doc) return;
    this.status.value = "guardando…";
    saveDocLocal({ id: doc.id, path: doc.path, title: doc.title, content: this.editor.getDoc() })
      .then(() => (this.status.value = "Guardado"))
      .catch(() => {
        this.status.value = "error";
        showToast("No se pudo guardar");
      });
  }
}
