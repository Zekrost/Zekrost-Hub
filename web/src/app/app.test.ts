// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { html, type NixTemplate } from "@deijose/nix-js";
import { render } from "@deijose/nix-js-testing";
import { describe, expect, test } from "vitest";
import { HomePage } from "../modules/home/HomePage";
import { card } from "../modules/tasks/TasksPage";
import { CommandPalette } from "./CommandPalette";

describe("HomePage", () => {
  test("muestra el acceso al producto", () => {
    const { container } = render(HomePage() as NixTemplate);
    expect(getByTextSafe(container, "Inicio")).toBeTruthy();
  });

  test("renderiza el formulario de acceso sin sesión", () => {
    localStorage.removeItem("hub:token");
    const { container } = render(HomePage() as NixTemplate);
    expect(container.querySelector("form.login")).toBeTruthy();
  });
});

describe("kanban", () => {
  test("renderiza la tarjeta de tarea con metadatos", () => {
    const { container } = render(
      card({
        id: "1",
        title: "Preparar propuesta",
        done: 0,
        due_date: "2026-08-20",
        project: "zekrost",
        priority: "alta",
        assignee: "deiver",
        line_no: 3,
      }) as NixTemplate,
    );
    expect(getByTextSafe(container, "Preparar propuesta")).toBeTruthy();
    expect(getByTextSafe(container, "@zekrost")).toBeTruthy();
    expect(container.querySelector(".prio-alta")).toBeTruthy();
  });
});

describe("command palette", () => {
  test("se abre y expone el Quick Add Magic", () => {
    const palette = new CommandPalette();
    palette.toggle();
    const { container } = render(palette.render() as NixTemplate);
    expect(container.querySelector(".palette-input")).toBeTruthy();
    expect(container.querySelector(".palette-nav")).toBeTruthy();
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
