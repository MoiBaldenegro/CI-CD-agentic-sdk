import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { AgenticLoopApplication } from "../../core/application/index.js";
import type { SubmitTaskCommand } from "../../core/application/index.js";
import type { AgentDescriptor } from "../../core/domain/outbound/AgentRegistry.port.js";
import { AGENT_OUTCOME } from "../../core/domain/outbound/AgentGateway.port.js";
import type { AgentOutcomeValue } from "../../core/domain/outbound/AgentGateway.port.js";
import { AgentRef } from "../../core/domain/value-objects/AgentRef.vo.js";
import { DomainException } from "../../shared/DomainException.js";
import { AgentGatewayRouter } from "../agents/AgentGatewayRouter.js";
import { OpenCodeAgentAdapter } from "../agents/OpenCodeAgentAdapter.js";
import { SimulatedAgentAdapter } from "../agents/SimulatedAgentAdapter.js";
import { StaticAgentRegistry } from "../agents/StaticAgentRegistry.js";
import { ConsoleEventPublisher } from "../events/ConsoleEventPublisher.js";
import { FileTaskRepository } from "../persistence/FileTaskRepository.js";
import { NoopUnitOfWork } from "../persistence/NoopUnitOfWork.js";

const DEFAULT_STORE = ".agentic-loop/tasks.json";
const DEMO_STORE = ".agentic-loop/demo.json";

const CLI_OPTIONS = {
  help: { type: "boolean", short: "h" },
  store: { type: "string" },
  title: { type: "string", short: "t" },
  description: { type: "string", short: "d" },
  source: { type: "string", short: "s" },
  "external-id": { type: "string" },
  url: { type: "string" },
  repo: { type: "string", short: "r" },
  branch: { type: "string" },
  priority: { type: "string", short: "p" },
  criterion: { type: "string", multiple: true },
  meta: { type: "string", multiple: true },
  provider: { type: "string" },
  "agent-id": { type: "string" },
  model: { type: "string" },
  capabilities: { type: "string" },
  outcome: { type: "string" },
  workspace: { type: "string" },
  timeout: { type: "string" },
  max: { type: "string" },
  reason: { type: "string" },
  "stop-on-error": { type: "boolean" },
} as const;

type CliValues = ReturnType<typeof parseCliArguments>["values"];

function parseCliArguments() {
  return parseArgs({
    args: process.argv.slice(2),
    options: CLI_OPTIONS,
    allowPositionals: true,
  });
}

async function main(): Promise<void> {
  const { values, positionals } = parseCliArguments();
  const command = positionals[0] ?? "help";

  if (values.help === true || command === "help") {
    printHelp();
    return;
  }

  const path = resolve(process.cwd(), values.store ?? (command === "demo" ? DEMO_STORE : DEFAULT_STORE));

  if (command === "reset") {
    await rm(path, { force: true });
    console.log(`Store cleared: ${path}`);
    return;
  }

  if (command === "demo") {
    await rm(path, { force: true });
  }

  const repository = new FileTaskRepository(path);
  const registry = new StaticAgentRegistry(defaultAgents());
  const gateway = new AgentGatewayRouter();
  const outcome = parseOutcome(values.outcome);
  const simulate = command === "demo" || process.env.AGENTIC_LOOP_SIMULATE === "1";

  gateway.register(
    simulate
      ? new SimulatedAgentAdapter("opencode", outcome)
      : new OpenCodeAgentAdapter({
          provider: "opencode",
          ...(values.workspace !== undefined && { workspace: values.workspace }),
        }),
  );
  gateway.register(new SimulatedAgentAdapter("claude", outcome));

  const app = new AgenticLoopApplication({
    taskRepository: repository,
    agentRegistry: registry,
    agentGateway: gateway,
    eventPublisher: new ConsoleEventPublisher(),
    unitOfWork: new NoopUnitOfWork(),
  });

  switch (command) {
    case "submit":
      await handleSubmit(app, values);
      return;
    case "list":
      console.log(JSON.stringify(await app.listTasks(numberOption(values.max, 100)), null, 2));
      return;
    case "get":
      console.log(JSON.stringify(await app.getTask(taskIdAt(positionals, command)), null, 2));
      return;
    case "execute":
      console.log(
        JSON.stringify(await handleExecute(app, positionals, values), null, 2),
      );
      return;
    case "run":
      console.log(JSON.stringify(await handleRun(app, values), null, 2));
      return;
    case "cancel":
      console.log(
        JSON.stringify(
          await app.cancelTask(
            taskIdAt(positionals, command),
            values.reason ?? "Cancelled from CLI",
          ),
          null,
          2,
        ),
      );
      return;
    case "agents":
      await printAgents(registry, gateway);
      return;
    case "demo":
      await runDemo(app);
      return;
    default:
      printHelp();
      process.exitCode = 1;
  }
}

