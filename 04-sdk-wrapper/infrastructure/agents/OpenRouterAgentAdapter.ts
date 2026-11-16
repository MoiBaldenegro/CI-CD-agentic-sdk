import type {
  AgentGateway,
  AgentPrompt,
  AgentResponse,
} from "../../core/domain/outbound/AgentGateway.port.js";
import type { AgentPrimitives } from "../../core/domain/Agent.entity.js";

interface OpenRouterMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface OpenRouterAgentAdapterOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly siteUrl?: string;
  readonly appName?: string;
}

export class OpenRouterAgentAdapter implements AgentGateway {
  private readonly messages: OpenRouterMessage[] = [];

  constructor(private readonly options: OpenRouterAgentAdapterOptions) {
    if (options.apiKey.trim().length === 0) {
      throw new Error("OpenRouter API key must not be empty");
    }

    if (options.model.trim().length === 0) {
      throw new Error("OpenRouter model must not be empty");
    }
  }

  async sendPrompt(agent: AgentPrimitives, prompt: AgentPrompt): Promise<AgentResponse> {
    if (agent.provider !== "openrouter") {
      throw new Error(`Unsupported agent provider: ${agent.provider}`);
    }

    this.messages.push({ role: "user", content: prompt.text });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
        ...(this.options.siteUrl !== undefined && {
          "HTTP-Referer": this.options.siteUrl,
        }),
        ...(this.options.appName !== undefined && {
          "X-Title": this.options.appName,
        }),
      },
      body: JSON.stringify({
        model: agent.model ?? this.options.model,
        messages: this.messages,
      }),
    });

    const body: unknown = await response.json();
    if (!response.ok) {
      throw new Error(`OpenRouter request failed (${response.status}): ${extractError(body)}`);
    }

    const text = extractResponseText(body);
    if (text.length === 0) {
      throw new Error("OpenRouter returned an empty response");
    }

    this.messages.push({ role: "assistant", content: text });

    return {
      sessionId: extractResponseId(body),
      text,
    };
  }
}

function extractResponseText(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.choices)) return "";

  const choice = value.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) return "";

  const content = choice.message.content;
  return typeof content === "string" ? content.trim() : "";
}

function extractResponseId(value: unknown): string | null {
  return isRecord(value) && typeof value.id === "string" ? value.id : null;
}

function extractError(value: unknown): string {
  if (isRecord(value) && isRecord(value.error) && typeof value.error.message === "string") {
    return value.error.message;
  }

  return "Unknown OpenRouter error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
