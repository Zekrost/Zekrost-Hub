import { render } from "@deijose/nix-js-testing";
import { describe, expect, test } from "vitest";
import { HomePage } from "./HomePage";

describe("HomePage", () => {
  test("muestra la tarjeta de acceso sin sesión", () => {
    localStorage.removeItem("hub:token");
    const { container } = render(HomePage() as never);
    expect(container.querySelector(".login-card")).toBeTruthy();
  });

  test("el formulario de acceso tiene email y contraseña", () => {
    localStorage.removeItem("hub:token");
    const { container } = render(HomePage() as never);
    expect(container.querySelector('input[type="email"]')).toBeTruthy();
    expect(container.querySelector('input[type="password"]')).toBeTruthy();
  });
});
