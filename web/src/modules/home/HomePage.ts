import { NixComponent, html, signal, type NixTemplate } from "@deijose/nix-js";
import { authApi, getToken, setSession } from "../../api/client";
import { router } from "../../router";
import { showToast } from "../../ui/kit";

// Pantalla Auth: tabs "Entrar" / "Crear cuenta". En el primer arranque
// (sin usuarios registrados) "Crear cuenta" es la opción por defecto.
export class HomePage extends NixComponent {
  private mode = signal<"login" | "register">("login");
  private email = signal("");
  private password = signal("");
  private displayName = signal("");

  onMount(): void {
    // con sesión activa, / redirige a Documentos (la pantalla auth
    // solo es para entrar/registrarse)
    if (getToken()) {
      router.navigate("/docs");
      return;
    }
    void authApi.status().then(({ has_users }) => {
      if (!has_users) this.mode.value = "register";
    }).catch(() => undefined);
  }

  private submit(): void {
    if (this.password.value.length < 8) {
      showToast("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    const run = this.mode.value === "login"
      ? authApi.login(this.email.value, this.password.value)
      : authApi.register(this.email.value, this.password.value, this.displayName.value || this.email.value);
    run
      .then((session) => {
        setSession(session);
        window.dispatchEvent(new CustomEvent("hub:login"));
        showToast(this.mode.value === "register" ? "Cuenta creada — bienvenido" : "Sesión iniciada");
      })
      .catch((e: Error) => showToast(e.message));
  }

  render(): NixTemplate {
    return html`
      <div class="login-view">
        <div class="login-card">
          <div class="logo-mark">Z</div>
          <h2>Zekrost Hub</h2>
          <p class="login-sub">El workspace donde la documentación y la ejecución son la misma cosa.</p>
          <div class="tabs" style="margin-bottom: 16px">
            <button class=${() => "tab" + (this.mode.value === "login" ? " active" : "")}
              @click=${() => (this.mode.value = "login")}>Entrar</button>
            <button class=${() => "tab" + (this.mode.value === "register" ? " active" : "")}
              @click=${() => (this.mode.value = "register")}>Crear cuenta</button>
          </div>
          <form @submit=${(ev: Event) => {
            ev.preventDefault();
            this.submit();
          }}>
            ${() =>
              this.mode.value === "register"
                ? html`
                    <div class="field">
                      <input type="text" placeholder="Nombre visible" value=${() => this.displayName.value}
                        @input=${(ev: Event) => (this.displayName.value = (ev.target as HTMLInputElement).value)} />
                    </div>`
                : ""}
            <div class="field">
              <input type="email" placeholder="Email" value=${() => this.email.value}
                @input=${(ev: Event) => (this.email.value = (ev.target as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <input type="password" placeholder="Contraseña (mín. 8)" value=${() => this.password.value}
                @input=${(ev: Event) => (this.password.value = (ev.target as HTMLInputElement).value)} />
            </div>
            <button class="btn" type="submit">${() => (this.mode.value === "login" ? "Entrar" : "Crear cuenta")}</button>
          </form>
          <p class="login-hint">
            Datos 100% locales y offline-first. Al crear tu cuenta se configura
            tu workspace "Personal" automáticamente.
          </p>
        </div>
      </div>
    `;
  }
}

export default HomePage;
