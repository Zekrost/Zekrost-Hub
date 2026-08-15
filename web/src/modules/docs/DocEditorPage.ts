// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { NixComponent, html, signal, type NixTemplate } from "@deijose/nix-js";
import { router } from "../../router";
import { docsApi } from "../../api/client";
import { pushPending, queueDocUpdate } from "../../sync/client";
import { MarkdownEditor } from "./MarkdownEditor";

// Vista de edición: carga el documento desde el API (id por ruta /docs/:id),
// edita con CodeMirror y guarda al archivo canónico. El guardado pasa
// por la cola offline (P2): el mirror local se actualiza y el comando
// se sincroniza con idempotency-key.
export class DocEditorPage extends NixComponent {
  private editor = new MarkdownEditor("");
  private loaded = signal(false);
  private status = signal("");
  private current: { id: string; path: string; title: string } | null = null;

  onMount(): void {
    const id = router.params.value.id ?? "";
    if (!id) {
      this.status.value = "error: sin id de documento";
      this.loaded.value = true;
      return;
    }
    docsApi
      .get(id)
      .then((doc) => {
        this.current = { id: doc.id, path: doc.path, title: doc.title };
        this.editor.setDoc(doc.content);
        this.loaded.value = true;
      })
      .catch((e: Error) => {
        this.status.value = `error: ${e.message}`;
        this.loaded.value = true;
      });
  }

  render(): NixTemplate {
    return html`
      <section class="page editor-page">
        <div class="page-header">
          <h2>Documento</h2>
          <span class="muted">${() => this.status.value}</span>
          <button class="btn" @click=${() => this.save()}>Guardar</button>
        </div>
        ${this.editor}
      </section>
    `;
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
      .then(() => (this.status.value = "guardado (cola offline) ✓"))
      .catch(() => (this.status.value = "error al encolar"))
      .then(() => pushPending())
      .catch(() => undefined);
  }
}

export default DocEditorPage ;
