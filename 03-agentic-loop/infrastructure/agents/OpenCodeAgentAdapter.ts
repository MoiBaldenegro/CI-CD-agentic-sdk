import { stat } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { createOpencode, createOpencodeClient } from "@opencode-ai/sdk";
import type { AssistantMessage, Config, OpencodeClient, Part } from "@opencode-ai/sdk";
import {
  AGENT_ARTIFACT_KIND,
  AGENT_OUTCOME,
} from "../../core/domain/outbound/AgentGateway.port.js";
import type {
  AgentArtifact,
  AgentExecutionRequest,
  AgentExecutionResult,
  AgentUsage,
} from "../../core/domain/outbound/AgentGateway.port.js";
import type { AgentAdapter } from "./AgentGatewayRouter.js";

const DEFAULT_PROVIDER = "opencode";
const DEFAULT_MODEL_PROVIDER = "opencode";
const DEFAULT_OPENCODE_AGENT = "build";
const DEFAULT_TIMEOUT_MS = 15 * 60_000;
const DEFAULT_SERVER_TIMEOUT_MS = 10_000;
const MAX_SUMMARY_LENGTH = 1_900;

const SYSTEM_PROMPT = [
  "You are an autonomous software engineering agent.",
  "Work only inside the provided workspace directory.",
  "Implement the requested task, run the relevant checks, and finish with a concise summary of changes and verification.",
  "Do not create git commits, push branches, or open pull requests unless the task explicitly asks for it.",
].join(" ");

export interface OpenCodeAgentAdapterOptions {
  readonly provider?: string;
  readonly modelProvider?: string;
  readonly workspace?: string;
  readonly baseUrl?: string | undefined;
  readonly hostname?: string;
  readonly port?: number;
  readonly agent?: string;
  readonly timeoutMs?: number;
  readonly serverTimeoutMs?: number;
  readonly allowWebFetch?: boolean;
}

export class OpenCodeAgentAdapter implements AgentAdapter {
  readonly provider: string;
  private readonly modelProvider: string;
  private readonly workspace: string;
  private readonly baseUrl: string | undefined;
  private readonly hostname: string;
  private readonly port: number | undefined;
  private readonly agent: string;
  private readonly timeoutMs: number;
  private readonly serverTimeoutMs: number;
  private readonly allowWebFetch: boolean;

  constructor(options: OpenCodeAgentAdapterOptions = {}) {
    this.provider = (options.provider ?? DEFAULT_PROVIDER).trim().toLowerCase();
    this.modelProvider = (
      options.modelProvider ??
      process.env.AGENTIC_LOOP_OPENCODE_PROVIDER ??
      DEFAULT_MODEL_PROVIDER
    )
      .trim()
      .toLowerCase();
    this.workspace = resolve(
      options.workspace ?? process.env.AGENTIC_LOOP_WORKSPACE ?? process.cwd(),
    );
    this.baseUrl = options.baseUrl ?? process.env.AGENTIC_LOOP_OPENCODE_URL;
    this.hostname = options.hostname ?? "127.0.0.1";
    this.port = options.port;
    this.agent = options.agent ?? process.env.AGENTIC_LOOP_OPENCODE_AGENT ?? DEFAULT_OPENCODE_AGENT;
    this.timeoutMs = options.timeoutMs ?? requestTimeoutFromEnvironment() ?? DEFAULT_TIMEOUT_MS;
    this.serverTimeoutMs =
      options.serverTimeoutMs ??
      numberFromEnvironment("AGENTIC_LOOP_OPENCODE_STARTUP_TIMEOUT_MS") ??
      DEFAULT_SERVER_TIMEOUT_MS;
    this.allowWebFetch =
      options.allowWebFetch ?? process.env.AGENTIC_LOOP_OPENCODE_WEBFETCH === "1";
  }

