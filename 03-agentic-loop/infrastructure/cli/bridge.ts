import { rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { AgenticLoopApplication } from "../../core/application/index.js";
import type { SubmitTaskCommand } from "../../core/application/index.js";
import { AGENT_OUTCOME } from "../../core/domain/outbound/AgentGateway.port.js";
import type { AgentOutcomeValue } from "../../core/domain/outbound/AgentGateway.port.js";
import { DomainError } from "../../shared/DomainError.js";
import { DomainException } from "../../shared/DomainException.js";
import type { ProblemDetails } from "../../shared/DomainException.js";
import { FileAgentRegistry, toPrimitives } from "../agents/FileAgentRegistry.js";
import { AgentGatewayRouter } from "../agents/AgentGatewayRouter.js";
import { OpenCodeAgentAdapter } from "../agents/OpenCodeAgentAdapter.js";
import { SimulatedAgentAdapter } from "../agents/SimulatedAgentAdapter.js";
import { CollectingEventPublisher } from "../events/CollectingEventPublisher.js";
import { FileTaskRepository } from "../persistence/FileTaskRepository.js";
import { NoopUnitOfWork } from "../persistence/NoopUnitOfWork.js";

interface BridgeRequest {
  readonly command: string;
  readonly args: Record<string, unknown>;
  readonly store?: string;
  readonly agentsStore?: string;
}

interface Stores {
  readonly taskStore: string;
  readonly agentStore: string;
}

interface Context {
  readonly app: AgenticLoopApplication;
  readonly registry: FileAgentRegistry;
  readonly gateway: AgentGatewayRouter;
  readonly publisher: CollectingEventPublisher;
}

interface BridgeErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly status: number;
  readonly details?: Record<string, unknown> | undefined;
  readonly problem?: ProblemDetails | undefined;
}

class BridgeRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function main(): Promise<void> {
  try {
    const raw = await readStdin();

    if (raw.trim().length === 0) {
      throw new BridgeRequestError("BRIDGE_EMPTY_REQUEST", "Expected a JSON request on stdin");
    }

    const request = parseRequest(raw);
    const stores = resolveStores(request);
    const outcome = parseOutcome(optionalString(request.args, "outcome"));
    const context = await createContext(stores, outcome);

    try {
      const data = await dispatch(request, context, stores);
      writeResponse({ ok: true, data, events: context.publisher.pull() });
    } catch (error) {
      writeResponse({
        ok: false,
        error: describeError(error),
        events: context.publisher.pull(),
      });
    }
  } catch (error) {
    writeResponse({ ok: false, error: describeError(error), events: [] });
  }
}

