import { describe, expect, test } from "vitest";
import { applyTaskState, parse, parseLine, roundTrip } from "./parser";

describe("parseLine", () => {
  test("estados básicos", () => {
    expect(parseLine("- [ ] tarea")!.done).toBe(false);
    expect(parseLine("- [x] tarea")!.done).toBe(true);
    expect(parseLine("- [~] tarea")!.inProgress).toBe(true);
    expect(parseLine("texto normal")).toBeNull();
    expect(parseLine("- [ ]")).toBeNull();
    expect(parseLine("- [x]tarea pegada")).toBeNull();
    expect(parseLine("- tarea")).toBeNull();
  });

  test("metadatos completos", () => {
    const t = parseLine("- [ ] Preparar propuesta #2026-08-20 @zekrost !alta ~deiver +ventas")!;
    expect(t.title).toBe("Preparar propuesta");
    expect(t.dueDate).toBe("2026-08-20");
    expect(t.project).toBe("zekrost");
    expect(t.priority).toBe("alta");
    expect(t.assignee).toBe("deiver");
    expect(t.tags).toEqual(["ventas"]);
  });

  test("prioridades numéricas", () => {
    expect(parseLine("- [ ] t !1")!.priority).toBe("alta");
    expect(parseLine("- [ ] t !3")!.priority).toBe("baja");
  });

  test("fechas relativas", () => {
    expect(parseLine("- [ ] revisar #mañana")!.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("roundTrip", () => {
  test("preserva el texto al byte y cambia el estado", () => {
    const t = parseLine("- [ ] Preparar propuesta #2026-08-20 @zekrost !alta ~deiver +ventas")!;
    const r = roundTrip(t, true, t.dueDate, t.project, t.priority, t.assignee);
    expect(r).toBe("- [x] Preparar propuesta #2026-08-20 @zekrost !alta ~deiver +ventas");
  });

  test("applyTaskState reescribe el documento", () => {
    const content = "# Inbox\n\n- [ ] Primera\n- [x] Segunda\n";
    const out = applyTaskState(content, parse(content)[0], true);
    expect(out).toContain("- [x] Primera");
  });
});