async function handleSubmit(app: AgenticLoopApplication, values: CliValues): Promise<void> {
  if (values.title === undefined || values.description === undefined) {
    throw new Error("Missing --title and --description");
  }

  const sourceRef =
    values["external-id"] === undefined
      ? undefined
      : { externalId: values["external-id"], url: values.url ?? null };
  const metadata = parseMetadata(values.meta);
  const assignee =
    values.provider === undefined
      ? undefined
      : {
          provider: values.provider,
          agentId: values["agent-id"] ?? "cli-agent",
          model: values.model ?? null,
        };

  const command: SubmitTaskCommand = {
    title: values.title,
    description: values.description,
    source: values.source ?? "MANUAL",
    repository: parseRepository(values.repo, values.branch),
    ...(sourceRef !== undefined && { sourceRef }),
    ...(values.priority !== undefined && { priority: values.priority }),
    ...(values.criterion !== undefined && { acceptanceCriteria: values.criterion }),
    ...(metadata !== undefined && { metadata }),
    ...(assignee !== undefined && { assignee }),
  };

  const result = await app.submitTask(command);

  console.log(
    JSON.stringify({ taskId: result.taskId.value, version: result.version }, null, 2),
  );
}

async function handleExecute(
  app: AgenticLoopApplication,
  positionals: readonly string[],
  values: CliValues,
) {
  const capabilities = parseCapabilities(values.capabilities);

  return app.executeTask(taskIdAt(positionals, "execute"), {
    ...(capabilities !== undefined && { capabilities }),
    ...(values.provider !== undefined && { preferredProvider: values.provider }),
    ...(values.timeout !== undefined && { timeoutMs: numberOption(values.timeout) }),
  });
}

async function handleRun(app: AgenticLoopApplication, values: CliValues) {
  const capabilities = parseCapabilities(values.capabilities);

  return app.run({
    ...(values.max !== undefined && { maxTasks: numberOption(values.max) }),
    ...(capabilities !== undefined && { capabilities }),
    ...(values.provider !== undefined && { preferredProvider: values.provider }),
    ...(values.timeout !== undefined && { timeoutMs: numberOption(values.timeout) }),
    ...(values["stop-on-error"] === true && { stopOnError: true }),
  });
}

