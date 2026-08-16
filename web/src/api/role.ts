import { workspacesApi } from "./client";

const ROLE_KEY = "hub:role";

// Rol del workspace cacheado localmente: offline-first, la UI no debe
// bloquear el trabajo local por falta de red (el backend valida en el
// push). La autorización real siempre la garantiza el servidor.
export function cachedRole(): string | null {
  try {
    return localStorage.getItem(ROLE_KEY);
  } catch {
    return null;
  }
}

export async function currentRole(): Promise<string> {
  const cached = cachedRole();
  try {
    const { workspaces } = await workspacesApi.list();
    const role = workspaces[0]?.role ?? "viewer";
    localStorage.setItem(ROLE_KEY, role);
    return role;
  } catch {
    // offline: usar la copia cacheada; sin caché, permitir (el servidor
    // decide al sincronizar)
    return cached ?? "editor";
  }
}

export function resetRoleCache(): void {
  localStorage.removeItem(ROLE_KEY);
}
