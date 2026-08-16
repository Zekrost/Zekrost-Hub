# Changelog

Todos los cambios notables de Zekrost Hub se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) y
[Semantic Versioning](https://semver.org/lang/es/).

## [0.1.0] — 2026-08-15

Primera release pública. MVP completo de la Fase 0 y parte de la Fase 1
(licencia AGPL, repositorio público, CI, data layer local-first).

### Added

- **Producto**
  - Workspace self-hosted: documentos Markdown canónicos + índice reconstruible (SQLite/FTS5)
  - Tareas embebidas en los documentos: `- [ ] tarea #fecha @proyecto !prioridad ~asignado +etiqueta`
  - Vistas generadas del índice: kanban (3 columnas con drag & drop), tabla y calendario
  - Quick Add Magic (Ctrl+K): crear tareas en lenguaje natural desde cualquier pantalla
  - Búsqueda full-text FTS5 con tolerancia tipográfica
  - Grafo de conocimiento en canvas con backlinks `[[wikilinks]]` reales
  - Editor Markdown con preview en vivo (CodeMirror 6 + marked)
  - Workspaces con roles: owner / editor / viewer
  - Command palette universal (Ctrl+K) con búsqueda difusa
  - PWA instalable
- **Offline-first (data layer local)**
  - Parser de tareas portado a TypeScript (misma gramática que el backend)
  - Índice local en el dispositivo (Dexie v3): docs, tareas y backlinks
  - La UI lee del mirror local; edición y creación 100% sin conexión
  - Cola de comandos con idempotency-key y replay al reconectar
  - Sync por delta (cursor monótono por workspace) con LWW y versión perdedora conservada
- **API REST v1**
  - Auth JWT stateless con refresh rotativo (bcrypt)
  - CRUD de docs sobre el filesystem canónico, tareas (vistas por parámetro), búsqueda, grafo
  - Sync: `GET /sync/changes?since=` y `POST /sync/push`
- **Distribución**
  - Licencia **AGPL-3.0-only** con headers SPDX y NOTICE
  - Imagen Docker multi-stage (`scratch`, <40 MB)
  - GoReleaser: binarios para linux/darwin/windows (amd64/arm64)
  - GitHub Actions: CI (test, typecheck, vitest, sqlc diff) + release

### Fixed

- Serialización de tareas: los campos nullable se exponen como `string|null`
  (antes `sql.NullString`, que rompía la UI)
- LWW con reloj del cliente: una cola offline multi-comando ya no pierde el
  último cambio al reconectar
- Reindexado incremental por `content_hash` (sin drift)
- Bugs del framework Nix.js documentados y sorteado: interpolaciones de
  atributos con espacios, imports lazy intermitentes → carga directa

### Changed

- Rediseño completo de la UI (sistema de diseño v2): tema oscuro, un acento,
  Inter + JetBrains Mono self-hosted
- Bundle dividido en chunks (main ~22 KB gzip)

## [0.0.1] — 2026-08-14

Versión de desarrollo (no publicada).

- Esqueleto del repositorio: `cmd/hub`, `internal/*`, `db/`, `web/`
- Stack instalado a sus últimas versiones (Go 1.26, Gin 1.12, sqlc 1.31,
  Nix.js 2.6, Capacitor 8)