async function runDemo(app: AgenticLoopApplication): Promise<void> {
  const issueCommand: SubmitTaskCommand = {
    title: "Demo: implement /health endpoint",
    description: "Add a GET /health endpoint returning service status.",
    source: "GITHUB_ISSUE",
    sourceRef: { externalId: "101", url: "https://github.com/acme/app/issues/101" },
    repository: { owner: "acme", name: "app", baseBranch: "main" },
    priority: "HIGH",
    acceptanceCriteria: ["Returns HTTP 200", "Includes uptime in the payload"],
    metadata: { issue: "101", team: "platform" },
  };

  section("1. Submit a GitHub issue");
  const issue = await app.submitTask(issueCommand);
  console.log(JSON.stringify(issue, null, 2));

  section("2. Submit a manual low priority task");
  const manual = await app.submitTask({
    title: "Demo: update README",
    description: "Document the new health endpoint.",
    source: "MANUAL",
    repository: { owner: "acme", name: "app", baseBranch: "main" },
    priority: "LOW",
  });
  console.log(JSON.stringify(manual, null, 2));

  section("3. List tasks");
  console.log(JSON.stringify(await app.listTasks(), null, 2));

  section("4. Duplicate issue is rejected");
  try {
    await app.submitTask(issueCommand);
  } catch (error) {
    printError(error);
  }

  section("5. Execute the issue task");
  console.log(
    JSON.stringify(
      await app.executeTask(issue.taskId.value, { capabilities: ["typescript"] }),
      null,
      2,
    ),
  );

  section("6. Run the loop for the remaining tasks");
  console.log(JSON.stringify(await app.run({ maxTasks: 5 }), null, 2));

  section("7. Cancel the issue task");
  console.log(
    JSON.stringify(await app.cancelTask(issue.taskId.value, "Demo finished"), null, 2),
  );

  section("8. Final state");
  console.log(JSON.stringify(await app.listTasks(), null, 2));
}

async function printAgents(
  registry: StaticAgentRegistry,
  gateway: AgentGatewayRouter,
): Promise<void> {
  const agents = await registry.list();

  console.log(
    JSON.stringify(
      {
        candidates: agents.map((descriptor) => ({
          provider: descriptor.agent.provider,
          agentId: descriptor.agent.agentId,
          model: descriptor.agent.model,
          label: descriptor.label,
          capabilities: descriptor.capabilities,
          metadata: descriptor.metadata,
        })),
        executionAdapters: gateway.registeredProviders(),
      },
      null,
      2,
    ),
  );
}

function defaultAgents(): readonly AgentDescriptor[] {
  return [
    {
      agent: AgentRef.from("opencode", "builder-01", "deepseek-v4.1-flash-free"),
      label: "OpenCode Builder",
      capabilities: ["typescript", "backend", "tests"],
      metadata: { role: "implementer" },
    },
    {
      agent: AgentRef.from("claude", "reviewer-01", "claude-sonnet-4-5"),
      label: "Claude Reviewer",
      capabilities: ["typescript", "review"],
      metadata: { role: "reviewer" },
    },
  ];
}

function parseOutcome(value: string | undefined): AgentOutcomeValue {
  const normalized = (value ?? AGENT_OUTCOME.SUCCESS).toUpperCase();

  if (normalized === AGENT_OUTCOME.SUCCESS) return AGENT_OUTCOME.SUCCESS;
  if (normalized === AGENT_OUTCOME.FAILURE) return AGENT_OUTCOME.FAILURE;
  if (normalized === AGENT_OUTCOME.BLOCKED) return AGENT_OUTCOME.BLOCKED;

  throw new Error(`Invalid outcome "${value}". Use SUCCESS, FAILURE or BLOCKED.`);
}

function parseCapabilities(value: string | undefined): readonly string[] | undefined {
  if (value === undefined) return undefined;

  const capabilities = value
    .split(",")
    .map((capability) => capability.trim())
    .filter((capability) => capability.length > 0);

  return capabilities.length > 0 ? capabilities : undefined;
}

function parseMetadata(entries: readonly string[] | undefined): Record<string, string> | undefined {
  if (entries === undefined || entries.length === 0) return undefined;

  const metadata: Record<string, string> = {};

  for (const entry of entries) {
    const separator = entry.indexOf("=");

    if (separator <= 0) {
      throw new Error(`Invalid --meta "${entry}". Use key=value.`);
    }

    metadata[entry.slice(0, separator)] = entry.slice(separator + 1);
  }

  return metadata;
}

