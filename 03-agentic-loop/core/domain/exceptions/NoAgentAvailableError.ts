import { DomainException } from "../../../shared/DomainException.js";

export class NoAgentAvailableError extends DomainException {
  readonly statusCode = 503;
  readonly taskId: string;
  readonly capabilities: readonly string[];

  constructor(taskId: string, capabilities: readonly string[]) {
    super("NO_AGENT_AVAILABLE", `No agent available for task ${taskId}`, {
      taskId,
      capabilities: [...capabilities],
    });
    this.taskId = taskId;
    this.capabilities = Object.freeze([...capabilities]);
  }
}
