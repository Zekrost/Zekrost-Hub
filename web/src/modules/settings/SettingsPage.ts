// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { html, signal, type NixTemplate } from "@deijose/nix-js";
import { createQuery } from "@deijose/nix-query";
import { getToken, workspacesApi } from "../../api/client";

const ws = createQuery<
  Array<{ id: string; slug: string; name: string; role: string }> | null,
  void
>(
  "workspaces/list",
  async () => (getToken() ? (await workspacesApi.list()).workspaces : []),
  { refetchOnMount: "always" },
);

let name = "";
let slug = "";

export function SettingsPage(): NixTemplate {
  return html`
    <section class="page">
      <h2>Ajustes</h2>

      <h3>Workspaces</h3>
      ${() =>
        (ws.data.value ?? []).map((w) => html`
          <div class="ws-card">
            <span><strong>${w.name}</strong> <span class="muted">${"@" + w.slug}</span></span>
            <span class="role-badge">${w.role}</span>
          </div>
        `)}

      <h3>Nuevo workspace</h3>
      <form class="login" @submit=${(ev: Event) => {
        ev.preventDefault();
        workspacesApi
          .create(slug, name)
          .then(() => ws.refetch())
          .catch((e: Error) => alert(e.message));
      }}>
        <input placeholder="slug (minúsculas)" value=${() => slug}
          @input=${(ev: Event) => (slug = (ev.target as HTMLInputElement).value)} />
        <input placeholder="nombre" value=${() => name}
          @input=${(ev: Event) => (name = (ev.target as HTMLInputElement).value)} />
        <button class="btn" type="submit">Crear</button>
      </form>

      <p class="muted">
        Roles: <strong>owner</strong> administra, <strong>editor</strong> edita,
        <strong>viewer</strong> solo lee. El backend garantiza el permiso;
        la UI solo lo refleja.
      </p>
    </section>
  `;
}
export default SettingsPage;
