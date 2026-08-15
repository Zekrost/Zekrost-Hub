import { NixComponent, html, signal, type NixTemplate } from "@deijose/nix-js";
import { createQuery } from "@deijose/nix-query";
import { getToken, tasksApi, type Task } from "../../api/client";
import { currentRole } from "../../api/role";
import { formatDate, isOverdue, showToast } from "../../ui/kit";

// Params reactivos (signal-driven cache keys de nix-query 1.4).
const tableParams = signal<[string, string]>(["", "0"]);
const calRange = signal<[string, string]>(monthRange());
const initialVista = (): "kanban" | "tabla" | "calendario" => {
  const q = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  return q.get("view") === "tabla" || q.get("view") === "calendario" ? (q.get("view") as "tabla" | "calendario") : "kanban";
};
const vista = signal<"kanban" | "tabla" | "calendario">(initialVista());

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

const tableTasks = createQuery<Task[] | null, [string, string]>(
  "tasks/table",
  async ([proyecto, done]) =>
    getToken() ? (await tasksApi.listVista("tabla", { proyecto, done })).tasks : [],
  { refetchOnMount: "always", params: () => tableParams.value },
);

const calTasks = createQuery<Task[] | null, [string, string]>(
  "tasks/calendar",
  async ([desde, hasta]) =>
    getToken() ? (await tasksApi.listVista("calendario", { desde, hasta })).tasks : [],
  { refetchOnMount: "always", params: () => calRange.value },
);

const projects = createQuery<string[], void>(
  "tasks/projects",
  async () => {
    if (!getToken()) return [];
    const open = (await tasksApi.list(false)).tasks;
    const done = (await tasksApi.list(true)).tasks;
    return [...new Set([...open, ...done].map((t) => t.project).filter((p): p is string => !!p))].sort();
  },
  { refetchOnMount: "always" },
);

let quickAddText = "";

function refetchAll(): void {
  openTasks.refetch();
  doneTasks.refetch();
  tableTasks.refetch();
  calTasks.refetch();
  projects.refetch();
}

async function patchTask(task: Task, done: boolean): Promise<void> {
  const role = await currentRole();
  if (role === "viewer") {
    showToast("rol viewer: solo lectura");
    return;
  }
  try {
    await tasksApi.patch(task.id, { done });
    refetchAll();
    showToast(done ? "Tarea completada ✓" : "Tarea reabierta");
  } catch (e) {
    showToast((e as Error).message);
  }
}

