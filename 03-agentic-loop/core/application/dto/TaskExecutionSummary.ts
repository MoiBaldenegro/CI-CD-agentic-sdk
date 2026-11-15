import type { AgentOutcomeValue } from "../../domain/outbound/AgentGateway.port.js";
import type { TaskStatusValue } from "../../domain/value-objects/TaskStatus.vo.js";

export interface TaskExecutionSummary {
  readonly taskId: string;
  readonly outcome: AgentOutcomeValue;
  readonly status: TaskStatusValue;
}
