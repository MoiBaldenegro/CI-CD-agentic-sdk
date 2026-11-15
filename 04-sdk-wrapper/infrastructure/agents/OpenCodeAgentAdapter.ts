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
  constructor(private readonly options: OpenCodeAgentAdapterOptions) {}

  async sendPrompt(agent: AgentPrimitives, prompt: AgentPrompt): Promise<AgentResponse> {
    if (agent.provider !== "opencode") {
      throw new Error(`Unsupported agent provider: ${agent.provider}`);
    }

    await using opencode = await OpenCode.create();
    const session = await opencode.sessions.create({
      location: { directory: this.options.directory },
    });

    await opencode.sessions.prompt({
      sessionID: session.id,
      text: prompt.text,
    });

    await opencode.sessions.wait({ sessionID: session.id });

    const messages = await opencode.message.list({
      sessionID: session.id,
    });

    return {
      sessionId: session.id,
      text: extractResponseText(messages),
    };
  }
}

function extractResponseText(value: unknown): string {
  const texts: string[] = [];
  collectAssistantText(value, texts);
  return texts.join("\n").trim();
}

function collectAssistantText(value: unknown, texts: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isRecord(item) && item.type === "assistant") {
        collectContent(item.content, texts);
      }
    }
  }
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
