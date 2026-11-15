# Plan de migración a Rust

## Objetivo

Reemplazar el motor TypeScript y el bridge Node por un único binario Rust que contenga dominio, aplicación, infraestructura y TUI, manteniendo:

- El mismo comportamiento de negocio.
- Los mismos estados, eventos y códigos de error.
- Los mismos archivos `.agentic-loop/tasks.json` y `.agentic-loop/agents.json`.
- La misma UX de la TUI (o mejor).

La migración será **incremental**, con TypeScript como referencia y oráculo de paridad hasta el cutover. No se elimina nada de TS hasta que Rust pase la matriz de paridad.

## Principios

1. **Strangler pattern**: construir Rust al lado, no reescribir encima del código actual.
2. **Contrato primero**: congelar JSON, stores, comandos y errores antes de portar.
3. **Paridad verificable**: mismos fixtures producen mismas salidas.
4. **Hexagonal intacta**: dominio puro, puertos, adapters.
5. **Cutover reversible**: mantener un tag o rama con la versión TS.

## Fase 0 — Estabilización y congelamiento del contrato (AHORA)

Esta fase ocurre antes de escribir Rust. Su objetivo es que el comportamiento actual sea confiable y esté documentado.

### 0.1 Pruebas manuales de la TUI

Checklist:

- [ ] Arranque sin agentes: header `SIN AGENTES`, panel vacío, guía visible.
- [ ] Agregar agente con capabilities.
- [ ] Rechazo de agente duplicado con mensaje claro.
- [ ] Quitar agente con confirmación.
- [ ] Quitar el último agente: vuelve a `SIN AGENTES`.
- [ ] Crear tarea `MANUAL`.
- [ ] Crear tarea `GITHUB_ISSUE` con External ID.
- [ ] Validación de issue sin External ID.
- [ ] Ejecutar tarea con agente compatible.
- [ ] Ejecutar tarea sin agente compatible: error `NO_AGENT_AVAILABLE`.
- [ ] Cancelar tarea con confirmación.
- [ ] Procesar cola con `R`.
- [ ] Refrescar con `r`.
- [ ] Simular `SIN CONEXIÓN` apuntando a un bridge inexistente.
- [ ] Comprobar persistencia tras cerrar y volver a abrir.

### 0.2 Ajustes de UX y bugs

Registrar aquí los ajustes que salgan de las pruebas:

- Formularios: orden de campos, valores por defecto, validaciones.
- Navegación: foco, selección, atajos.
- Mensajes: éxito, error, estado vacío.
- Layout: tamaños, truncado, terminales pequeños.
- Stores: rutas, nombres, reset.
- Agentes: metadata, capabilities, edición.

Cada ajuste debe quedar reflejado en la TUI y en `docs/tui.md`.

### 0.3 Tests de contrato del bridge

Agregar tests ejecutables con `node --test` que validen el contrato actual:

- `status` con store vacío.
- `agents.add` / `agents.list` / `agents.remove`.
- `agents.add` duplicado.
- `tasks.submit` manual y con issue.
- `tasks.submit` issue sin `sourceRef`.
- `tasks.list` / `tasks.get`.
- `tasks.execute` con éxito.
- `tasks.execute` sin agente.
- `tasks.run` con procesadas y fallos.
- `tasks.cancel`.
- `store.reset`.
- Respuesta de error con `code`, `status` y `problem`.

Fixtures recomendados:

```text
03-agentic-loop/
└── test/
    ├── fixtures/
    │   ├── agents.json
    │   └── tasks.json
    └── bridge.contract.test.mjs
```

### 0.4 Congelar contrato

Documentar y congelar:

- Envelope: `{ ok, data, error, events }`.
- Comandos y argumentos.
- Campos en camelCase: `agentId`, `sourceRef`, `baseUrl`, `createdAt`, `updatedAt`, `acceptanceCriteria`.
- Formato de `tasks.json` (array de `TaskPrimitives`).
- Formato de `agents.json` (array de agent descriptors).
- Códigos de error y HTTP status.
- Orden de eventos y versiones.

### Criterios de salida de Fase 0

