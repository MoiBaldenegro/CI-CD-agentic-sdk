# Plan: core dinámico en libs + cola BullMQ + dashboard

## Estado

Implementado y verificado (`tsc`, `lint`, `test`, `build`).
OpenCode CLI cableado como adapter local, cola BullMQ con worker y endpoints HTTP
con logs paso a paso.

## Contexto

- `libs/factory` expone el dominio/aplicación como módulo dinámico de Nest.
- `libs/persistence` aporta `PostgresDbModule`, `RedisDbModule` y utilidades
  transaccionales; Mongo queda fuera del build (carpeta ignorada).
- `libs/shared-kernel` aporta `TransactionPort`; se agregó `libs/logging/safe-error`
  para el import que faltaba.
- `src` contiene el bounded context `factory` y la conexión a Postgres.

## Estructura

```text
libs/factory/src/
  factory-core.module.ts        # DynamicModule: register / registerAsync
  factory.tokens.ts             # TASK_REPOSITORY, AGENT_GATEWAY, TASK_QUEUE
  core/                         # dominio + aplicación (puertos async)

libs/queue/
  bullmq/bullmq.module.ts       # BullModule.forRoot + registerQueue
  bullmq/bullmq.config.ts       # conexión Redis (maxRetriesPerRequest: null)
  bullmq/bullmq.tokens.ts       # TASK_QUEUE_NAME, TASK_QUEUE_TOKEN
  bullmq/bullmq.types.ts        # opciones y TaskQueueJobData

libs/persistence/
  postgres-db/                  # PostgresDbModule (TypeORM)
  redis-db/                     # RedisDbModule

src/
  app.module.ts                 # raíz: GlobalModule + FactoryModule + filtro de dominio
  main.ts                       # bootstrap + logs de configuración
  global/
    global.module.ts            # @Global(): ConfigModule + Postgres + BullMQ condicional
    persistence.config.ts       # resuelve PERSISTENCE=memory|postgres
    agent.config.ts             # resuelve AGENT_ADAPTER y opciones de OpenCode CLI
    queue.config.ts             # resuelve QUEUE_ENABLED y conexión Redis
    database/database.module.ts # PostgresDbModule.register(...)
  shared/
    filters/domain-exception.filter.ts  # 400/409/503 de dominio
  modules/
    bounded/
      factory/
        factory.module.ts       # bounded context + FactoryController + TaskProcessor
        core/core.module.ts     # importa FactoryCoreModule.registerAsync
        controllers/
          factory.controller.ts # endpoints HTTP
          factory.dto.ts        # contratos de entrada
          task-dashboard.page.ts # dashboard HTML en vivo
        infrastructure/
          infrastructure.module.ts  # elige repositorio, agente y cola
          queue/bullmq-task-queue.adapter.ts
          queue/unavailable-task-queue.adapter.ts
          queue/task.processor.ts
          queue/task-execution.prompt.ts
          persistence/task.orm-entity.ts
          persistence/typeorm-task.repository.ts
          persistence/in-memory-task.repository.ts
          agents/OpenCodeCliAgentAdapter.ts
          agents/OpenCodeAgentAdapter.ts   # SDK, excluido del build
          agents/OpenRouterAgentAdapter.ts
          agents/unavailable-agent.gateway.ts
          agents/simulated-agent.gateway.ts
```

## Endpoints

```text
GET  /factory/health
GET  /factory/dashboard
POST /factory/tasks
GET  /factory/tasks
GET  /factory/tasks/:id
POST /factory/tasks/:id/approve
POST /factory/tasks/:id/requeue
POST /factory/tasks/:id/cancel
GET  /factory/queue/stats
POST /factory/agents/prompt
```

Ejemplo de prompt:

```bash
curl -X POST http://localhost:3003/factory/agents/prompt \
  -H "Content-Type: application/json" \
  -d '{"provider":"opencode","agentId":"builder-01","text":"Responde OK"}'
```

Ejemplo de tarea:

```bash
curl -X POST http://localhost:3003/factory/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Probar endpoint",
    "description":"Validar flujo HTTP",
    "source":"API",
    "repository":{"owner":"moises","name":"agentic-sdk","baseBranch":"main"},
    "priority":"HIGH",
    "acceptanceCriteria":["Se crea"],
    "metadata":{"ambiente":"local"},
    "assignee":{"provider":"opencode","agentId":"builder-01"}
  }'
```

