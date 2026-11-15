import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { AgentRef } from "../../core/domain/value-objects/AgentRef.vo.js";
import type {
  AgentDescriptor,
  AgentRegistry,
  AgentRequirements,
} from "../../core/domain/outbound/AgentRegistry.port.js";
import { DomainValidationError } from "../../shared/DomainValidationError.js";

export interface AgentDescriptorPrimitives {
  provider: string;
  agentId: string;
  model: string | null;
  label: string;
  capabilities: string[];
  metadata: Record<string, string>;
}

export interface AddAgentInput {
  readonly provider: string;
  readonly agentId: string;
  readonly model?: string | null;
  readonly label?: string | null;
  readonly capabilities?: readonly string[];
  readonly metadata?: Readonly<Record<string, string>>;
}

export class FileAgentRegistry implements AgentRegistry {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  get path(): string {
    return this.filePath;
  }

  async list(): Promise<readonly AgentDescriptor[]> {
    const primitives = await this.loadAll();
    return primitives.map(toDescriptor);
  }

  async resolve(requirements: AgentRequirements): Promise<AgentDescriptor | null> {
    const agents = await this.list();
    const excluded = new Set(requirements.excludedProviders ?? []);
    const capabilities = requirements.capabilities ?? [];

    const candidates = agents.filter(
      (descriptor) =>
        !excluded.has(descriptor.agent.provider) &&
        capabilities.every((capability) => descriptor.capabilities.includes(capability)),
    );

    if (requirements.preferredProvider !== undefined) {
      const preferred = candidates.find(
        (descriptor) => descriptor.agent.provider === requirements.preferredProvider,
      );

      if (preferred !== undefined) return preferred;
    }

    return candidates[0] ?? null;
  }

  async add(input: AddAgentInput): Promise<AgentDescriptor> {
    const agent = AgentRef.from(input.provider, input.agentId, input.model ?? null);
    const primitives = await this.loadAll();

    if (
      primitives.some(
        (descriptor) =>
          descriptor.provider === agent.provider && descriptor.agentId === agent.agentId,
      )
    ) {
      throw new DomainValidationError(
        "AGENT_ALREADY_REGISTERED",
        `Agent ${agent.toString()} is already registered`,
        { provider: agent.provider, agentId: agent.agentId },
      );
    }

    const descriptor: AgentDescriptor = {
      agent,
      label: normalizeLabel(input.label, agent),
      capabilities: normalizeCapabilities(input.capabilities),
      metadata: normalizeMetadata(input.metadata),
    };

    primitives.push(toPrimitives(descriptor));
    await this.writeAll(primitives);

    return descriptor;
  }

  async remove(provider: string, agentId: string): Promise<boolean> {
    const normalizedProvider = provider.trim().toLowerCase();
    const normalizedAgentId = agentId.trim();
    const primitives = await this.loadAll();
    const remaining = primitives.filter(
      (descriptor) =>
        descriptor.provider !== normalizedProvider || descriptor.agentId !== normalizedAgentId,
    );

    if (remaining.length === primitives.length) return false;

    await this.writeAll(remaining);
    return true;
  }

  private async loadAll(): Promise<AgentDescriptorPrimitives[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;

      if (!Array.isArray(parsed)) {
        throw new Error(`Agent store ${this.filePath} must contain a JSON array`);
      }

      return parsed.map((value, index) => parsePrimitives(value, index));
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  private async writeAll(agents: readonly AgentDescriptorPrimitives[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });

    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(agents, null, 2), "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

export function toPrimitives(descriptor: AgentDescriptor): AgentDescriptorPrimitives {
  return {
    provider: descriptor.agent.provider,
    agentId: descriptor.agent.agentId,
    model: descriptor.agent.model,
    label: descriptor.label,
    capabilities: [...descriptor.capabilities],
    metadata: { ...descriptor.metadata },
  };
}

function toDescriptor(primitives: AgentDescriptorPrimitives): AgentDescriptor {
  return {
    agent: AgentRef.from(primitives.provider, primitives.agentId, primitives.model),
    label: primitives.label,
    capabilities: [...primitives.capabilities],
    metadata: { ...primitives.metadata },
  };
}

function parsePrimitives(value: unknown, index: number): AgentDescriptorPrimitives {
  const record = asRecord(value, `agent[${index}]`);

  return {
    provider: requireString(record, "provider", `agent[${index}]`),
    agentId: requireString(record, "agentId", `agent[${index}]`),
    model: optionalModel(record.model, index),
    label: requireString(record, "label", `agent[${index}]`),
    capabilities: stringArray(record.capabilities, index),
    metadata: stringRecord(record.metadata, index),
  };
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  context: string,
): string {
  const value = record[key];

  if (typeof value !== "string") {
    throw new Error(`${context}.${key} must be a string`);
  }

  return value;
}

function optionalModel(value: unknown, index: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error(`agent[${index}].model must be a string or null`);
  }

  return value;
}

function stringArray(value: unknown, index: number): string[] {
  if (value === undefined) return [];

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`agent[${index}].capabilities must be an array of strings`);
  }

  return [...value];
}

function stringRecord(value: unknown, index: number): Record<string, string> {
  if (value === undefined) return {};

  const record = asRecord(value, `agent[${index}].metadata`);
  const result: Record<string, string> = {};

  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry !== "string") {
      throw new Error(`agent[${index}].metadata.${key} must be a string`);
    }

    result[key] = entry;
  }

  return result;
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }

  return value as Record<string, unknown>;
}

function normalizeLabel(label: string | null | undefined, agent: AgentRef): string {
  const normalized = (label ?? agent.toString()).trim();

  if (normalized.length === 0 || normalized.length > 120) {
    throw new DomainValidationError(
      "AGENT_LABEL_INVALID",
      "Agent label must contain between 1 and 120 characters",
      { label },
    );
  }

  return normalized;
}

function normalizeCapabilities(capabilities: readonly string[] | undefined): string[] {
  const result: string[] = [];

  for (const capability of capabilities ?? []) {
    const normalized = capability.trim();

    if (normalized.length > 0 && !result.includes(normalized)) {
      result.push(normalized);
    }
  }

  return result;
}

function normalizeMetadata(
  metadata: Readonly<Record<string, string>> | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(metadata ?? {})) {
    const normalizedKey = key.trim();

    if (normalizedKey.length > 0) {
      result[normalizedKey] = value;
    }
  }

  return result;
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
