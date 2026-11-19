# Agentic SDK Wrapper

Wrapper/CLI para interactuar con agentes (OpenCode y OpenRouter) sobre una base con arquitectura hexagonal (dominio, aplicación e infraestructura).

## Requisitos

- Node.js (compatible con ESM/`tsx`)
- Dependencias instaladas (`npm`, `pnpm` o similar)

## Instalación y ejecución

```bash
# instalar dependencias
npm install

# ejecutar la CLI
npm run mxvi
# o
npm start
```

La CLI (`infrastructure/cli/main.ts`) permite:
- **Modo tarea**: crea una `Task` y envía al agente un prompt con título, descripción e instrucciones.
- **Modo chat**: conversación interactiva con el agente.
- **Proveedor**: OpenRouter u OpenCode (con selección de modelo/directorio de trabajo).

## Configuración (`.env`)

Copiar `.env.example` a `.env` y ajustar según el proveedor:

| Variable | Descripción |
| --- | --- |
| `OPENROUTER_API_KEY` | API key de OpenRouter (requerida para proveedor OpenRouter). |
| `OPENROUTER_MODEL` | Modelo por defecto de OpenRouter (ej. `openai/gpt-4o-mini`). |
| `OPENROUTER_SITE_URL` | (Opcional) `HTTP-Referer` para OpenRouter. |
| `OPENROUTER_APP_NAME` | (Opcional) `X-Title` para OpenRouter. |
| `OPENCODE_DEBUG` | `1` activa `--print-logs --log-level DEBUG` y muestra en vivo stdout/stderr de OpenCode. |
| `OPENCODE_THINKING` | `1` activa `--thinking` para mostrar la cadena de pensamiento del modelo. |
| `OPENCODE_SYSTEM_PROMPT` | Prompt de sistema usado por el adaptador/flujo de OpenCode. |

## Autenticación de Claude Code en Ubuntu sin navegador

Para usar una suscripción de Claude desde un servidor Ubuntu, inicia el login una sola vez
por SSH:

```bash
chmod +x scripts/login-claude.sh
./scripts/login-claude.sh
```

Claude mostrará una URL. Ábrela en el navegador de tu computadora, completa el login con
tu cuenta de Claude y pega el código de regreso en la sesión SSH. No se requiere una API key.

La sesión OAuth queda guardada en `~/.claude`. En Docker o servidores efímeros, monta ese
directorio como volumen persistente. No uses `claude --bare` para este flujo, porque ese modo
no utiliza las credenciales OAuth guardadas.

## Estructura del proyecto

```
core/
  application/        # Casos de uso y servicios de aplicación (orquestación)
    services/
    use-cases/
  domain/             # Núcleo de negocio (sin dependencias de infraestructura)
    Agent.entity.ts
    Task.entity.ts
    exceptions/
    outbound/         # Puertos (interfaces) hacia el exterior
    services/         # Servicios de dominio y sus contratos (.port.ts)
    value-objects/    # VOs por agregado (agent/, task/) y base ValueObject
infrastructure/
  agents/             # Adaptadores de agentes (OpenCode CLI, OpenRouter, etc.)
  cli/                # Punto de entrada CLI (main.ts)
  container/          # Composition root / inyección de dependencias
  persistence/        # Adaptadores de persistencia (p.ej. InMemoryTaskRepository)
```

## Convenciones

### Arquitectura y dependencias
- **Hexagonal / Ports & Adapters**: `core/domain` define entidades, value objects, servicios de dominio y puertos (`outbound/`, `services/contracts/*.port.ts`). `core/application` orquesta casos de uso/servicios. `infrastructure` implementa adaptadores y el contenedor.
- **Dirección de dependencias**: la infraestructura depende del core; el core no depende de la infraestructura. Los puertos viven en dominio y se implementan en infraestructura.
- **Composition root**: `infrastructure/container/ApplicationContainer.ts` cablea repositorios, servicios, casos de uso y gateways.

### Código y estilo
- **TypeScript + ESM** (`"type": "module"`). Las importaciones relativas usan extensión `.js` en el source TS (resolución ESM con `tsx`).
- **Entidades y Value Objects**: las entidades exponen fábricas estáticas (p.ej. `Task.create`, `Agent.create`) y retornos tipados/primitivos según el caso; los VOs extienden `ValueObject` y encapsulan validación/inmutabilidad.
- **Nombrado de archivos**: sufijos explícitos por rol, p.ej. `*.entity.ts`, `*.vo.ts`, `*.port.ts`, `*.use-case.ts`, `*Service.ts`, `*Adapter.ts`, `*Repository.ts`.
- **Errores de dominio**: excepciones específicas en `core/domain/exceptions/` (p.ej. `DomainValidationError`, `InvalidStateTransitionError`).
- **Sin comentarios superfluos**: el código se mantiene autoexplicativo salvo que se soliciten comentarios.

### Persistencia y agentes
- Repositorio de tareas en memoria (`InMemoryTaskRepository`) como implementación por defecto del puerto `TaskRepository`.
- Gateways de agente implementan el puerto `AgentGateway` (`sendPrompt`) para cada proveedor (OpenRouter, OpenCode CLI).

## Notas
- `projects/` se usa como área de trabajo y está ignorada por git.
- No hay scripts de lint/test configurados actualmente en `package.json`; verificar manualmente según sea necesario.
