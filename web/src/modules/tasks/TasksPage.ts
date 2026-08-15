// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { html, signal, type NixTemplate } from "@deijose/nix-js";
import { createQuery } from "@deijose/nix-query";
import { getToken, tasksApi, type Task } from "../../api/client";
import { currentRole } from "../../api/role";

// Las tareas son proyecciones del índice (sección 6.3): kanban, tabla y
// calendario son consultas materializadas; ninguna vista almacena estado.
const openTasks = createQuery<Task[] | null, void>(
  "tasks/open",
  async () => (getToken() ? (await tasksApi.list(false)).tasks : []),
  { refetchOnMount: "always" },
);

const doneTasks = createQuery<Task[] | null, void>(
  "tasks/done",
  async () => (getToken() ? (await tasksApi.list(true)).tasks : []),
  { refetchOnMount: "always" },
);

// Params reactivos (sección 7.2: signal-driven cache keys): al cambiar
// el filtro o el mes, la query se invalida y reconsulta sola.
const tableParams = signal<[string, string]>(["", "0"]);
const calRange = signal<[string, string]>(monthRange());

const tableTasks = createQuery<Task[] | null, [string, string]>(
  "tasks/table",
  async ([proyecto, done]) =>
    getToken()
      ? (await tasksApi.listVista("tabla", { proyecto, done })).tasks
      : [],
  { refetchOnMount: "always", params: () => tableParams.value },
);

const calTasks = createQuery<Task[] | null, [string, string]>(
  "tasks/calendar",
  async ([desde, hasta]) =>
    getToken() ? (await tasksApi.listVista("calendario", { desde, hasta })).tasks : [],
  { refetchOnMount: "always", params: () => calRange.value },
);

const vista = signal<"kanban" | "tabla" | "calendario">("kanban");

function toggle(task: Task): void {
  currentRole().then((role) => {
    if (role === "viewer") {
      alert("rol viewer: solo lectura");
      return;
    }
    tasksApi
      .patch(task.id, { done: !task.done })
      .then(() => {
        openTasks.refetch();
        doneTasks.refetch();
      })
      .catch((e: Error) => alert(e.message));
  });
}

export function card(t: Task): NixTemplate {
  return html`
    <li class="kanban-card">
      <input type="checkbox" data-testid="toggle" checked=${t.done === 1}
        @change=${() => toggle(t)} />
      <span>${t.title}</span>
      <div class="card-meta">
        ${t.project ? html`<span class="tag">${"@" + t.project}</span>` : ""}
        ${t.priority ? html`<span class="tag ${"prio-" + t.priority}">${"!" + t.priority}</span>` : ""}
        ${t.due_date ? html`<span class="tag">${"#" + t.due_date}</span>` : ""}
      </div>
    </li>
  `;
}

function monthRange(): [string, string] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return [
    `${y}-${String(m + 1).padStart(2, "0")}-01`,
    `${y}-${String(m + 1).padStart(2, "0")}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, "0")}`,
  ];
}

function shiftMonth(delta: number): void {
  const base = new Date(calRange.value[0] + "T12:00:00");
  const y = base.getFullYear();
  const m = base.getMonth() + delta;
  const first = `${y}-${String(((m % 12) + 12) % 12 + 1).padStart(2, "0")}-01`;
  const nm = new Date(y, ((m % 12) + 12) % 12, 1);
  const last = `${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, "0")}-${String(new Date(nm.getFullYear(), nm.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
  calRange.value = [first, last];
}

function calendarioView(): NixTemplate {
  return html`
    <div class="cal-head">
      <button class="btn link" @click=${() => shiftMonth(-1)}>‹</button>
      <span>${() => new Date(calRange.value[0] + "T12:00:00").toLocaleDateString("es", { month: "long", year: "numeric" })}</span>
      <button class="btn link" @click=${() => shiftMonth(1)}>›</button>
    </div>
    <ul class="cal-list">
      ${() =>
        (calTasks.data.value ?? []).map((t: Task) => {
          const d = t.due_date ?? "sin fecha";
          return html`<li class="kanban-card">
            <span class="cal-date">${d}</span>
            <span>${t.title}</span>
            <span class="tag">${"@" + (t.project ?? "inbox")}</span>
          </li>`;
        })}
    </ul>
  `;
}

function tablaView(): NixTemplate {
  return html`
    <div class="table-filters">
      <input class="quick-add" placeholder="Filtrar por proyecto (@)" value=${() => tableParams.value[0]}
        @input=${(ev: Event) => {
          const p = (ev.target as HTMLInputElement).value.replace(/^@/, "");
          tableParams.value = [p, tableParams.value[1]];
        }} />
      <select value=${() => tableParams.value[1]} @change=${(ev: Event) => {
        tableParams.value = [tableParams.value[0], (ev.target as HTMLSelectElement).value];
      }}>
        <option value="0">Pendientes</option>
        <option value="1">Hechas</option>
      </select>
    </div>
    <table class="task-table">
      <thead>
        <tr><th>Estado</th><th>Tarea</th><th>Proyecto</th><th>Prioridad</th><th>Vence</th></tr>
      </thead>
      <tbody>
        ${() =>
          (tableTasks.data.value ?? []).map((t: Task) => html`
            <tr>
              <td>${t.done === 1 ? "✓" : "○"}</td>
              <td>${t.title}</td>
              <td>${"@" + (t.project ?? "")}</td>
              <td>${t.priority ?? ""}</td>
              <td>${t.due_date ?? ""}</td>
            </tr>
          `)}
      </tbody>
    </table>
  `;
}

export function TasksPage(): NixTemplate {
  return html`
    <section class="page">
      <div class="page-header">
        <h2>Tareas</h2>
        <div class="tabs">
          ${(["kanban", "tabla", "calendario"] as const).map(
            (v) => html`<button class=${"tab" + (vista.value === v ? " tab-active" : "")}
              @click=${() => {
                vista.value = v;
                if (v === "tabla") tableTasks.refetch();
                if (v === "calendario") calTasks.refetch();
              }}>${v}</button>`,
          )}
        </div>
      </div>
      ${() =>
        vista.value === "kanban"
          ? html`
              <div class="kanban">
                <div class="kanban-col">
                  <h3>Pendiente</h3>
                  <ul>${() => (openTasks.data.value ?? []).map(card)}</ul>
                </div>
                <div class="kanban-col">
                  <h3>Hechas</h3>
                  <ul>${() => (doneTasks.data.value ?? []).map(card)}</ul>
                </div>
              </div>
              <p class="muted">Completar una tarea marca la casilla en el documento fuente (round-trip garantizado).</p>
            `
          : vista.value === "tabla"
            ? tablaView()
            : calendarioView()}
    </section>
  `;
}
export default TasksPage;
