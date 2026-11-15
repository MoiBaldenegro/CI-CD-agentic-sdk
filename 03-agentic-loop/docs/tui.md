# Agentic Loop TUI

TUI local para operar el motor agéntico desde la terminal. Está escrita en **Rust + Ratatui** y habla con el motor TypeScript existente mediante un **bridge JSON** en Node.

La TUI no duplica reglas de negocio: sigue usando `AgenticLoopApplication`, el agregado `Task`, los servicios de dominio y los puertos hexagonales.

## Arquitectura

```text
┌──────────────────────────────┐
│  TUI Rust + Ratatui          │
│  tui/src/*.rs                │
└──────────────┬───────────────┘
               │ JSON por stdin/stdout
┌──────────────▼───────────────┐
│  Bridge Node                 │
│  infrastructure/cli/bridge.ts│
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│  AgenticLoopApplication      │
│  dominio + casos de uso      │
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│  FileTaskRepository          │
│  FileAgentRegistry           │
│  .agentic-loop/*.json        │
└──────────────────────────────┘
```

Cada acción de la TUI lanza un proceso Node, envía una petición JSON por `stdin` y lee una única respuesta JSON por `stdout`. No hay daemon ni estado compartido en memoria.

## Requisitos

- Node.js 20 o superior (probado con Node 26).
- pnpm.
- Rust 1.74 o superior (probado con 1.99).
- Terminal de al menos 80x24; en Windows se recomienda Windows Terminal.

## Compilar y ejecutar

Desde `03-agentic-loop`:

```bash
pnpm install
pnpm build
cargo build --manifest-path tui/Cargo.toml
pnpm tui
```

También puedes ejecutar directamente:

```bash
cargo run --manifest-path tui/Cargo.toml
```

La ruta por defecto del bridge es `dist/infrastructure/cli/bridge.js`, relativa al directorio actual. Por eso conviene lanzar la TUI desde `03-agentic-loop`.

### Opciones

```text
--bridge <ruta>   Ruta al bridge JS (default: dist/infrastructure/cli/bridge.js)
--node <ruta>     Ejecutable de Node (default: node)
--store <ruta>    Store de tareas (default: .agentic-loop/tasks.json)
--check           Imprime el estado y sale, sin abrir la TUI
-h, --help        Ayuda
```

### Variables de entorno

```text
AGENTIC_LOOP_BRIDGE             Ruta al bridge JS
AGENTIC_LOOP_NODE               Ejecutable de Node
AGENTIC_LOOP_STORE              Store de tareas
AGENTIC_LOOP_WORKSPACE          Checkout por defecto para OpenCode
AGENTIC_LOOP_OPENCODE_URL       Servidor OpenCode existente
AGENTIC_LOOP_OPENCODE_AGENT     Agente OpenCode (default: build)
AGENTIC_LOOP_OPENCODE_PROVIDER  Provider para modelos sin prefijo (default: opencode)
AGENTIC_LOOP_OPENCODE_TIMEOUT_MS Timeout de ejecución (default: 900000)
AGENTIC_LOOP_OPENCODE_STARTUP_TIMEOUT_MS Timeout de arranque (default: 10000)
AGENTIC_LOOP_OPENCODE_WEBFETCH=1 Permite webfetch (default: denegado)
AGENTIC_LOOP_SIMULATE=1         Usa adaptadores simulados
```

El store de agentes se deriva del store de tareas: si el store es `algo/tasks.json`, los agentes se guardan en `algo/agents.json`. También se puede fijar con `agentsStore` en el protocolo JSON.

### Verificar sin abrir la TUI

```bash
pnpm tui:check
```

Salida típica sin agentes:

```text
connection: SIN AGENTES
store: C:\...\03-agentic-loop\.agentic-loop\tasks.json
agent_store: C:\...\03-agentic-loop\.agentic-loop\agents.json
adapters: (none)
agents_registered: 0
tasks_total: 0
agents_loaded: 0
tasks_loaded: 0
```

## Primer arranque: onboarding

La primera vez que abras la TUI sin agentes ni tareas verás un modal de bienvenida:

