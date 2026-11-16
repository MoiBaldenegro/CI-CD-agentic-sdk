import { OpenCode } from "@opencode/sdk";
import type {
  AgentGateway,
  AgentPrompt,
  AgentResponse,
} from "../../core/domain/outbound/AgentGateway.port.js";
import type { AgentPrimitives } from "../../core/domain/Agent.entity.js";

export interface OpenCodeAgentAdapterOptions {
  readonly directory: string;
}

export class OpenCodeAgentAdapter implements AgentGateway {
  private readonly opencode: ReturnType<typeof OpenCode.create>;
  private readonly session: Promise<{ readonly id: string }>;

  constructor(private readonly options: OpenCodeAgentAdapterOptions) {
    this.opencode = OpenCode.create();
    this.session = this.opencode.then((client) =>
      client.sessions.create({
        location: { directory: this.options.directory },
      }),
    );
  }

  async sendPrompt(agent: AgentPrimitives, prompt: AgentPrompt): Promise<AgentResponse> {
    if (agent.provider !== "opencode") {
      throw new Error(`Unsupported agent provider: ${agent.provider}`);
    }

    const opencode = await this.opencode;
    const session = await this.session;

    await opencode.sessions.prompt({
      sessionID: session.id,
      text: prompt.text,
    });

    await opencode.sessions.wait({ sessionID: session.id });

    const messages = await opencode.message.list({
      sessionID: session.id,
    });

    const text = extractResponseText(messages);
    if (text.length === 0) {
      const providerError = extractProviderError(messages);
      if (providerError !== null) {
        throw new Error(`OpenCode no pudo completar la solicitud: ${providerError}`);
      }

      throw new Error(`OpenCode no devolvió texto para la sesión ${session.id}`);
    }

    return {
      sessionId: session.id,
      text,
    };
  }
}

function extractResponseText(value: unknown): string {
  const responses: string[][] = [];
  collectAssistantResponses(value, responses);
  return responses.at(-1)?.join("\n").trim() ?? "";
}

function collectAssistantResponses(value: unknown, responses: string[][]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectAssistantResponses(item, responses);
    }
    return;
  }

  if (!isRecord(value)) return;

  const info = isRecord(value.info) ? value.info : value;
  if (info.role === "assistant" || value.type === "assistant") {
    const texts: string[] = [];
    collectContent(value.parts ?? value.content, texts);

    if (texts.length > 0) {
      responses.push(texts);
    }
  }

  if ("data" in value) {
    collectAssistantResponses(value.data, responses);
  }
}

function extractProviderError(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const error = extractProviderError(item);
      if (error !== null) return error;
    }
    return null;
  }

  if (!isRecord(value)) return null;

  if (isRecord(value.error) && typeof value.error.message === "string") {
    return value.error.message;
  }

  if ("data" in value) {
    return extractProviderError(value.data);
  }

  return null;
}

function collectContent(value: unknown, texts: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectContent(item, texts);
    }
    return;
  }

  if (!isRecord(value)) return;

  if (value.type === "text" && typeof value.text === "string" && value.text.trim().length > 0) {
    texts.push(value.text);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
