import { html, type NixTemplate } from "@deijose/nix-js";
import { render } from "@deijose/nix-js-testing";
import { describe, expect, test } from "vitest";
import { HomePage } from "../modules/home/HomePage";
import { TasksPage } from "../modules/tasks/TasksPage";
import { CommandPalette } from "./CommandPalette";

describe("HomePage", () => {
  test("muestra la tarjeta de acceso sin sesión", () => {
    localStorage.removeItem("hub:token");
    const { container } = render(HomePage() as NixTemplate);
    expect(container.querySelector(".login-card")).toBeTruthy();
    expect(getByTextSafe(container, "Zekrost Hub")).toBeTruthy();
  });

  test("el formulario de acceso tiene email y contraseña", () => {
    localStorage.removeItem("hub:token");
    const { container } = render(HomePage() as NixTemplate);
    expect(container.querySelector('input[type="email"]')).toBeTruthy();
    expect(container.querySelector('input[type="password"]')).toBeTruthy();
  });
});

describe("kanban", () => {
  test("renderiza el tablero con las tres columnas y quick add", () => {
    localStorage.removeItem("hub:token");
    const { container } = render(new TasksPage() as unknown as NixTemplate);
    expect(container.querySelectorAll(".kanban-col").length).toBe(3);
    expect(container.querySelector(".quick-add input")).toBeTruthy();
  });
});

describe("command palette", () => {
  test("se abre y expone la búsqueda", () => {
    const palette = new CommandPalette();
    palette.toggle();
    const { container } = render(palette.render() as NixTemplate);
    expect(container.querySelector(".palette-input input")).toBeTruthy();
    expect(container.querySelector(".palette-footer")).toBeTruthy();
  });

  test("cerrada no renderiza el overlay", () => {
    const palette = new CommandPalette();
    const { container } = render(palette.render() as NixTemplate);
    expect(container.querySelector(".palette-backdrop")).toBeNull();
  });
});

describe("markdown", () => {
  test("el template de tarjeta renderiza texto dinámico", () => {
    const { container } = render(
      html`<li><span>${"hola"}</span></li>` as NixTemplate,
    );
    expect(getByTextSafe(container, "hola")).toBeTruthy();
  });
});

function getByTextSafe(root: HTMLElement, text: string): HTMLElement | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.textContent?.includes(text)) {
      return node.parentElement as HTMLElement;
    }
  }
  return null;
}