```text
┌ Bienvenido ───────────────────────┐
│           AGENTIC LOOP            │
│ Orquesta agentes de IA...         │
│                                   │
│         EMPIEZA EN 3 PASOS        │
│  1  [ a ]  Agrega un agente       │
│  2  [ s ]  Crea una tarea         │
│  3  [ e ]  Ejecútala              │
│                                   │
│ [Enter] empezar  [a] agente ...   │
└───────────────────────────────────┘
```

- `Enter`, `Esc` o `Espacio`: cerrar y explorar.
- `a` o `s`: cerrar el modal y abrir el formulario correspondiente.
- `?`: abrir la ayuda completa.

Tras cerrarlo, el panel de agentes muestra **PRIMEROS PASOS** mientras siga vacío. Si no existe `.agentic-loop/agents.json`, la TUI arranca en estado **SIN AGENTES**:

```text
┌ Agentes (0) ──────────────┐
│      PRIMEROS PASOS       │
│                           │
│   1  [a]  Agrega agente   │
│   2  [s]  Crea una tarea  │
│   3  [e]  Ejecuta         │
└───────────────────────────┘
```

Pasos:

1. Presiona `a`.
2. Completa el formulario:
   - `Provider`: por ejemplo `opencode`.
   - `Agent ID`: por ejemplo `builder-01`.
   - `Modelo`: por ejemplo `deepseek-v4.1-flash-free`.
   - `Etiqueta`: texto libre.
   - `Capabilities`: lista separada por comas, por ejemplo `typescript,backend`.
3. `Enter` guarda el agente en `.agentic-loop/agents.json`.
4. El estado del header cambia a **CONECTADO**.

Puedes agregar varios agentes. El `TaskAssignmentService` elegirá entre ellos según las capabilities y el provider preferido.

## Estados de conexión

| Estado | Significado | Acción |
| --- | --- | --- |
| `CONECTANDO` | Consultando el bridge | Espera |
| `CONECTADO` | Bridge responde y hay agentes | Operar normalmente |
| `SIN AGENTES` | Bridge responde, pero el registry está vacío | Presiona `a` |
| `SIN CONEXIÓN` | No se pudo lanzar o leer el bridge | Revisa el error y presiona `r` |

En `SIN CONEXIÓN` la pantalla muestra la causa, el store y una guía de diagnóstico.

## Pantalla

```text
╭──────────────────────────────────────────────────────────────╮
│ AGENTIC LOOP   CONECTADO         1 agente   3 tareas         │
│ Orquestador local             ● bridge local · TUI Rust      │
╰──────────────────────────────────────────────────────────────╯
╭ AGENTES  1 ──────────────╮ ╭ ● TAREAS  3 ────────────────────╮
│ OpenCode Builder         │ │  TAREA            ESTADO   ...  │
│ opencode:builder-01      │ │ ▍ Implementar...  QUEUED        │
│ deepseek-v4.1-flash-free │ │                                 │
│ typescript, backend      │ ╰─────────────────────────────────╯
│                          │ ╭ DETALLE ────────────────────────╮
│                          │ │ ▍ Implementar onboarding...     │
│                          │ │ Agente, repo, descripción...    │
╰──────────────────────────╯ ╰─────────────────────────────────╯
╭ SESIÓN .agentic-loop/tasks.json ─────────────────────────────╮
│ TAREAS  s crear  e ejecutar  c cancelar  R cola  Tab agentes │
│ GLOBAL  ? ayuda  r refrescar  ↑↓ mover  Ctrl+C salir         │
│ ● OK  1 agente · 3 tareas                                    │
╰──────────────────────────────────────────────────────────────╯
```

La barra inferior es contextual: cambia según el foco (`AGENTES` o `TAREAS`), muestra los atajos globales y el último mensaje.

La TUI se ejecuta en raw mode para capturar teclas sin esperar a `Enter`. Por eso `Ctrl+C` se maneja explícitamente como una tecla más: si no se intercepta, el sistema no lo convierte en una señal de interrupción.

## Teclas

