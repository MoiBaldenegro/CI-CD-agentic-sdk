import type { Task } from "../entities/Task.entity.js";
import { AGENT_OUTCOME } from "../outbound/AgentGateway.port.js";
import type { AgentExecutionResult } from "../outbound/AgentGateway.port.js";

export class TaskExecutionService {
  applyResult(task: Task, result: AgentExecutionResult): void {
    switch (result.outcome) {
      case AGENT_OUTCOME.SUCCESS:
        task.submitForReview(result.summary);
        return;
      case AGENT_OUTCOME.FAILURE:
        task.fail(result.summary);
        return;
      case AGENT_OUTCOME.BLOCKED:
        task.block(result.summary);
        return;
    }
  }
}
