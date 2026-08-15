// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { workspacesApi } from "./client";

let cached: Promise<string> | null = null;

// Rol del primer workspace (fase MVP). La UI solo lo refleja; el
// backend garantiza la autorización real (sección 4.3).
export function currentRole(): Promise<string> {
  if (!cached) {
    cached = workspacesApi
      .list()
      .then((r) => r.workspaces[0]?.role ?? "viewer")
      .catch(() => "viewer");
  }
  return cached;
}

export function resetRoleCache(): void {
  cached = null;
}