async function quickAdd(): Promise<void> {
  const raw = quickAddText.trim();
  if (!raw) return;
  const role = await currentRole();
  if (role === "viewer") {
    showToast("rol viewer: solo lectura");
    return;
  }
  try {
    const t = await tasksApi.quickAdd(raw);
    showToast(`Tarea creada: ${t.title}`);
    quickAddText = "";
    refetchAll();
  } catch (e) {
    showToast((e as Error).message);
  }
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
  const nm = new Date(y, ((m % 12) + 12) % 12, 1);
  const first = `${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, "0")}-01`;
  const last = `${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, "0")}-${String(new Date(nm.getFullYear(), nm.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
  calRange.value = [first, last];
}

function openDoc(docId: string): void {
  window.dispatchEvent(new CustomEvent("hub:open-doc", { detail: docId }));
}

function taskBadges(t: Task): NixTemplate {
  return html`
    ${t.due_date
      ? html`<span class=${"badge date" + (isOverdue(t.due_date) ? " overdue" : "")}>${formatDate(t.due_date)}</span>`
      : ""}
    ${t.project ? html`<span class="badge project">${"@" + t.project}</span>` : ""}
    ${t.priority ? html`<span class=${"badge priority-" + t.priority}>${t.priority}</span>` : ""}
  `;
}

// ---------------------------- Kanban ----------------------------

function kanbanColumn(label: string, dot: string, done: boolean, getter: () => Task[]): NixTemplate {
  return html`
    <div class=${"kanban-col " + dot}>
      <div class="kanban-col-header">
        <span><span class="dot"></span>${label}</span>
        <span class="count">${() => getter().length}</span>
      </div>
      <div class="kanban-col-body" data-done=${done ? "1" : "0"}
        @dragover=${(ev: DragEvent) => {
          ev.preventDefault();
          ev.dataTransfer!.dropEffect = "move";
          (ev.currentTarget as HTMLElement).classList.add("drag-over");
        }}
        @dragleave=${(ev: DragEvent) => (ev.currentTarget as HTMLElement).classList.remove("drag-over")}
        @drop=${(ev: DragEvent) => {
          ev.preventDefault();
          (ev.currentTarget as HTMLElement).classList.remove("drag-over");
          const id = ev.dataTransfer?.getData("text/plain");
          const target = [...(openTasks.data.value ?? []), ...(doneTasks.data.value ?? [])].find((t) => t.id === id);
          if (target) void patchTask(target, done);
        }}>
        ${() => getter().map((t) => html`
            <div class=${"task-card" + (t.done === 1 ? " done" : "")} draggable="true"
              @dragstart=${(ev: DragEvent) => {
                (ev.currentTarget as HTMLElement).classList.add("dragging");
                ev.dataTransfer?.setData("text/plain", t.id);
                ev.dataTransfer!.effectAllowed = "move";
              }}
              @dragend=${(ev: DragEvent) => (ev.currentTarget as HTMLElement).classList.remove("dragging")}>
              <div class="task-text">${t.title}</div>
              <div class="task-meta">
                <div class="task-badges">${taskBadges(t)}</div>
                <span class="source-doc" title="Abrir documento"
                  @click=${(ev: MouseEvent) => {
                    ev.stopPropagation();
                    openDoc(t.doc_id);
                  }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Ver
                </span>
              </div>
            </div>`)}
      </div>
    </div>
  `;
}

function kanbanView(): NixTemplate {
  return html`
    <div class="kanban-toolbar">
      <div class="quick-add">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-faint)"><path d="M12 5v14M5 12h14"/></svg>
        <input type="text" placeholder="Tarea rápida: 'llamar al cliente mañana @ventas !alta'"
          value=${() => quickAddText}
          @input=${(ev: Event) => (quickAddText = (ev.target as HTMLInputElement).value)}
          @keydown=${(ev: KeyboardEvent) => { if (ev.key === "Enter") void quickAdd(); }} />
        <button class="quick-add-btn" @click=${() => void quickAdd()}>Agregar</button>
      </div>
      <span class="quick-add-hint">Enter para crear · #fecha @proyecto !prioridad</span>
    </div>
    <div class="kanban-board">
      ${() => kanbanColumn("Por hacer", "todo", false, () => (openTasks.data.value ?? []).filter((t) => t.in_progress === 0))}
      ${() => kanbanColumn("En progreso", "doing", false, () => (openTasks.data.value ?? []).filter((t) => t.in_progress === 1))}
      ${() => kanbanColumn("Hecho", "done", true, () => doneTasks.data.value ?? [])}
    </div>
    <p class="muted" style="padding: 0 20px 14px">
      Arrastra una tarjeta para cambiar su estado · El cambio reescribe el Markdown fuente (round-trip)
    </p>
  `;
}

// ---------------------------- Tabla ----------------------------

function tablaView(): NixTemplate {
  return html`
    <div class="list-toolbar">
      <select value=${() => tableParams.value[0]}
        @change=${(ev: Event) => {
          tableParams.value = [(ev.target as HTMLSelectElement).value, tableParams.value[1]];
        }}>
        <option value="">Todos los proyectos</option>
        ${() => (projects.data.value ?? []).map((p) => html`<option value=${p}>@${p}</option>`)}
      </select>
      <select value=${() => tableParams.value[1]}
        @change=${(ev: Event) => {
          tableParams.value = [tableParams.value[0], (ev.target as HTMLSelectElement).value];
        }}>
        <option value="0">Pendientes</option>
        <option value="1">Completadas</option>
      </select>
    </div>
    <div class="list-table-wrap">
      <table class="list-table">
        <thead>
          <tr><th style="width: 30px"></th><th>Tarea</th><th>Fecha</th><th>Proyecto</th><th>Prioridad</th></tr>
        </thead>
        <tbody>
          ${() => (tableTasks.data.value ?? []).map((t) => html`
            <tr>
              <td>
                <button class=${"mini-checkbox" + (t.done === 1 ? " checked" : "")} aria-label="completar"
                  @click=${() => void patchTask(t, t.done !== 1)}></button>
              </td>
              <td><span class=${t.done === 1 ? "task-text-done" : ""}>${t.title}</span></td>
              <td>${t.due_date ? html`<span class=${"badge date" + (isOverdue(t.due_date) ? " overdue" : "")}>${formatDate(t.due_date)}</span>` : html`<span class="faint">—</span>`}</td>
              <td>${t.project ? html`<span class="badge project">${"@" + t.project}</span>` : html`<span class="faint">—</span>`}</td>
              <td>${t.priority ? html`<span class=${"badge priority-" + t.priority}>${t.priority}</span>` : ""}</td>
            </tr>`)}
          ${() =>
            (tableTasks.data.value ?? []).length === 0
              ? html`<tr><td colspan="5" class="empty-state">No hay tareas que coincidan con los filtros</td></tr>`
              : ""}
        </tbody>
      </table>
    </div>
  `;
}

// -------------------------- Calendario --------------------------

function calendarioView(): NixTemplate {
  const range = calRange.value;
  const y = Number(range[0].slice(0, 4));
  const m = Number(range[0].slice(5, 7)) - 1;
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const prevLast = new Date(y, m, 0).getDate();
  const isoToday = new Date().toISOString().split("T")[0];
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const cells: Array<{ date: string; isToday: boolean; other: boolean }> = [];
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ date: `${y}-${String(m).padStart(2, "0")}-${String(prevLast - i).padStart(2, "0")}`, isToday: false, other: true });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date: dateStr, isToday: dateStr === isoToday, other: false });
  }
  const remaining = (7 - ((startOffset + lastDay.getDate()) % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ date: `${y}-${String(m + 2).padStart(2, "0")}-${String(i).padStart(2, "0")}`, isToday: false, other: true });
  }

  return html`
    <div class="view-calendar">
      <div class="calendar-header">
        <h3>${new Date(y, m, 1).toLocaleDateString("es", { month: "long", year: "numeric" })}</h3>
        <div class="calendar-nav">
          <button @click=${() => shiftMonth(-1)}>←</button>
          <button @click=${() => (calRange.value = monthRange())}>Hoy</button>
          <button @click=${() => shiftMonth(1)}>→</button>
        </div>
      </div>
      <div class="calendar-grid">
        ${dayNames.map((d) => html`<div class="calendar-day-name">${d}</div>`)}
        ${cells.map((cell) => html`
          <div class=${"calendar-cell" + (cell.other ? " other-month" : "") + (cell.isToday ? " today" : "")}>
            <div class="day-number">${Number(cell.date.slice(8, 10))}</div>
            ${() =>
              (calTasks.data.value ?? [])
                .filter((t) => t.due_date === cell.date && !cell.other)
                .map((t) => html`<button class=${"cal-task " + (t.priority ?? "") + (t.done === 1 ? " done" : "")}
                  title=${t.title} @click=${() => openDoc(t.doc_id)}>${t.title}</button>`)}
          </div>`)}
      </div>
    </div>
  `;
}

// ----------------------------- Page -----------------------------

// Página como clase: onMount garantiza datos frescos cada vez que se
// navega (los queries module-level se crean al arrancar, antes del
// login, y refetchOnMount no vuelve a disparar sin unmount real).
export class TasksPage extends NixComponent {
  onMount(): void {
    refetchAll();
  }

  render(): NixTemplate {
    return html`
      <div class="page">
        <div class="page-header">
          <h2>Tareas</h2>
          <div class="tabs">
            ${(["kanban", "tabla", "calendario"] as const).map(
              (v) => html`<button class=${"tab" + (vista.value === v ? " active" : "")}
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
            ? kanbanView()
            : vista.value === "tabla"
              ? tablaView()
              : calendarioView()}
      </div>
    `;
  }
}
export default TasksPage;
