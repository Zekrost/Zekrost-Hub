import { html, type NixTemplate } from "@deijose/nix-js";
import { authApi, getToken, setToken, clearToken } from "../../api/client";
import { showToast } from "../../ui/kit";

let email = "";
let password = "";

export function HomePage(): NixTemplate {
  if (getToken()) {
    return html`
      <div class="login-view">
        <div class="login-card">
          <div class="logo-mark">Z</div>
          <h2>Bienvenido de nuevo</h2>
          <p class="login-sub">Tu sesión está activa. Continúa en documentos, tareas o búsqueda.</p>
          <button class="btn ghost" style="width:100%" @click=${() => {
            clearToken();
            window.location.reload();
          }}>Cerrar sesión</button>
        </div>
      </div>
    `;
  }

  return html`
    <div class="login-view">
      <div class="login-card">
        <div class="logo-mark">Z</div>
        <h2>Zekrost Hub</h2>
        <p class="login-sub">El workspace donde la documentación y la ejecución son la misma cosa.</p>
        <form @submit=${(ev: Event) => {
          ev.preventDefault();
          authApi
            .login(email, password)
            .then((r) => {
              setToken(r.access_token);
              window.location.reload();
            })
            .catch((e: Error) => showToast(e.message));
        }}>
          <div class="field">
            <input type="email" placeholder="Email" value=${() => email}
              @input=${(ev: Event) => (email = (ev.target as HTMLInputElement).value)} />
          </div>
          <div class="field">
            <input type="password" placeholder="Contraseña" value=${() => password}
              @input=${(ev: Event) => (password = (ev.target as HTMLInputElement).value)} />
          </div>
          <button class="btn" type="submit">Entrar</button>
        </form>
        <p class="login-hint">
          ¿Primera vez? Regístrate con:<br />
          <code>curl -X POST /api/v1/auth/register -d '{"email":"tu@email.com","password":"minimo8chars","display_name":"Tú"}'</code>
        </p>
      </div>
    </div>
  `;
}
