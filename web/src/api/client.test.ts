import assert from "node:assert";
import { test } from "vitest";
import { apiFetch, getToken, setSession } from "./client";

test("401 dispara refresh y reintenta la petición original", async () => {
  localStorage.clear();

  const calls: string[] = [];
  const refresh = globalThis.fetch;

  // respuesta original 401, luego 200 tras renovar
  let first = true;
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url + (init?.method ?? "GET"));
    if (url.endsWith("/auth/refresh")) {
      return new Response(
        JSON.stringify({ access_token: "nuevo-access", refresh_token: "nuevo-refresh", expires_in: 900 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (first) {
      first = false;
      return new Response(JSON.stringify({ error: { message: "no auth" } }), { status: 401 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  setSession({ access_token: "viejo-access", refresh_token: "viejo-refresh" });

  const res = await apiFetch<{ ok: boolean }>("/docs");
  assert.ok(res.ok, "la petición original se reintentó con el token nuevo");
  assert.ok(calls.some((c) => c.includes("/auth/refresh")), "se llamó al refresh");
  assert.strictEqual(getToken(), "nuevo-access", "el access se renovó");

  globalThis.fetch = origFetch;
  void refresh;
});

test("sin refresh token, un 401 limpia la sesión y emite hub:logout", async () => {
  localStorage.clear();
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: "x" } }), { status: 401 })) as typeof fetch;

  let loggedOut = false;
  const onLogout = () => (loggedOut = true);
  window.addEventListener("hub:logout", onLogout);

  await assert.rejects(() => apiFetch("/docs"));
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(getToken(), null);
  assert.ok(loggedOut, "hub:logout emitido");

  window.removeEventListener("hub:logout", onLogout);
  globalThis.fetch = origFetch;
});