- Checklist manual completo.
- Ajustes de UX aplicados.
- Tests de contrato en verde.
- Contrato documentado.
- Sin bugs P0/P1 conocidos.

## Fase 1 — Workspace Rust y kernel compartido

### 1.1 Estructura propuesta

```text
03-agentic-loop/
├── Cargo.toml                     # workspace
├── crates/
│   ├── agentic-domain/            # VOs, Task, eventos, servicios, errores
│   ├── agentic-application/       # puertos, casos de uso, DTOs
│   ├── agentic-infrastructure/    # stores, registry, adapters, UoW
│   └── agentic-tui/               # binario + UI
├── tui/                           # TUI actual; se absorbe en agentic-tui
├── core/                          # TS de referencia
├── infrastructure/                # TS de referencia
└── shared/                        # TS de referencia
```

### 1.2 Decisiones técnicas

- **Dominio síncrono y puro**: sin I/O, sin Tokio.
- **Aplicación asíncrona**: puertos con `async-trait`; casos de uso `async`.
- **Infraestructura asíncrona**: `tokio::fs`, procesos y futuros adapters HTTP.
- **TUI síncrona en render**: mantiene `ratatui`/`crossterm`; las acciones llaman a la aplicación con un `tokio::runtime::Runtime::block_on`.
- **Errores**: `thiserror` para errores técnicos; `DomainError`/`DomainException` equivalentes para errores de negocio.
- **Fechas**: `chrono::DateTime<Utc>` con serialización ISO 8601.
- **IDs**: `uuid::Uuid` v4.
- **Mapas**: `BTreeMap<String, String>` para metadata determinista.
- **Serialización**: `serde` + `serde_json`, con `rename` explícito para camelCase.

### 1.3 Portar el shared kernel

- `DomainError`: `code`, `message`, `details`, `occurred_at`, `to_json`.
- `DomainException`: `status_code`, `to_problem_details`, `type` URL.
- Convención de `ValueObject`: newtype validado en constructor.
- `DomainEvent`: `event_id`, `event_name`, `aggregate_id`, `occurred_at`, `version`.

### 1.4 Portar los VOs en orden

1. `TaskId`
2. `TaskTitle`
3. `TaskDescription`
4. `TaskSource`
5. `TaskSourceRef`
6. `RepositoryRef`
7. `AgentRef`
8. `TaskPriority`
9. `TaskStatus`
10. `AcceptanceCriteria`
11. `TaskMetadata`

Cada VO debe tener:

- Constructor validado (`try_new` / `TryFrom`).
- Errores equivalentes a TS.
- `Serialize`/`Deserialize` compatibles con el store actual.
- Tests unitarios de validación y normalización.

### 1.5 Portar `Task`

- Campos privados.
- `create`, `reconstitute`, `from_primitives`, `to_primitives`.
- Transiciones y validaciones de estado.
- Asignación, desasignación, block, fail, cancel, complete.
- Eventos: `task.created`, `task.status-changed`, `task.assigned`, `task.unassigned`.
- `version` monotónica.
- Tests de transiciones válidas e inválidas.

### 1.6 Servicios de dominio

- `TaskAssignmentService`
- `TaskExecutionService`
- `TaskPrioritizationService`
- `TaskRegistrationService`

### Criterios de salida de Fase 1

- `cargo test -p agentic-domain` verde.
- Los VOs serializan/deserializan fixtures TS sin pérdida.
- `Task` reproduce las mismas transiciones y eventos que TS.
- No hay dependencias de infraestructura en el dominio.

## Fase 2 — Aplicación

### 2.1 Puertos

- `TaskRepository`
- `AgentRegistry`
- `AgentGateway`
- `DomainEventPublisher`
- `UnitOfWork`

Firmas asíncronas donde haya I/O. `AbortSignal` se sustituye por timeout/cancelación de Tokio.

### 2.2 Casos de uso

- `SubmitTask`
- `GetTask`
- `ListTasks`
- `CancelTask`
- `ExecuteTask`
- `RunAgenticLoop`

DTOs:

