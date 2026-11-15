import type { Task } from "../../domain/entities/Task.entity.js";
import type {
  AgentExecutionResult,
  AgentGateway,
} from "../../domain/outbound/AgentGateway.port.js";
import type { AgentRef } from "../../domain/value-objects/AgentRef.vo.js";

export interface InvokeAgentOptions {
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export class AgentInvocationService {
  private readonly gateway: AgentGateway;

  constructor(gateway: AgentGateway) {
    this.gateway = gateway;
  }

  async invoke(
    task: Task,
    agent: AgentRef,
    options: InvokeAgentOptions = {},
  ): Promise<AgentExecutionResult> {
    return this.gateway.execute({
      taskId: task.id.value,
      agent,
      instructions: this.renderInstructions(task),
      context: {
        repository: {
          owner: task.repository.owner,
          name: task.repository.name,
          baseBranch: task.repository.baseBranch,
        },
        acceptanceCriteria: [...task.acceptanceCriteria.items],
        metadata: { ...task.metadata.entries },
      },
      ...(options.timeoutMs !== undefined && { timeoutMs: options.timeoutMs }),
      ...(options.signal !== undefined && { signal: options.signal }),
    });
  }

  private renderInstructions(task: Task): string {
    const sections = [`# ${task.title.value}`, "", task.description.value];

    if (!task.acceptanceCriteria.isEmpty()) {
      sections.push(
        "",
        "## Acceptance criteria",
        ...task.acceptanceCriteria.items.map((item) => `- ${item}`),
      );
    }

    return sections.join("\n");
  }
}
