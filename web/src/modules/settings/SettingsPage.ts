import { html, signal, type NixTemplate } from "@deijose/nix-js";
import { createQuery } from "@deijose/nix-query";
import { authApi, clearToken, getToken, workspacesApi } from "../../api/client";
import { showToast } from "../../ui/kit";

const ws = createQuery<
  Array<{ id: string; slug: string; name: string; role: string }> | null,
  void
>(
  "workspaces/list",
  async () => (getToken() ? (await workspacesApi.list()).workspaces : []),
  { refetchOnMount: "always" },
);

const me = createQuery<{ id: string; email: string; display_name: string } | null, void>(
  "auth/me",
  async () => (getToken() ? await authApi.me() : null),
  { refetchOnMount: "always" },
);

let name = "";
let slug = "";

function logout(): void {
  void authApi.logout().catch(() => undefined);
  clearToken();
  showToast("Sesión cerrada");
  window.dispatchEvent(new CustomEvent("hub:logout"));
}

export function SettingsPage(): NixTemplate {
  return html`
    <section class="page">
      <div class="page-header">
        <h2>Ajustes</h2>
        <button class="btn ghost" @click=${() => logout()}>Cerrar sesión</button>
      </div>

      <h3>Cuenta</h3>
      <div class="ws-card">
        <span><strong>${() => me.data.value?.display_name ?? "…"}</strong>
          <span class="muted">${() => me.data.value?.email ?? ""}</span></span>
        <span class="role-badge">usuario</span>
      </div>

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
          .then(() => {
            ws.refetch();
            showToast("Workspace creado");
          })
          .catch((e: Error) => showToast(e.message));
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