  async execute(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    let client: OpencodeClient | undefined;
    let server: { close(): void } | undefined;
    let sessionId: string | undefined;
    let workspace = "";
    let timedOut = false;
    let cancelled = request.signal?.aborted === true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const abortSession = (): void => {
      if (client === undefined || sessionId === undefined) return;

      void client.session
        .abort({ path: { id: sessionId }, query: { directory: workspace } })
        .catch(() => undefined);
    };

    const onExternalAbort = (): void => {
      cancelled = true;
      controller.abort();
      abortSession();
    };

    try {
      workspace = await resolveWorkspace(request, this.workspace);
      const model = resolveModel(request, this.modelProvider);
      const agentName = request.context.metadata.opencodeAgent ?? this.agent;
      const timeoutMs = request.timeoutMs ?? this.timeoutMs;

      if (request.signal !== undefined) {
        request.signal.addEventListener("abort", onExternalAbort, { once: true });
        if (request.signal.aborted) onExternalAbort();
      }

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
          abortSession();
        }, timeoutMs);
      }

      if (this.baseUrl !== undefined) {
        client = createOpencodeClient({ baseUrl: this.baseUrl });
      } else {
        const port = this.port ?? (await findAvailablePort(this.hostname));
        const started = await createOpencode({
          hostname: this.hostname,
          port,
          timeout: this.serverTimeoutMs,
          signal: controller.signal,
          config: this.serverConfig(),
        });

        client = started.client;
        server = started.server;
      }

      const sessionResult = await client.session.create({
        body: { title: `agentic-loop/${request.taskId}` },
        query: { directory: workspace },
        signal: controller.signal,
        throwOnError: true,
      });
      const session = sessionResult.data;
      sessionId = session.id;

      const promptResult = await client.session.prompt({
        path: { id: session.id },
        query: { directory: workspace },
        signal: controller.signal,
        throwOnError: true,
        body: {
          ...(model !== null && { model }),
          agent: agentName,
          system: SYSTEM_PROMPT,
          parts: [{ type: "text", text: renderTaskPrompt(request, workspace) }],
        },
      });
      const response = promptResult.data;

      const usage = mapUsage(response.info);
      const artifacts = collectArtifacts(response.parts);
      const raw = {
        provider: this.provider,
        sessionId: session.id,
        messageId: response.info.id,
        directory: workspace,
        model,
        agent: agentName,
        finish: response.info.finish ?? null,
        error: response.info.error ?? null,
        parts: response.parts.map(summarizePart),
      };

      if (timedOut) {
        return failure(
          `OpenCode timed out after ${timeoutMs}ms for task ${request.taskId}`,
          raw,
          usage,
        );
      }

      if (cancelled) {
        return blocked(`OpenCode execution cancelled for task ${request.taskId}`, raw);
      }

      if (response.info.error !== undefined) {
        return failure(
          `OpenCode failed for task ${request.taskId}: ${describeAssistantError(response.info.error)}`,
          raw,
          usage,
        );
      }

      return {
        outcome: AGENT_OUTCOME.SUCCESS,
        summary: summarizeResponse(response.parts, request.taskId),
        artifacts,
        usage,
        raw,
      };
    } catch (error) {
      const message = errorMessage(error);
      const raw = {
        provider: this.provider,
        taskId: request.taskId,
        sessionId: sessionId ?? null,
        directory: workspace.length > 0 ? workspace : null,
        timedOut,
        cancelled,
        error: message,
      };

      if (timedOut) {
        return failure(
          `OpenCode timed out after ${request.timeoutMs ?? this.timeoutMs}ms for task ${request.taskId}`,
          raw,
          null,
        );
      }

      if (cancelled) {
        return blocked(`OpenCode execution cancelled for task ${request.taskId}`, raw);
      }

      return failure(
        `OpenCode execution failed for task ${request.taskId}: ${message}`,
        raw,
        null,
      );
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (request.signal !== undefined) {
        request.signal.removeEventListener("abort", onExternalAbort);
      }
      server?.close();
    }
  }

  private serverConfig(): Config {
    return {
      share: "disabled",
      autoupdate: false,
      permission: {
        edit: "allow",
        bash: "allow",
        webfetch: this.allowWebFetch ? "allow" : "deny",
        doom_loop: "deny",
        external_directory: "deny",
      },
    };
  }
}

async function resolveWorkspace(
  request: AgentExecutionRequest,
  fallback: string,
): Promise<string> {
  const configured =
    firstNonEmpty(
      request.context.metadata.workspace,
      request.context.metadata.workspacePath,
      request.context.metadata.directory,
    ) ?? fallback;
  const absolute = resolve(configured);
  const info = await stat(absolute);

  if (!info.isDirectory()) {
    throw new Error(`Workspace is not a directory: ${absolute}`);
  }

  return absolute;
}