async function dispatch(
  request: BridgeRequest,
  context: Context,
  stores: Stores,
): Promise<unknown> {
  const args = request.args;

  switch (request.command) {
    case "status": {
      const agents = await context.registry.list();
      const tasks = await context.app.listTasks(10_000);
      const byStatus: Record<string, number> = {};

      for (const task of tasks) {
        byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
      }

      return {
        engine: "agentic-loop",
        storePath: stores.taskStore,
        agentStorePath: stores.agentStore,
        agentCount: agents.length,
        executionAdapters: context.gateway.registeredProviders(),
        tasks: { total: tasks.length, byStatus },
      };
    }
    case "agents.list":
      return { agents: (await context.registry.list()).map(toPrimitives) };
    case "agents.add": {
      const model = optionalNullableString(args, "model");
      const label = optionalNullableString(args, "label");
      const capabilities = optionalStringArray(args, "capabilities");
      const metadata = optionalStringRecord(args, "metadata");
      const descriptor = await context.registry.add({
        provider: requireString(args, "provider"),
        agentId: requireString(args, "agentId"),
        ...(model !== undefined && { model }),
        ...(label !== undefined && { label }),
        ...(capabilities !== undefined && { capabilities }),
        ...(metadata !== undefined && { metadata }),
      });

      return { agent: toPrimitives(descriptor) };
    }
    case "agents.remove": {
      const removed = await context.registry.remove(
        requireString(args, "provider"),
        requireString(args, "agentId"),
      );

      return { removed };
    }
    case "tasks.list": {
      const limit = optionalNumber(args, "limit") ?? 100;
      return { tasks: await context.app.listTasks(limit) };
    }
    case "tasks.get":
      return { task: await context.app.getTask(requireString(args, "taskId")) };
    case "tasks.submit": {
      const priority = optionalString(args, "priority");
      const acceptanceCriteria = optionalStringArray(args, "acceptanceCriteria");
      const metadata = optionalStringRecord(args, "metadata");
      const sourceRef = parseSourceRef(args);
      const assignee = parseAssignee(args);
      const command: SubmitTaskCommand = {
        title: requireString(args, "title"),
        description: requireString(args, "description"),
        source: optionalString(args, "source") ?? "MANUAL",
        repository: parseRepository(args.repository),
        ...(sourceRef !== undefined && { sourceRef }),
        ...(priority !== undefined && { priority }),
        ...(acceptanceCriteria !== undefined && { acceptanceCriteria }),
        ...(metadata !== undefined && { metadata }),
        ...(assignee !== undefined && { assignee }),
      };
      const result = await context.app.submitTask(command);

      return { taskId: result.taskId.value, version: result.version };
    }
    case "tasks.execute": {
      const capabilities = optionalStringArray(args, "capabilities");
      const preferredProvider = optionalString(args, "preferredProvider");
      const timeoutMs = optionalNumber(args, "timeoutMs");
      const summary = await context.app.executeTask(requireString(args, "taskId"), {
        ...(capabilities !== undefined && { capabilities }),
        ...(preferredProvider !== undefined && { preferredProvider }),
        ...(timeoutMs !== undefined && { timeoutMs }),
      });

      return {
        taskId: summary.taskId,
        outcome: summary.outcome,
        status: summary.status,
      };
    }
    case "tasks.run": {
      const maxTasks = optionalNumber(args, "maxTasks");
      const capabilities = optionalStringArray(args, "capabilities");
      const preferredProvider = optionalString(args, "preferredProvider");
      const timeoutMs = optionalNumber(args, "timeoutMs");
      const stopOnError = optionalBoolean(args, "stopOnError");
      const result = await context.app.run({
        ...(maxTasks !== undefined && { maxTasks }),
        ...(capabilities !== undefined && { capabilities }),
        ...(preferredProvider !== undefined && { preferredProvider }),
        ...(timeoutMs !== undefined && { timeoutMs }),
        ...(stopOnError !== undefined && { stopOnError }),
      });

      return {
        startedAt: result.startedAt.toISOString(),
        finishedAt: result.finishedAt.toISOString(),
        processed: result.processed,
        failures: result.failures,
      };
    }
    case "tasks.cancel": {
      const task = await context.app.cancelTask(
        requireString(args, "taskId"),
        optionalString(args, "reason") ?? "Cancelled from TUI",
      );

      return { task };
    }
    case "store.reset": {
      const what = optionalString(args, "what") ?? "all";

      if (what === "tasks" || what === "all") {
        await rm(stores.taskStore, { force: true });
      }

      if (what === "agents" || what === "all") {
        await rm(stores.agentStore, { force: true });
      }

      return { reset: what };
    }
    default:
      throw new BridgeRequestError(
        "BRIDGE_UNKNOWN_COMMAND",
        `Unknown command "${request.command}"`,
      );
  }
}

async function createContext(stores: Stores, outcome: AgentOutcomeValue): Promise<Context> {
  const registry = new FileAgentRegistry(stores.agentStore);
  const agents = await registry.list();
  const gateway = new AgentGatewayRouter();
  const providers = new Set<string>();
  const simulate = process.env.AGENTIC_LOOP_SIMULATE === "1";

  for (const descriptor of agents) {
    const provider = descriptor.agent.provider;

    if (providers.has(provider)) continue;

    providers.add(provider);
    gateway.register(
      provider === "opencode" && !simulate
        ? new OpenCodeAgentAdapter({ provider })
        : new SimulatedAgentAdapter(provider, outcome),
    );
  }

  const publisher = new CollectingEventPublisher();
  const app = new AgenticLoopApplication({
    taskRepository: new FileTaskRepository(stores.taskStore),
    agentRegistry: registry,
    agentGateway: gateway,
    eventPublisher: publisher,
    unitOfWork: new NoopUnitOfWork(),
  });

  return { app, registry, gateway, publisher };
}

function parseRequest(raw: string): BridgeRequest {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BridgeRequestError("BRIDGE_INVALID_JSON", "Request body must be valid JSON");
  }

  const record = asRecord(parsed, "request");
  const command = record.command;

  if (typeof command !== "string" || command.trim().length === 0) {
    throw new BridgeRequestError("BRIDGE_INVALID_REQUEST", "request.command must be a string");
  }

  const args = record.args === undefined ? {} : asRecord(record.args, "request.args");

  return {
    command: command.trim(),
    args,
    ...(typeof record.store === "string" && { store: record.store }),
    ...(typeof record.agentsStore === "string" && { agentsStore: record.agentsStore }),
  };
}

function resolveStores(request: BridgeRequest): Stores {
  const taskStore = resolve(
    process.cwd(),
    request.store ?? process.env.AGENTIC_LOOP_STORE ?? ".agentic-loop/tasks.json",
  );
  const agentStore = resolve(
    process.cwd(),
    request.agentsStore ??
      process.env.AGENTIC_LOOP_AGENTS ??
      join(dirname(taskStore), "agents.json"),
  );

  return { taskStore, agentStore };
}