| Tecla | Acción |
| --- | --- |
| `q` | Salir |
| `Ctrl+C` | Salir en cualquier momento, incluso con un modal abierto |
| `r` | Refrescar estado, agentes y tareas |
| `Tab` | Cambiar foco entre agentes y tareas |
| `↑` / `↓` o `j` / `k` | Mover selección |
| `a` | Agregar agente |
| `d` | Quitar agente seleccionado (foco agentes) |
| `s` | Crear tarea |
| `e` | Ejecutar tarea seleccionada (foco tareas) |
| `c` | Cancelar tarea seleccionada (foco tareas) |
| `R` o `Shift+r` | Procesar la cola (máx. 50 tareas) |
| `?` | Ayuda |
| `Enter` / `Esc` / `Espacio` | Cerrar bienvenida |
| `Enter` / `y` | Confirmar diálogo |
| `Esc` / `n` | Cancelar diálogo o cerrar formulario |

Dentro de un formulario:

- `Tab` / `↑` / `↓`: mover campo.
- `←` / `→`: cambiar opciones en Fuente y Prioridad.
- `Enter`: guardar.
- `Esc`: cancelar.

## Agentes

- La lista se lee de `.agentic-loop/agents.json`.
- `d` pide confirmación antes de eliminar.
- Al eliminar el último agente, el estado pasa a **SIN AGENTES**.
- El provider `opencode` usa `OpenCodeAgentAdapter`, que arranca un servidor local del SDK y ejecuta el agente sobre el workspace.
- Los demás providers siguen usando `SimulatedAgentAdapter`.
- `AGENTIC_LOOP_SIMULATE=1` fuerza adaptadores simulados para todos.

Formato del archivo:

```json
[
  {
    "provider": "opencode",
    "agentId": "builder-01",
    "model": "deepseek-v4.1-flash-free",
    "label": "OpenCode Builder",
    "capabilities": ["typescript", "backend"],
    "metadata": {}
  }
]
```

## Tareas

El formulario de creación (`s`) incluye:

- Título y descripción (obligatorios).
- Fuente: `MANUAL`, `CLI`, `API`, `WEBHOOK`, `GITHUB_ISSUE`, `GITLAB_ISSUE`, `JIRA_ISSUE`, `SLACK`.
- External ID y URL. Las fuentes de issue exigen External ID.
- Prioridad: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- Repositorio en formato `owner/name` y rama base.
- Workspace: checkout local donde OpenCode implementará la tarea. Si se deja vacío, usa `AGENTIC_LOOP_WORKSPACE` o el directorio actual.
- Criterios de aceptación separados por comas.

`e` ejecuta la tarea seleccionada: encola, asigna agente, transiciona a `IN_PROGRESS`, invoca el gateway y guarda el resultado. `c` la cancela con confirmación. `R` procesa la cola en orden de prioridad.

## Ejecución real con OpenCode

El adapter usa `@opencode-ai/sdk` y requiere el ejecutable `opencode` instalado y autenticado.

```bash
AGENTIC_LOOP_WORKSPACE=/ruta/al/checkout pnpm tui
```

- Toma el modelo del agente. `provider/model` usa ese provider; un id sin `/` usa `AGENTIC_LOOP_OPENCODE_PROVIDER`.
- Arranca un servidor local por ejecución y lo cierra al terminar. Con `AGENTIC_LOOP_OPENCODE_URL` se conecta a un servidor existente.
- Permite editar archivos y ejecutar comandos; deniega `webfetch`, `external_directory` y `doom_loop` por defecto. `bash` no está aislado por el sistema de permisos: usa un checkout sin secretos si no confías en la tarea.
- El prompt prohíbe commits, pushes y pull requests salvo que la tarea lo pida.
- Si el agente excede el timeout o falla, la tarea pasa a `FAILED`. Si se cancela, pasa a `BLOCKED`.
- El resumen final se toma de las partes de texto; los patches se reportan como artefactos.

## Protocolo del bridge

Entrada (una sola línea o bloque JSON por `stdin`):

```json
{
  "command": "agents.add",
  "args": {
    "provider": "opencode",
    "agentId": "builder-01",
    "model": "deepseek-v4.1-flash-free",
    "label": "OpenCode Builder",
    "capabilities": ["typescript", "backend"]
  },
  "store": ".agentic-loop/tasks.json"
}
```

Respuesta correcta:

```json
{
  "ok": true,
  "data": {
    "agent": {
      "provider": "opencode",
      "agentId": "builder-01",
      "model": "deepseek-v4.1-flash-free",
      "label": "OpenCode Builder",
      "capabilities": ["typescript", "backend"],
      "metadata": {}
    }
  },
  "events": []
}
```