function resolveModel(
  request: AgentExecutionRequest,
  defaultProviderId: string,
): { providerID: string; modelID: string } | null {
  const model = request.agent.model?.trim();

  if (model === undefined || model.length === 0) return null;

  const separator = model.indexOf("/");

  if (separator > 0 && separator < model.length - 1) {
    return {
      providerID: model.slice(0, separator),
      modelID: model.slice(separator + 1),
    };
  }

  return { providerID: defaultProviderId, modelID: model };
}

function renderTaskPrompt(request: AgentExecutionRequest, workspace: string): string {
  const repository = request.context.repository;

  return [
    request.instructions,
    "",
    "## Execution context",
    `- Task id: ${request.taskId}`,
    `- Repository: ${repository.owner}/${repository.name}`,
    `- Base branch: ${repository.baseBranch}`,
    `- Workspace: ${workspace}`,
    "",
    "Implement the task in the workspace. Run the relevant checks before finishing.",
  ].join("\n");
}

function collectArtifacts(parts: readonly Part[]): readonly AgentArtifact[] {
  const artifacts = new Map<string, AgentArtifact>();

  for (const part of parts) {
    if (part.type !== "patch" || artifacts.has(part.hash)) continue;

    artifacts.set(part.hash, {
      kind: AGENT_ARTIFACT_KIND.PATCH,
      uri: `patch://${part.sessionID}/${part.hash}`,
      description:
        part.files.length === 0
          ? "OpenCode patch"
          : `Changed files: ${part.files.slice(0, 10).join(", ")}`,
    });
  }

  return [...artifacts.values()];
}

function mapUsage(info: AssistantMessage): AgentUsage {
  return {
    inputTokens: info.tokens.input,
    outputTokens: info.tokens.output,
    costUsd: info.cost,
  };
}

function summarizeResponse(parts: readonly Part[], taskId: string): string {
  const sections: string[] = [];

  for (const part of parts) {
    if (part.type !== "text" || part.synthetic === true || part.ignored === true) continue;

    const text = part.text.trim();
    if (text.length > 0) sections.push(text);
  }

  return truncate(
    sections.length > 0 ? sections.join("\n\n") : `OpenCode completed task ${taskId}`,
    MAX_SUMMARY_LENGTH,
  );
}

function summarizePart(part: Part): Record<string, unknown> {
  if (part.type === "text") {
    return { type: part.type, text: part.text };
  }

  if (part.type === "tool") {
    return {
      type: part.type,
      tool: part.tool,
      status: part.state.status,
      title: part.state.status === "completed" ? part.state.title : null,
    };
  }

  if (part.type === "patch") {
    return { type: part.type, hash: part.hash, files: part.files };
  }

  return { type: part.type };
}

function describeAssistantError(error: NonNullable<AssistantMessage["error"]>): string {
  if ("message" in error.data && typeof error.data.message === "string") {
    return `${error.name}: ${error.data.message}`;
  }

  return error.name;
}

function failure(
  summary: string,
  raw: unknown,
  usage: AgentUsage | null,
): AgentExecutionResult {
  return {
    outcome: AGENT_OUTCOME.FAILURE,
    summary: truncate(summary, MAX_SUMMARY_LENGTH),
    artifacts: [],
    usage,
    raw,
  };
}

function blocked(summary: string, raw: unknown): AgentExecutionResult {
  return {
    outcome: AGENT_OUTCOME.BLOCKED,
    summary: truncate(summary, MAX_SUMMARY_LENGTH),
    artifacts: [],
    usage: null,
    raw,
  };
}

function truncate(value: string, maxLength: number): string {
  const normalized = value.trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 3)}...`;
}

function firstNonEmpty(...values: readonly (string | undefined)[]): string | undefined {
  for (const value of values) {
    if (value !== undefined && value.trim().length > 0) return value.trim();
  }

  return undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function findAvailablePort(hostname: string): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, hostname, () => {
      const address = server.address();

      if (typeof address !== "object" || address === null) {
        server.close();
        reject(new Error("Could not determine an available port for OpenCode"));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error !== undefined) {
          reject(error);
          return;
        }

        resolvePort(port);
      });
    });
  });
}

function requestTimeoutFromEnvironment(): number | undefined {
  return numberFromEnvironment("AGENTIC_LOOP_OPENCODE_TIMEOUT_MS");
}

function numberFromEnvironment(name: string): number | undefined {
  const raw = process.env[name];

  if (raw === undefined || raw.trim().length === 0) return undefined;

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
