import { NixComponent, html, ref, type NixTemplate } from "@deijose/nix-js";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, drawSelection, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";

// Editor como NixComponent (sección 7.2): ref() al contenedor, instancia
// de CodeMirror en onMount() y cleanup automático al desmontar. Sin
// wrappers: CodeMirror es DOM-first.
//
// Nota: el contenido NO se sincroniza a una signal por keystroke (eso
// disparaba un loop de re-mount del subárbol embebido, detectado en
// E2E). Se expone onChange como callback plano para la preview.
export class MarkdownEditor extends NixComponent {
  private container = ref<HTMLDivElement>();
  private view: EditorView | null = null;
  private initial: string;
  private onChange?: (text: string) => void;

  constructor(initial: string, onChange?: (text: string) => void) {
    super();
    this.initial = initial;
    this.onChange = onChange;
  }

  render(): NixTemplate {
    return html`<div class="doc-editor" ref=${this.container}></div>`;
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
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            this.onChange?.(u.state.doc.toString());
          }
        }),
      ],
    });
    this.view = new EditorView({ state, parent: this.container.el });
    return () => this.view?.destroy();
  }

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
