// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
import Dexie, { type Table } from "dexie";

// Mirror local del workspace (P2): la copia IndexedDB permite leer y
// editar sin conectividad; el sync delta la mantiene al día.

export interface LocalDoc {
  id: string;
  path: string;
  title: string;
  content: string;
  contentHash: string;
  updatedAt: string;
  deleted: number;
}

interface Meta {
  key: string;
  value: string;
}

class HubLocalDB extends Dexie {
  docs!: Table<LocalDoc, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super("zekrost-hub-local");
    this.version(1).stores({
      docs: "id, path, updatedAt",
      meta: "key",
    });
  }
}

export const localDB = new HubLocalDB();

export async function getCursor(): Promise<number> {
  const row = await localDB.meta.get("cursor");
  return row ? Number(row.value) : 0;
}

export async function setCursor(cursor: number): Promise<void> {
  await localDB.meta.put({ key: "cursor", value: String(cursor) });
}

// applyChanges aplica un delta del servidor al mirror local.
export async function applyChanges(
  changes: Array<{
    seq: number;
    op: string;
    doc?: { id: string; path: string; title: string; content: string; content_hash: string; updated_at: string };
  }>,
  cursor: number,
): Promise<void> {
  for (const ch of changes) {
    if (ch.op === "delete") {
      const id = ch.doc?.id;
      if (id) {
        const existing = await localDB.docs.get(id);
        if (existing) {
          await localDB.docs.put({ ...existing, deleted: 1 });
        }
      }
      continue;
    }
    if (!ch.doc) continue;
    await localDB.docs.put({
      id: ch.doc.id,
      path: ch.doc.path,
      title: ch.doc.title,
      content: ch.doc.content,
      contentHash: ch.doc.content_hash,
      updatedAt: ch.doc.updated_at,
      deleted: 0,
    });
  }
  await setCursor(cursor);
}

export async function mirrorDoc(doc: {
  id: string; path: string; title: string; content: string; contentHash: string; updatedAt: string;
}): Promise<void> {
  await localDB.docs.put({ ...doc, deleted: 0 });
}
