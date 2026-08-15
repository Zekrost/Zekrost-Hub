// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { html, type NixTemplate } from "@deijose/nix-js";
import { createQuery } from "@deijose/nix-query";
import { authApi, getToken, setToken, clearToken } from "../../api/client";

interface Health {
  status: string;
  version: string;
}

const health = createQuery<Health | null, void>("health", async () => {
  try {
    const res = await fetch("/healthz");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null; // offline-first: la UI nunca asume conectividad
  }
});

let email = "";
let password = "";

export function HomePage(): NixTemplate {
  const authed = getToken() !== null;
  return html`
    <section class="page">
      <h2>Inicio</h2>
      ${authed
        ? html`<p>
            Sesión iniciada. Elige un módulo: documentos, tareas o búsqueda.
            <button class="btn link" @click=${() => {
              clearToken();
              location.reload();
            }}>cerrar sesión</button>
          </p>`
        : html`<form class="login" @submit=${(ev: Event) => {
            ev.preventDefault();
            authApi
              .login(email, password)
              .then((r) => {
                setToken(r.access_token);
                location.reload();
              })
              .catch((e: Error) => alert(e.message));
          }}>
          <h3>Acceso (dogfood)</h3>
          <input type="email" placeholder="email" value=${() => email}
            @input=${(ev: Event) => (email = (ev.target as HTMLInputElement).value)} />
          <input type="password" placeholder="contraseña" value=${() => password}
            @input=${(ev: Event) => (password = (ev.target as HTMLInputElement).value)} />
          <button class="btn" type="submit">Entrar</button>
          <p class="muted">¿Sin cuenta? Regístrate primero en el API:
            <code>POST /api/v1/auth/register</code></p>
        </form>`}
      <p class="health">
        API:
        ${() =>
          health.data.value?.status === "ok"
            ? html`<span class="badge">v${health.data.value.version}</span>`
            : "conectando…"}
      </p>
    </section>
  `;
}
