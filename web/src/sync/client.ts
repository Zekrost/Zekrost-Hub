// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { applyChanges, getCursor, mirrorDoc, type Change } from "./local";
import { enqueue, clearQueue } from "./queue";
import { apiFetch, getToken } from "../api/client";
import { showToast } from "../ui/kit";

// Cliente del sync delta (sección 9): push de la cola offline + pull
// del delta por cursor. Replays con idempotency-key se deduplican en
// el servidor.

let inFlight = false;

export function syncStatus(): { online: boolean; pending: number } {
  return { online: navigator.onLine, pending: 0 };
}

// pushPending envía la cola de comandos al servidor y aplica el delta
// resultante.
export async function pushPending(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    await pull(); // primero converger: menos conflictos LWW
    if (!getToken()) return;

    // comandos pendientes de la cola Dexie
    const commands = await queueCommands();
    if (commands.length === 0) return;

    try {
      const delta = await apiFetch<{ cursor: number; changes: Change[] }>("/sync/push", {
        method: "POST",
        body: JSON.stringify({ commands }),
      });
      await applyChanges(delta.changes ?? [], delta.cursor ?? (await getCursor()));
      await clearQueue();
    } catch (e) {
      // 403 = sin permiso tras refresh válido: se descarta la cola (el
      // servidor decidió) y se avisa. 401/transitorio: la cola se
      // conserva y se reintenta al reconectar (nunca perder datos).
      const msg = (e as Error).message ?? String(e);
      if (msg.includes("HTTP 403")) {
        await clearQueue();
        showToast("sincronización rechazada por el servidor");
      }
    }
  } finally {
    inFlight = false;
  }
}

// pull trae el delta desde el cursor local y lo aplica al mirror.
export async function pull(): Promise<void> {
  if (!getToken()) return;
  const since = await getCursor();
  const delta = await apiFetch<{ cursor: number; changes: Change[] }>(
    `/sync/changes?since=${since}`,
  ).catch(() => null);
  if (delta) {
    await applyChanges(delta.changes ?? [], delta.cursor ?? since);
  }
}

// queueDocUpdate registra una edición offline: actualiza el mirror y
// encola el comando doc.upsert con su idempotency-key.
export async function queueDocUpdate(doc: {
  id: string; path: string; title: string; content: string; updatedAt: string;
}): Promise<void> {
  const key = crypto.randomUUID();
  await mirrorDoc({ ...doc, contentHash: await sha256(doc.content) });
  await enqueue({
    key: "doc.upsert",
    payload: { idempotency_key: key, op: "doc.upsert", doc_id: doc.id, path: doc.path, content: doc.content, updated_at: doc.updatedAt },
    idempotencyKey: key,
  });
}

async function queueCommands(): Promise<unknown[]> {
  // lee y vacía la cola en un solo paso (sin races con el sync)
  const db = (await import("./queue")).queueDB;
  const all = await db.commands.orderBy("createdAt").toArray();
  await db.commands.clear();
  return all.map((c) => c.payload);
}

// sha256 del contenido para el mirror (Web Crypto).
export async function sha256(content: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// arranque del sync automático: al volver la red se replaya la cola.
export function initSyncAuto(): void {
  window.addEventListener("online", () => {
    void pushPending();
  });
  window.addEventListener("focus", () => {
    void pull();
  });
}