Respuesta de error:

```json
{
  "ok": false,
  "error": {
    "code": "NO_AGENT_AVAILABLE",
    "message": "No agent available for task ...",
    "status": 503,
    "problem": {
      "type": "https://errors.agentic-loop.dev/no-agent-available-error",
      "title": "NoAgentAvailableError",
      "status": 503,
      "detail": "No agent available for task ..."
    }
  },
  "events": []
}
```

### Comandos

| Comando | Argumentos principales | Devuelve |
| --- | --- | --- |
| `status` | — | store, agent store, contadores, adapters |
| `agents.list` | — | `agents` |
| `agents.add` | `provider`, `agentId`, `model?`, `label?`, `capabilities?`, `metadata?` | `agent` |
| `agents.remove` | `provider`, `agentId` | `removed` |
| `tasks.list` | `limit?` | `tasks` |
| `tasks.get` | `taskId` | `task` |
| `tasks.submit` | `title`, `description`, `source`, `repository`, `priority?`, `sourceRef?`, `acceptanceCriteria?`, `metadata?` | `taskId`, `version` |
| `tasks.execute` | `taskId`, `capabilities?`, `preferredProvider?`, `timeoutMs?` | `taskId`, `outcome`, `status` |
| `tasks.run` | `maxTasks?`, `capabilities?`, `preferredProvider?`, `stopOnError?` | `processed`, `failures` |
| `tasks.cancel` | `taskId`, `reason?` | `task` |
| `store.reset` | `what?: "tasks" \| "agents" \| "all"` | `reset` |

Ejemplo manual:

```bash
printf '%s' '{"command":"status","args":{}}' \
  | node dist/infrastructure/cli/bridge.js
```

## Archivos relevantes

```text
03-agentic-loop/
├── infrastructure/
│   ├── cli/bridge.ts                 # protocolo JSON
│   ├── agents/FileAgentRegistry.ts   # agentes persistentes
│   └── events/CollectingEventPublisher.ts
├── tui/
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs                   # terminal, --check, --help
│       ├── bridge.rs                 # cliente del bridge y modelos
│       ├── app.rs                    # estado, teclas, formularios
│       └── ui.rs                     # render Ratatui
└── docs/tui.md
```

Stores generados:

```text
.agentic-loop/tasks.json
.agentic-loop/agents.json
```

## Diagnóstico

### `SIN CONEXIÓN`

1. Ejecuta `pnpm build` para generar `dist/infrastructure/cli/bridge.js`.
2. Verifica que estás en `03-agentic-loop` o pasa `--bridge`.
3. Comprueba Node con `node --version`.
4. Ejecuta `pnpm tui:check` para ver el error exacto.
5. Presiona `r` en la TUI para reintentar.

### `No existe el bridge`

La ruta de `--bridge` o `AGENTIC_LOOP_BRIDGE` no apunta al archivo compilado. Usa una ruta absoluta si lanzas la TUI desde otro directorio.

### `SIN AGENTES`

Es un estado válido, no un error. Agrega un agente con `a` o revisa `.agentic-loop/agents.json`.

### `AGENT_ALREADY_REGISTERED`

Ya existe un agente con ese `provider` + `agentId`. Usa otro ID o elimínalo con `d`.

### `NO_AGENT_AVAILABLE`

No hay agentes que cumplan las capabilities solicitadas. Agrega un agente con la capability necesaria o ejecuta sin filtros.

### JSON corrupto

Si `tasks.json` o `agents.json` no son JSON válido, el bridge devuelve un error. Puedes hacer respaldo y reiniciar:

```bash
printf '%s' '{"command":"store.reset","args":{"what":"all"}}' \
  | node dist/infrastructure/cli/bridge.js
```

## Limitaciones actuales

- OpenCode se ejecuta sin streaming en la TUI; el resultado aparece al terminar.
- Claude sigue usando `SimulatedAgentAdapter`.
- Cada acción lanza un proceso Node; no hay daemon.
- Los stores son locales y no tienen bloqueo para múltiples usuarios.
- La TUI refresca bajo demanda, no en tiempo real.
- El agent store se deriva del task store salvo que se indique otra ruta.