- `TaskExecutionSummary`
- `RunAgenticLoopResult`
- `TaskExecutionFailure`

### 2.3 Servicios de aplicación

- `TaskPersistenceService`
- `AgentInvocationService`
- `AgenticLoopApplication` como fachada.

### 2.4 Tests

- Fakes en memoria para repositorio, registry, gateway y publisher.
- Mismos escenarios que los tests de contrato TS.
- Verificar orden de guardado y publicación de eventos.

### Criterios de salida de Fase 2

- `cargo test -p agentic-application` verde.
- La fachada expone las mismas operaciones que `AgenticLoopApplication`.
- Los DTOs serializan con los mismos nombres de campo.

## Fase 3 — Infraestructura

### 3.1 Persistencia

- `FileTaskRepository`:
  - Lee/escribe el mismo array de `TaskPrimitives`.
  - Escritura atómica con archivo temporal + rename.
  - `find_by_id`, `find_by_source_ref`, `find_by_status`, `find_all`, `find_next`, `delete`.
- `FileAgentRegistry`:
  - Lee/escribe el mismo array de agentes.
  - `list`, `resolve`, `add`, `remove`.
  - Detección de duplicados por `provider` + `agentId`.

### 3.2 Agentes

- `SimulatedAgentAdapter` con `SUCCESS`, `FAILURE`, `BLOCKED`.
- `AgentGatewayRouter` con registro/desregistro por provider.
- `AgentNotRegisteredError` equivalente.

### 3.3 Eventos y UoW

- `CollectingEventPublisher`.
- `NoopUnitOfWork`.
- Preparar el terreno para un UoW transaccional real.

### 3.4 Compatibilidad

Tests obligatorios:

- Leer un `tasks.json` generado por TS y reproducirlo en Rust.
- Leer un `agents.json` generado por TS.
- Escribir desde Rust y volver a leer desde TS (mientras ambos existan).
- Comparar JSON normalizado (mismas claves y valores).

### Criterios de salida de Fase 3

- Roundtrip TS → Rust → TS sin diferencias.
- `cargo test -p agentic-infrastructure` verde.
- Los stores actuales siguen siendo válidos.

## Fase 4 — TUI nativa

### 4.1 Reemplazar el bridge

- Eliminar `tui/src/bridge.rs` como cliente de proceso.
- Crear `tui/src/engine.rs` que llama directamente a `AgenticLoopApplication`.
- Quitar `--bridge` y `--node`.
- Mantener `--store`, `--check` y `--help`.

### 4.2 Estados

Con motor nativo ya no hay "conexión" remota. Reinterpretar:

- `CONECTADO`: motor inicializado y store accesible.
- `SIN AGENTES`: registry vacío.
- `SIN CONEXIÓN`: error fatal de inicialización o store inaccesible.

Mantener el mensaje `SIN CONEXIÓN` para el caso fatal, como se pidió.

### 4.3 Acciones

- Agregar/quitar agentes directo contra `FileAgentRegistry`.
- Crear/ejecutar/cancelar tareas directo contra casos de uso.
- Refrescar con consultas locales.
- Errores de dominio mapeados a mensajes de la TUI.

### 4.4 Rendimiento

- Sin spawn de Node por acción.
- Opcional: ejecutar operaciones largas en background con canal y mostrar spinner.
- Primera versión: operaciones bloqueantes con mensaje "Ejecutando…".

### Criterios de salida de Fase 4

- `cargo run` abre la TUI sin Node.
- Todos los flujos de Fase 0 funcionan igual.
- `--check` funciona sin bridge.
- No queda ninguna referencia a `dist/infrastructure/cli/bridge.js`.

## Fase 5 — Paridad y cutover

### 5.1 Matriz de paridad

| Flujo | TS | Rust |
| --- | --- | --- |
| Estado vacío | ✅ | ⬜ |
| Agregar agente | ✅ | ⬜ |
| Duplicado | ✅ | ⬜ |
| Quitar agente | ✅ | ⬜ |
| Submit manual | ✅ | ⬜ |
| Submit issue | ✅ | ⬜ |
| Execute success | ✅ | ⬜ |
| Execute failure/blocked | ✅ | ⬜ |
| Run cola | ✅ | ⬜ |
| Cancel | ✅ | ⬜ |
| Errores de dominio | ✅ | ⬜ |
| Stores compatibles | ✅ | ⬜ |

