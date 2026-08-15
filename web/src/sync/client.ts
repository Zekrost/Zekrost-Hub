// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { applyChanges, getCursor, mirrorDoc } from "./local";
import { enqueue, clearQueue } from "./queue";

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
    const token = localStorage.getItem("hub:token");
    if (!token) return;

    // comandos pendientes de la cola Dexie
    const commands = await queueCommands();
    if (commands.length === 0) return;

    const res = await fetch("/api/v1/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ commands }),
    });
    if (!res.ok) {
      // conflictos LWW no son fatales: se descartan y se vuelve a tirar
      await clearQueue();
      return;
    }
    const delta = await res.json();
    await applyChanges(delta.changes ?? [], delta.cursor ?? (await getCursor()));
    await clearQueue();
  } finally {
    inFlight = false;
  }
}

// pull trae el delta desde el cursor local y lo aplica al mirror.
export async function pull(): Promise<void> {
  const token = localStorage.getItem("hub:token");
  if (!token) return;
  const since = await getCursor();
  const res = await fetch(`/api/v1/sync/changes?since=${since}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;
  const delta = await res.json();
  await applyChanges(delta.changes ?? [], delta.cursor ?? since);
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
