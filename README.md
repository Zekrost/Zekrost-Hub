<div align="center">

# Zekrost Hub

**El workspace donde la documentación y la ejecución son la misma cosa — tuyo, offline y rápido como una app nativa.**

Un workspace **self-hosted** que une gestión documental y gestión de proyectos en un solo producto: los documentos se escriben en **Markdown**, las tareas viven **dentro** de esos documentos, y todas las vistas de gestión (kanban, tabla, calendario) se generan automáticamente a partir de ese contenido.

**Una sola fuente de verdad: los archivos. Todo lo demás son lentes sobre los mismos datos.**

[![Licencia](https://img.shields.io/badge/licencia-AGPL--3.0-blue.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white)](https://go.dev)
[![Nix.js](https://img.shields.io/badge/Nix.js-2.6-7c6cf0)](https://nix-js.dev)
[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)](.github/workflows/ci.yml)

`docker run -d -v hub-data:/data -p 8080:8080 -e HUB_JWT_SECRET=<secreto> ghcr.io/zekrost/hub:latest`

</div>

---

## ¿Por qué existe?

El mercado de herramientas de conocimiento está fragmentado en dos mundos que no se hablan: los **gestores documentales** (Notion, Obsidian, Docmost) y los **gestores de proyectos** (Jira, Linear, Plane, Vikunja). El usuario real necesita ambos a la vez, y hoy solo tiene dos salidas, ambas malas:

- Pagar y tolerar suites en la nube propietaria donde tus datos no son tuyos.
- Ensamblar un rompecabezas de 3 o 4 herramientas self-hosted, cada una con su contenedor, su base de datos y su mantenimiento.

**Zekrost Hub invierte el modelo:** las tareas son *datos extraídos de los documentos*, no filas de una base de datos ajena.

```markdown
# Feature: tracking en vivo

- [ ] Diseñar el modelo de datos #2026-09-01 @zekrost !alta ~deiver
- [x] Implementar el parser de tareas embebidas @zekrost
```

Ese archivo genera automáticamente un kanban, una tabla y un calendario. Completar una tarea en el kanban marca la casilla en el documento: **son la misma entidad vista desde dos lentes**. Eliminar un proyecto nunca deja tickets huérfanos: el conocimiento y su ejecución nacieron juntos.

## Características

### Documentos
- Editor Markdown con live preview (**CodeMirror 6**): LaTeX, Mermaid, resaltado de código.
- Backlinks `[[wiki-links]]` y grafo de relaciones.
- Adjuntos por arrastrar y soltar (S3-compatible o disco local).
- Versionado por guardado con la versión perdedora siempre conservada.
- Plantillas: propuesta comercial, acta de reunión, RFC, retrospectiva.

### Tareas embebidas — el corazón del producto
- Sintaxis en lenguaje natural dentro del Markdown: `#fecha @proyecto !prioridad ~asignado +etiqueta`.
- Vistas generadas: **kanban, tabla y calendario** — ninguna almacena estado.
- **Quick Add Magic**: `Ctrl+K`, escribe «revisar facturas #mañana @zekrost !alta» y la tarea nace en `Inbox.md`.
- Round-trip garantizado: toda edición desde una vista reescribe la línea original **al byte**.

### Plataforma
- **Offline-first de nacimiento**: cola de comandos con replay y sync por delta. Edita sin internet; todo se sincroniza al reconectar.
- **Un solo binario**: Go + SQLite + frontend embebido. Un contenedor, un volumen, cero dependencias externas.
- **API-first**: toda capacidad de la UI existe en la API REST v1, con webhooks.
- Búsqueda full-text (**FTS5**) con tolerancia a errores tipográficos.
- Workspaces con roles (owner / editor / viewer).
- **PWA** instalable — y las apps móviles/escritorio vía Capacitor comparten el 100% del código.

## Despliegue

### Un solo comando (Docker)

```bash
docker run -d \
  -v hub-data:/data \
  -p 8080:8080 \
  -e HUB_JWT_SECRET=<secreto> \
  ghcr.io/zekrost/hub:latest
```

O construye la imagen desde el código:

```bash
docker build -t zekrost/hub .
docker run -d --name hub -p 8080:8080 -e HUB_JWT_SECRET=<secreto> -v hub-data:/data zekrost/hub
```

Variables de entorno:

| Variable | Obligatoria | Descripción |
|:---|:---:|:---|
| `HUB_JWT_SECRET` | ✅ | Secreto para firmar tokens JWT |
| `HUB_BIND` | — | Dirección de escucha (por defecto `:8080`) |
| `HUB_DB_PATH` | — | Ruta del SQLite índice (por defecto `data/hub.db`) |
| `HUB_DATA_DIR` | — | Directorio canónico de documentos (por defecto `data`) |
| `HUB_STORAGE` | — | `local` o `s3` (R2/MinIO/AWS) |
| `HUB_PUBLIC_URL` | — | URL pública para webhooks |

**Backup** = detener → copiar `data/` → listo. Un directorio lo es todo.

## Desarrollo local

Requisitos: [Go 1.26+](https://go.dev/dl/), [Node.js 22+](https://nodejs.org), [sqlc](https://sqlc.dev) v1.31.

```bash
git clone git@github.com:Zekrost/Zekrost-Hub.git
cd Zekrost-Hub

make frontend   # compila el frontend Nix.js y lo embebe
make generate   # regenera el código sqlc
make dev        # backend Go en :8080
```

En otra terminal:

```bash
cd web
npm run dev     # frontend Vite en :5173 (proxy /api → :8080)
```

| Comando | Descripción |
|:---|:---|
| `make build` | Binario único con frontend embebido |
| `make test` | Tests backend (Go) |
| `make vet` | `go vet` + typecheck TypeScript |
| `make docker` | Imagen multi-stage |

## Arquitectura

```
┌──────────────────────────────────────────────┐
│ CLIENTE — un solo codebase                    │
│ Nix.js SPA → PWA (navegador) | Capacitor (apps)│
│ Cola offline (IndexedDB/Dexie) + sync delta   │
└──────────────────────────┬───────────────────┘
                           │ HTTPS / REST (JSON)
┌──────────────────────────▼───────────────────┐
│ BINARIO GO — un solo proceso                  │
│ Gin · JWT · parser de tareas · FTS5 · webhooks│
│ ├─ SQLite (modernc) — índice y caché          │
│ ├─ Markdown store — archivos canónicos        │
│ └─ Adjuntos — interfaz S3 (local/R2/MinIO)    │
└──────────────────────────────────────────────┘
```

| Capa | Tecnología | Versión |
|:---|:---|:---|
| Backend | Go + Gin + sqlc | 1.26 / v1.12 / v1.31 |
| Base de datos | SQLite embebido (FTS5) · Postgres opcional | modernc 1.56 |
| Frontend | Nix.js (signals, sin Virtual DOM) | 2.6 |
| Editor | CodeMirror 6 | 6.43 |
| Búsqueda | FTS5 + FlexSearch | 0.8 |
| Apps nativas | Capacitor | 8 |
| CI/CD | GitHub Actions + GoReleaser | 2.17 |

**Principios no negociables** (Documento Técnico de Arquitectura):
1. Los archivos son la verdad; la base de datos es un índice reconstruible.
2. Offline-first de nacimiento; ninguna feature asume conectividad.
3. Un solo artefacto; si necesita cinco servicios para arrancar, ya falló.
4. API-first: la UI es un cliente más.
5. Límite de recursos: <100 MB de RAM por instancia, arranque <10 s.

## API REST v1

Todo lo que hace la UI lo hace la API. Autenticación con `Authorization: Bearer <token>`.

```bash
# Registro y login
curl -X POST localhost:8080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"tu@email.com","password":"minimo8chars","display_name":"Tu Nombre"}'

# Quick Add Magic
curl -X POST localhost:8080/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"text":"revisar facturas #mañana @zekrost !alta"}'

# Proyecciones del índice
curl "localhost:8080/api/v1/tasks?vista=calendario&desde=2026-09-01&hasta=2026-09-30" \
  -H "Authorization: Bearer $TOKEN"

# Sync offline (delta por cursor)
curl "localhost:8080/api/v1/sync/changes?since=0" -H "Authorization: Bearer $TOKEN"
```

| Grupo | Endpoints |
|:---|:---|
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` |
| Workspaces | `GET/POST /workspaces` · `POST /workspaces/:id/members` |
| Docs | `GET/POST /docs` · `GET/PATCH/DELETE /docs/:id` · `GET /docs/:id/versions` |
| Tareas | `GET /tasks?vista=kanban\|tabla\|calendario` · `POST /tasks` (Quick Add) · `PATCH /tasks/:id` |
| Búsqueda | `GET /search?q=` |
| Sync | `GET /sync/changes?since=` · `POST /sync/push` |
| Sistema | `GET /healthz` · `GET /version` |

## Estructura del repositorio

```
cmd/hub/          → arranque del binario único (P3)
internal/
  auth/           → JWT stateless + refresh rotativo + bcrypt
  config/         → variables de entorno validadas
  docs/           → CRUD sobre el filesystem canónico (P1)
  tasks/          → parser de tareas embebidas (el activo central)
  indexer/        → docs canónicos → índice (tareas/FTS/backlinks)
  sync/           → delta por cursor + push con idempotencia y LWW
  search/         → FTS5
  graph/          → backlinks del grafo
  server/         → router Gin + handlers de la API v1
  web/            → frontend Nix.js embebido (embed.FS)
db/
  migrations/     → SQL versionado forward-only
  queries/        → queries sqlc
web/              → frontend Nix.js (PWA + Capacitor)
```

## Roadmap

- **Fase 0 — Dogfood (MVP)** ✅ *docs + tareas embebidas + kanban/tabla/calendario + búsqueda + offline + sync delta*
- Fase 1 — Lanzamiento open source: importadores (Obsidian/Notion), build in public
- Fase 2 — Sync Service cifrado (producto pago), colaboración CRDT en tiempo real
- Fase 3 — Cloud hospedado + Team (SSO/OIDC, audit log)

## Contribuciones

El producto se gestiona con su propio producto (dogfooding). Issues, propuestas y PRs son bienvenidos. La comunidad es pequeña pero crece rápido.

## Licencia

**AGPL-3.0-only** — [LICENSE](LICENSE) · [NOTICE](NOTICE)

El producto self-hosted es gratuito y completo. Los ingresos provienen de servicios de conveniencia (sync cifrado, cloud hospedado, planes de equipo) que **nunca** limitan lo que corre en tu servidor. Nadie puede hospedar el producto y competir sin abrir su código.

---

*Hecho por [Zekrost](https://github.com/Zekrost) con Nix.js, Go y mucho dogfooding.*
