import { TaskTerminalStateError } from "../exceptions/TaskTerminalStateError.js";
import { NoAgentAvailableError } from "../exceptions/NoAgentAvailableError.js";
import type { Task } from "../entities/Task.entity.js";
import type {
  AgentDescriptor,
  AgentRegistry,
  AgentRequirements,
} from "../outbound/AgentRegistry.port.js";

export interface AssignTaskOptions {
  readonly capabilities?: readonly string[];
  readonly preferredProvider?: string;
  readonly excludedProviders?: readonly string[];
}

export class TaskAssignmentService {
  private readonly registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  async assign(task: Task, options: AssignTaskOptions = {}): Promise<AgentDescriptor> {
    if (task.isTerminal()) {
      throw new TaskTerminalStateError(task.id.value, task.status.value);
    }

    const requirements: AgentRequirements = {
      taskId: task.id.value,
      ...(options.capabilities !== undefined && { capabilities: options.capabilities }),
      ...(options.preferredProvider !== undefined && {
        preferredProvider: options.preferredProvider,
      }),
      ...(options.excludedProviders !== undefined && {
        excludedProviders: options.excludedProviders,
      }),
    };

    const descriptor = await this.registry.resolve(requirements);

    if (descriptor === null) {
      throw new NoAgentAvailableError(task.id.value, options.capabilities ?? []);
    }

    task.assign(descriptor.agent);
    return descriptor;
  }
}