## Contrato del módulo dinámico

```ts
FactoryCoreModule.register({ taskRepository, agentGateway, taskQueue });
FactoryCoreModule.registerAsync({
  imports: [InfrastructureModule],
  inject: [TASK_REPOSITORY, AGENT_GATEWAY, TASK_QUEUE],
  useFactory: (taskRepository, agentGateway, taskQueue) => ({
    taskRepository,
    agentGateway,
    taskQueue,
  }),
});
```

Exporta `TaskApplicationService` y `AgentApplicationService`.

## Decisiones tomadas

- `PERSISTENCE=memory|postgres` elige solo el repositorio.
  Por defecto: `memory` fuera de producción y `postgres` en producción.
- `AGENT_ADAPTER=opencode-cli|simulated|unavailable` elige solo el agente.
  Por defecto: `opencode-cli` fuera de producción y `unavailable` en producción.
- Modo `memory`: `InMemoryTaskRepository`; sin Postgres.
- Modo `postgres`: `TypeOrmTaskRepository`.
- OpenCode CLI usa `OPENCODE_WORKSPACE`, `OPENCODE_MODEL`,
  `OPENCODE_SYSTEM_PROMPT`, `OPENCODE_DEBUG` y `OPENCODE_THINKING`.
- `OPENCODE_WORKSPACE` vacío cae a `process.cwd()`.
- `OpenCodeAgentAdapter.ts` (SDK `@opencode/sdk`) queda excluido de
  `tsconfig`, `tsconfig.build` y ESLint; se usa `OpenCodeCliAgentAdapter`.
- Puertos y casos de uso de tareas pasaron a `Promise` por TypeORM.
- `TypeOrmTaskRepository` usa `currentManager(dataSource)` para unirse a la
  transacción en curso (`inTransaction`) cuando exista.
- `synchronize` por defecto en `true` vía `DB_SYNCHRONIZE` (no hay migraciones aún).
- `webpack.config.js` agrega `extensionAlias` para resolver imports `.js` del core.
- Mongo excluido de `tsconfig`, ESLint y export público de `libs/persistence`.
- `QUEUE_ENABLED` activa BullMQ; por defecto `false`. `QUEUE_CONCURRENCY`
  configura la concurrencia objetivo (el worker actual usa 1).
- La cola usa conexión Redis propia (`REDIS_HOST`, `REDIS_PORT`,
  `REDIS_PASSWORD`, `REDIS_DB`) con `maxRetriesPerRequest: null`.
- BullMQ es complemento: la tarea se persiste antes de encolar y Postgres/memory
  sigue siendo la fuente de verdad.
- `POST /factory/tasks` responde `202` con `{ task, queue: { jobId } }`.
- `QueueTaskUseCase` solo encola desde `PENDING` o `BLOCKED`; el worker acepta
  `PENDING`/`BLOCKED` y transiciona `QUEUED -> IN_PROGRESS`.
- OpenCode devuelve `[[FACTORY_STATUS:COMPLETED]]`, `[[FACTORY_STATUS:IN_REVIEW]]`
  o `[[FACTORY_STATUS:BLOCKED:motivo]]`; el worker aplica el estado final.
- El jobId incluye timestamp para permitir reencolar una tarea bloqueada sin
  reutilizar un job completado.
- `DomainExceptionFilter` traduce `DomainValidationError` a 400,
  `InvalidStateTransitionError` a 409 y `TaskQueueUnavailableError` a 503.
- Logs paso a paso en controller, casos de uso, repositorios, cola y adapter CLI.

## Pendientes

- Migraciones reales de Postgres y apagar `synchronize`.
- Integrar OpenRouter como opción de `AGENT_ADAPTER`.
- Cancelación cooperativa de un job en curso (hoy el worker termina y descarta
  el resultado si la tarea ya fue cancelada).
- Tests automatizados de cola/worker y de transiciones humanas.
- Revisar concurrencia real del worker (`QUEUE_CONCURRENCY`) frente a `@Processor`.

