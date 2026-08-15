// Copyright (C) 2026 Zekrost <tech@zekrost.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { html, type NixTemplate } from "@deijose/nix-js";

export function GraphPage(): NixTemplate {
  return html`
    <section class="page">
      <h2>Grafo</h2>
      <p class="muted">
        Backlinks [[dobles corchetes]] extraídos del índice: el «wow moment»
        visual heredado de Obsidian.
      </p>
    </section>
  `;
}

export default GraphPage ;