function parseRepository(
  value: string | undefined,
  branch: string | undefined,
): { owner: string; name: string; baseBranch: string } {
  const fullName = value ?? "acme/app";
  const separator = fullName.indexOf("/");

  if (separator <= 0 || separator === fullName.length - 1) {
    throw new Error(`Invalid --repo "${fullName}". Use owner/name.`);
  }

  return {
    owner: fullName.slice(0, separator),
    name: fullName.slice(separator + 1),
    baseBranch: branch ?? "main",
  };
}

function taskIdAt(positionals: readonly string[], command: string): string {
  const taskId = positionals[1];

  if (taskId === undefined) {
    throw new Error(`Missing task id. Usage: pnpm cli ${command} <taskId>`);
  }

  return taskId;
}

function numberOption(value: string | undefined, fallback?: number): number {
  if (value === undefined) {
    if (fallback === undefined) {
      throw new Error("Missing numeric value");
    }

    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number "${value}"`);
  }

  return parsed;
}

function printError(error: unknown): void {
  if (error instanceof DomainException) {
    console.error(`[domain-error] ${error.code}: ${error.message}`);
    console.error(JSON.stringify(error.toProblemDetails(), null, 2));
    return;
  }

  console.error(error instanceof Error ? error.message : String(error));
}

function section(title: string): void {
  console.log(`\n== ${title} ==`);
}

function printHelp(): void {
  console.log(`Agentic Loop CLI

Usage:
  pnpm cli <command> [options]

Commands:
  submit --title <text> --description <text> [options]   Create a task
  list [--max 100]                                       List tasks
  get <taskId>                                           Show a task
  execute <taskId> [options]                             Execute one task with an agent
  run [--max 5] [options]                                Process the queue
  cancel <taskId> [--reason <text>]                      Cancel a task
  agents                                                 List candidate agents and execution adapters
  demo                                                   Run the full flow end to end
  reset                                                  Delete the local store
  help                                                   Show this help

Task options:
  --source <MANUAL|CLI|API|WEBHOOK|GITHUB_ISSUE|GITLAB_ISSUE|JIRA_ISSUE|SLACK>
  --external-id <id> --url <url>      External reference (required for issue sources)
  --repo <owner/name> [--branch main]
  --priority <LOW|MEDIUM|HIGH|CRITICAL>
  --criterion <text>                  Repeatable acceptance criterion
  --meta <key=value>                  Repeatable metadata entry
  --provider <slug> --agent-id <id> --model <model>   Preassign an agent

Execution options:
  --capabilities <a,b,c>              Required agent capabilities
  --provider <slug>                   Preferred agent provider
  --timeout <ms>
  --workspace <path>                  Repository checkout for OpenCode
  --outcome <SUCCESS|FAILURE|BLOCKED> Simulated agent result
  --stop-on-error                     Stop the loop on the first failure

OpenCode environment:
  AGENTIC_LOOP_WORKSPACE              Default workspace (default: current directory)
  AGENTIC_LOOP_OPENCODE_URL           Connect to an existing OpenCode server
  AGENTIC_LOOP_OPENCODE_AGENT         OpenCode agent name (default: build)
  AGENTIC_LOOP_OPENCODE_PROVIDER      Provider for bare model ids (default: opencode)
  AGENTIC_LOOP_OPENCODE_TIMEOUT_MS    Execution timeout (default: 900000)
  AGENTIC_LOOP_OPENCODE_STARTUP_TIMEOUT_MS  Server startup timeout (default: 10000)
  AGENTIC_LOOP_OPENCODE_WEBFETCH=1    Allow webfetch (default: denied)
  AGENTIC_LOOP_SIMULATE=1             Use simulated adapters instead

Global options:
  --store <path>                      Default: ${DEFAULT_STORE}
  -h, --help`);
}

main().catch((error: unknown) => {
  printError(error);
  process.exitCode = 1;
});
