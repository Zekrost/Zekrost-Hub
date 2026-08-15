// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Link, html, type NixTemplate } from "@deijose/nix-js";
import { createQuery } from "@deijose/nix-query";
import { docsApi, getToken, type DocSummary } from "../../api/client";
import { currentRole } from "../../api/role";

const docs = createQuery<DocSummary[] | null, void>(
  "docs/list",
  async () => (getToken() ? (await docsApi.list()).docs : []),
  { refetchOnMount: "always" },
);

export function DocsPage(): NixTemplate {
  return html`
    <section class="page">
      <div class="page-header">
        <h2>Documentos</h2>
        <button class="btn" id="new-doc" @click=${() => {
          currentRole().then((role) => {
            if (role === "viewer") {
              alert("rol viewer: solo lectura");
              return;
            }
          const path = prompt("Ruta del documento (ej. notas/idea.md)") ?? "";
          const title = prompt("Título") ?? "";
          if (!path || !title) return;
          docsApi
            .create(path, title, `# ${title}\n\n- [ ] Primera tarea\n`)
            .then(() => docs.refetch())
            .catch((e: Error) => alert(e.message));
          });
        }}>Nuevo documento</button>
      </div>
      ${() =>
        docs.data.value == null
          ? html`<p class="muted">
              ${() => (docs.error.value ? `error: ${String(docs.error.value)}` : "cargando…")}
            </p>`
          : html`<ul class="doc-list">
              ${docs.data.value!.map(
                (d: DocSummary) => html`
                  <li>
                    ${new Link("/docs/" + d.id, d.title)}
                    <span class="muted">${d.path}</span>
                  </li>
                `,
              )}
            </ul>`}
    </section>
  `;
}

export default DocsPage ;
