// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { NixComponent, html, ref, type NixTemplate } from "@deijose/nix-js";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, drawSelection, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";

// Editor como NixComponent (sección 7.2): ref() al contenedor, instancia
// de CodeMirror en onMount() y cleanup automático al desmontar. Sin
// wrappers: CodeMirror es DOM-first, exactamente el patrón de
// integración del framework.
//
// Nota de implementación: NO se sincroniza el contenido del editor a un
// signal en cada keystroke — escribir un signal dentro del callback de
// CodeMirror dispara el re-mount del subárbol embebido (loop detectado
// en E2E). El contenido se lee bajo demanda con getDoc().
export class MarkdownEditor extends NixComponent {
  private container = ref<HTMLDivElement>();
  private view: EditorView | null = null;
  private initial: string;

  constructor(initial: string) {
    super();
    this.initial = initial;
  }

  render(): NixTemplate {
    return html`<div class="editor" ref=${this.container}></div>`;
  }

  onMount(): (() => void) | void {
    if (!this.container.el) return;
    const state = EditorState.create({
      doc: this.initial,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        markdown(),
        oneDark,
        EditorView.lineWrapping,
      ],
    });
    this.view = new EditorView({ state, parent: this.container.el });

    // cleanup automático al desmontar
    return () => this.view?.destroy();
  }

  // setDoc reemplaza el contenido del editor sin tocar signals.
  setDoc(content: string): void {
    if (this.view) {
      this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: content } });
    } else {
      this.initial = content;
    }
  }

  getDoc(): string {
    return this.view ? this.view.state.doc.toString() : this.initial;
  }
}