function parseOutcome(value: string | undefined): AgentOutcomeValue {
  const normalized = (value ?? AGENT_OUTCOME.SUCCESS).toUpperCase();

  if (normalized === AGENT_OUTCOME.SUCCESS) return AGENT_OUTCOME.SUCCESS;
  if (normalized === AGENT_OUTCOME.FAILURE) return AGENT_OUTCOME.FAILURE;
  if (normalized === AGENT_OUTCOME.BLOCKED) return AGENT_OUTCOME.BLOCKED;

  throw new BridgeRequestError(
    "BRIDGE_INVALID_REQUEST",
    `Invalid outcome "${value}". Use SUCCESS, FAILURE or BLOCKED.`,
  );
}

function parseSourceRef(args: Record<string, unknown>): SubmitTaskCommand["sourceRef"] | undefined {
  const nested = args.sourceRef;

  if (nested !== undefined) {
    if (nested === null) return null;

    const record = asRecord(nested, "args.sourceRef");
    return {
      externalId: requireString(record, "externalId"),
      url: optionalNullableString(record, "url") ?? null,
    };
  }

  const externalId = optionalString(args, "externalId");

  if (externalId === undefined) return undefined;

  return { externalId, url: optionalNullableString(args, "url") ?? null };
}

function parseAssignee(args: Record<string, unknown>): SubmitTaskCommand["assignee"] | undefined {
  const value = args.assignee;

  if (value === undefined) return undefined;
  if (value === null) return null;

  const record = asRecord(value, "args.assignee");

  return {
    provider: requireString(record, "provider"),
    agentId: requireString(record, "agentId"),
    model: optionalNullableString(record, "model") ?? null,
  };
}

function parseRepository(value: unknown): SubmitTaskCommand["repository"] {
  if (value === undefined) {
    return { owner: "acme", name: "app", baseBranch: "main" };
  }

  const record = asRecord(value, "args.repository");

  return {
    owner: requireString(record, "owner"),
    name: requireString(record, "name"),
    baseBranch: optionalString(record, "baseBranch") ?? "main",
  };
}

function describeError(error: unknown): BridgeErrorPayload {
  if (error instanceof DomainException) {
    return {
      code: error.code,
      message: error.message,
      status: error.statusCode,
      problem: error.toProblemDetails(),
      ...(error.details !== undefined && { details: { ...error.details } }),
    };
  }

  if (error instanceof DomainError) {
    return {
      code: error.code,
      message: error.message,
      status: 422,
      ...(error.details !== undefined && { details: { ...error.details } }),
    };
  }

  if (error instanceof BridgeRequestError) {
    return { code: error.code, message: error.message, status: 400 };
  }

  return {
    code: "BRIDGE_INTERNAL_ERROR",
    message: error instanceof Error ? error.message : String(error),
    status: 500,
  };
}

function writeResponse(response: unknown): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BridgeRequestError("BRIDGE_INVALID_REQUEST", `${context} must be an object`);
  }

  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BridgeRequestError(
      "BRIDGE_INVALID_REQUEST",
      `Argument "${key}" must be a non-empty string`,
    );
  }

  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];

  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new BridgeRequestError("BRIDGE_INVALID_REQUEST", `Argument "${key}" must be a string`);
  }

  return value;
}

function optionalNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null | undefined {
  const value = record[key];

  if (value === undefined || value === null) return value;
  if (typeof value !== "string") {
    throw new BridgeRequestError(
      "BRIDGE_INVALID_REQUEST",
      `Argument "${key}" must be a string or null`,
    );
  }

  return value;
}

function optionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];

  if (value === undefined) return undefined;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BridgeRequestError("BRIDGE_INVALID_REQUEST", `Argument "${key}" must be a number`);
  }

  return value;
}

function optionalBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];

  if (value === undefined) return undefined;

  if (typeof value !== "boolean") {
    throw new BridgeRequestError("BRIDGE_INVALID_REQUEST", `Argument "${key}" must be a boolean`);
  }

  return value;
}

function optionalStringArray(
  record: Record<string, unknown>,
  key: string,
): readonly string[] | undefined {
  const value = record[key];

  if (value === undefined) return undefined;

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new BridgeRequestError(
      "BRIDGE_INVALID_REQUEST",
      `Argument "${key}" must be an array of strings`,
    );
  }

  return value as string[];
}

function optionalStringRecord(
  record: Record<string, unknown>,
  key: string,
): Readonly<Record<string, string>> | undefined {
  const value = record[key];

  if (value === undefined) return undefined;

  const entries = asRecord(value, `args.${key}`);
  const result: Record<string, string> = {};

  for (const [entryKey, entryValue] of Object.entries(entries)) {
    if (typeof entryValue !== "string") {
      throw new BridgeRequestError(
        "BRIDGE_INVALID_REQUEST",
        `Argument "${key}.${entryKey}" must be a string`,
      );
    }

    result[entryKey] = entryValue;
  }

  return result;
}

main().catch((error: unknown) => {
  writeResponse({ ok: false, error: describeError(error), events: [] });
});
