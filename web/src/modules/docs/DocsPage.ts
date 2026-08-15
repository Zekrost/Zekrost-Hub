import { NixComponent, html, type NixTemplate } from "@deijose/nix-js";
import { createQuery } from "@deijose/nix-query";
import { docsApi, getToken, type DocSummary } from "../../api/client";
import { currentRole } from "../../api/role";
import { router } from "../../router";
import { showPrompt, showToast } from "../../ui/kit";

const docs = createQuery<DocSummary[] | null, void>(
  "docs/list",
  async () => (getToken() ? (await docsApi.list()).docs : []),
  { refetchOnMount: "always" },
);

async function newDoc(): Promise<void> {
  const role = await currentRole();
  if (role === "viewer") {
    showToast("rol viewer: solo lectura");
    return;
  }
  const title = await showPrompt("Nuevo documento", "Nombre del documento");
  if (!title) return;
  const path = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".md";
  try {
    const doc = await docsApi.create(path, title, `# ${title}\n\n- [ ] Primera tarea #hoy\n\nEmpieza a escribir. Las tareas con \`- [ ]\` aparecerán en el kanban.\n`);
    showToast("Documento creado");
    window.dispatchEvent(new CustomEvent("hub:docs-changed"));
    router.navigate("/docs/" + doc.id);
  } catch (e) {
    showToast((e as Error).message);
  }
}

export class DocsPage extends NixComponent {
  onMount(): void {
    docs.refetch();
  }

  render(): NixTemplate {
    return html`
    <div class="page">
      <div class="page-header">
        <h2>Documentos</h2>
        <button class="btn" id="new-doc" @click=${() => void newDoc()}>Nuevo documento</button>
      </div>
      <div class="list-table-wrap">
        <table class="list-table">
          <thead>
            <tr><th>Título</th><th>Ruta</th><th>Actualizado</th></tr>
          </thead>
          <tbody>
            ${() =>
              (docs.data.value ?? []).map((d: DocSummary) => html`
                <tr style="cursor:pointer" @click=${() => router.navigate("/docs/" + d.id)}>
                  <td><strong>${d.title}</strong></td>
                  <td><span class="faint">${d.path}</span></td>
                  <td><span class="faint">${d.updated_at.slice(0, 10)}</span></td>
                </tr>`)}
            ${() =>
              (docs.data.value ?? []).length === 0
                ? html`<tr><td colspan="3" class="empty-state">Sin documentos. Crea uno nuevo.</td></tr>`
                : ""}
          </tbody>
        </table>
      </div>
    </div>
  `;
  }
}
export default DocsPage;