### 5.2 Estrategia de cutover

1. Mantener rama/tag `pre-rust`.
2. Ejecutar ambos motores sobre los mismos fixtures.
3. Comparar salidas normalizadas.
4. Cambiar `pnpm tui` por `cargo run`.
5. Eliminar bridge, CLI TS y scripts Node.
6. Actualizar documentación.

### Criterios de salida de Fase 5

- Matriz de paridad completa.
- Tests de contrato ejecutados contra ambos motores.
- Stores compatibles en ambas direcciones.
- Un solo entrypoint documentado.
- Rollback posible desde el tag.

## Fase 6 — Limpieza

- Eliminar `infrastructure/cli/bridge.ts` y `main.ts`.
- Eliminar `FileAgentRegistry.ts`, `CollectingEventPublisher.ts` y demás adapters TS.
- Eliminar `core/` y `shared/` TS si ya no se usan.
- Eliminar `dist/`, `node_modules/`, `pnpm-lock.yaml` y scripts pnpm.
- Dejar un workspace Rust limpio.
- Actualizar `docs/tui.md` y crear `README.md` de uso.

## Mapa TS → Rust

| TypeScript | Rust |
| --- | --- |
| `shared/DomainError.ts` | `agentic-domain/src/error.rs` |
| `shared/DomainException.ts` | `agentic-domain/src/error.rs` |
| `shared/ValueObject.ts` | newtypes validados |
| `shared/DomainEvent.ts` | `agentic-domain/src/event.rs` |
| `Task.entity.ts` | `agentic-domain/src/task.rs` |
| `value-objects/*.ts` | `agentic-domain/src/value_objects/*.rs` |
| `domain/services/*.ts` | `agentic-domain/src/services/*.rs` |
| `application/use-cases/*.ts` | `agentic-application/src/use_cases/*.rs` |
| `application/services/*.ts` | `agentic-application/src/services/*.rs` |
| `outbound/*.port.ts` | traits en `agentic-application/src/ports.rs` |
| `FileTaskRepository.ts` | `agentic-infrastructure/src/task_repository.rs` |
| `FileAgentRegistry.ts` | `agentic-infrastructure/src/agent_registry.rs` |
| `SimulatedAgentAdapter.ts` | `agentic-infrastructure/src/simulated_agent.rs` |
| `AgentGatewayRouter.ts` | `agentic-infrastructure/src/agent_router.rs` |
| `bridge.ts` | desaparece |
| `tui/src/bridge.rs` | `tui/src/engine.rs` |
| `Date` | `chrono::DateTime<Utc>` |
| `Promise` | `async`/`await` |
| `crypto.randomUUID()` | `uuid::Uuid::new_v4()` |
| `Record<string,string>` | `BTreeMap<String, String>` |
| `AbortSignal` | timeout/cancelación de Tokio |

## Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Deriva de comportamiento | Tests de paridad y fixtures compartidos |
| Incompatibilidad de stores | Roundtrip TS ↔ Rust antes del cutover |
| Complejidad async en la TUI | Bloqueo controlado por acción; background después |
| Diferencias de fechas/IDs | Serialización explícita y tests de formato |
| Errores de dominio distintos | Tabla de códigos y tests de contrato |
| Migración incompleta | Fases con criterios de salida y rollback |
| Pérdida de eventos/versiones | Tests de secuencia y versionado |
| Windows paths/archivos | Tests en Windows y escritura atómica |

## Próximos dos pasos concretos

1. **Fase 0**: ejecutar el checklist de la TUI, registrar ajustes y agregar tests de contrato del bridge con fixtures.
2. **Fase 1**: crear el workspace Rust y portar `DomainError`, `DomainException`, eventos y los 11 VOs con tests.

Después de esos dos pasos se decide si seguimos con `Task` o si primero ajustamos más la TUI actual.
