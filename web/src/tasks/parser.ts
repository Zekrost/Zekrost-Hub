// Port del parser de tareas embebidas del backend Go
// (internal/tasks/parser.go) — misma gramática y reglas.
//
//	tarea := checkbox WS texto (WS metadato)*
//	checkbox := '- [ ]' | '- [x]' | '- [~]'      -- ~ = en progreso
//	metadato := fecha | proyecto | prioridad | asignado | etiqueta
//	fecha := '#' (AAAA-MM-DD | 'hoy' | 'mañana' | 'lun'..'dom')
//	proyecto := '@' ident   prioridad := '!' (baja|media|alta|1..3)
//	asignado := '~' ident   etiqueta := '+' ident
//	ident := [a-z0-9-]+
//
// Invariantes: idempotente, tolerante y round-trip garantizado (la
// edición desde una vista reescribe la línea preservando el resto).

export interface ParsedTask {
  line: number; // 1-based
  rawLine: string;
  title: string;
  done: boolean;
  inProgress: boolean;
  dueDate: string | null; // AAAA-MM-DD
  project: string | null;
  priority: string | null; // baja | media | alta
  assignee: string | null;
  tags: string[];
}

export function parseLine(line: string): ParsedTask | null {
  const trimmed = line.replace(/[ \t]+$/, "");
  // checkbox estricto: '- [ ]' requiere espacio tras ']'
  const m = /^-\s\[([ xX~])\]\s+(.+)$/.exec(trimmed);
  if (!m) return null;
  const state = m[1].toLowerCase();
  const rest = m[2];

  const t: ParsedTask = {
    line: 0,
    rawLine: trimmed,
    done: state === "x",
    inProgress: state === "~",
    title: "",
    dueDate: null,
    project: null,
    priority: null,
    assignee: null,
    tags: [],
  };

  const textParts: string[] = [];
  for (const p of rest.split(/\s+/)) {
    if (p.startsWith("#")) {
      const d = resolveDateISO(p.slice(1));
      if (d) t.dueDate = d;
      else textParts.push(p);
    } else if (p.startsWith("@") && isIdent(p.slice(1))) {
      t.project = p.slice(1);
    } else if (p.startsWith("!") && isPriority(p.slice(1))) {
      t.priority = normalizePriority(p.slice(1));
    } else if (p.startsWith("~") && isIdent(p.slice(1))) {
      t.assignee = p.slice(1);
    } else if (p.startsWith("+") && isIdent(p.slice(1))) {
      t.tags.push(p.slice(1));
    } else {
      textParts.push(p); // tolerante: metadatos desconocidos se conservan
    }
  }
  t.title = textParts.join(" ");
  return t;
}

export function parse(content: string): ParsedTask[] {
  const out: ParsedTask[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const t = parseLine(lines[i]);
    if (t) {
      t.line = i + 1;
      out.push(t);
    }
  }
  return out;
}

// RoundTrip reescribe la línea original tras una mutación, preservando
// al byte el texto que no es metadato.
export function roundTrip(
  t: ParsedTask,
  done: boolean,
  due?: string | null,
  project?: string | null,
  priority?: string | null,
  assignee?: string | null,
): string {
  const fields = t.rawLine.split(/\s+/);
  const head = "- [" + (done ? "x" : t.inProgress ? "~" : " ") + "]";
  const out: string[] = [head];
  // '- [ ]' se parte en 3 tokens al hacer split
  const rest = fields.slice(3);
  let wroteText = false;
  for (const p of rest) {
    if (p.startsWith("#")) {
      if (due) out.push("#" + due);
      else out.push(p);
    } else if (p.startsWith("@")) {
      if (project) out.push("@" + project);
      else out.push(p);
    } else if (p.startsWith("!")) {
      if (priority) out.push("!" + priority);
      else out.push(p);
    } else if (p.startsWith("~")) {
      if (assignee) out.push("~" + assignee);
      else out.push(p);
    } else {
      if (!wroteText) {
        out.push(p.trim());
        wroteText = true;
      } else {
        out.push(p);
      }
    }
  }
  return out.join(" ");
}

// Aplica un cambio de estado a un documento completo: reescribe la línea
// de la tarea y devuelve el contenido nuevo.
export function applyTaskState(content: string, task: ParsedTask, done: boolean): string {
  const lines = content.split("\n");
  const idx = task.line - 1;
  if (idx < 0 || idx >= lines.length) return content;
  lines[idx] = roundTrip(task, done);
  return lines.join("\n");
}

function isIdent(s: string): boolean {
  return /^[a-z0-9-]+$/.test(s);
}

function isPriority(s: string): boolean {
  return /^(baja|media|alta|1|2|3)$/.test(s);
}

function normalizePriority(s: string): string {
  switch (s) {
    case "1":
      return "alta";
    case "2":
      return "media";
    case "3":
      return "baja";
  }
  return s;
}

// Resuelve fechas relativas a AAAA-MM-DD. Devuelve null si no es fecha.
export function resolveDateISO(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const now = new Date();
  const iso = (d: Date) => d.toISOString().split("T")[0];
  switch (raw.toLowerCase()) {
    case "hoy":
      return iso(now);
    case "mañana":
      return iso(new Date(now.getTime() + 86400000));
  }
  const days = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  const dayIdx = days.indexOf(raw.toLowerCase());
  if (dayIdx >= 0) {
    const target = dayIdx + 1; // 1..7, lunes=1
    const cur = now.getDay() === 0 ? 7 : now.getDay(); // domingo=7
    let diff = target - cur;
    if (diff <= 0) diff += 7;
    const d = new Date(now);
    d.setDate(d.getDate() + diff);
    return iso(d);
  }
  return null;
}
