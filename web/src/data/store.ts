import { signal } from "@deijose/nix-js";
import { getLocalDocs, getLocalTasks, reindexAll, type LocalDoc, type LocalTask } from "../sync/local";
import { pull } from "../sync/client";

// Fuente de lectura de la UI (local-first): los signals se alimentan
// del mirror local; el servidor solo sincroniza. 100% offline.
export const localDocs = signal<LocalDoc[]>([]);
export const localTasks = signal<LocalTask[]>([]);
export const localReady = signal(false);


export async function refreshLocal(): Promise<void> {
  localDocs.value = await getLocalDocs();
  localTasks.value = await getLocalTasks();
}

// bootstrapLocal: trae el delta, reindexa el mirror y puebla la UI.
export async function bootstrapLocal(): Promise<void> {
  try {
    await pull();
  } catch {
    /* offline: el mirror local manda */
  }
  await reindexAll();
  await refreshLocal();
  localReady.value = true;
}

// initLocal: reacciona a cambios locales (crear/editar docs) con un
// pull + reindex + refresh en cadena.
export function initLocal(): void {
  window.addEventListener("hub:docs-changed", () => {
    void (async () => {
      try {
        await pull();
      } catch {
        /* sin conexión */
      }
      await reindexAll();
      await refreshLocal();
    })();
  });
}
