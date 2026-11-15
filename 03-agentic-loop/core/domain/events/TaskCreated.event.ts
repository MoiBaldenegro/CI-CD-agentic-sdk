import { BaseDomainEvent } from "../../../shared/DomainEvent.js";
import type { AgentRef } from "../value-objects/AgentRef.vo.js";
import type { TaskPriorityValue } from "../value-objects/TaskPriority.vo.js";
import type { TaskSourceValue } from "../value-objects/TaskSource.vo.js";

export interface TaskCreatedPayload {
  readonly title: string;
  readonly source: TaskSourceValue;
  readonly priority: TaskPriorityValue;
  readonly repository: string;
  readonly assignee: AgentRef | null;
}

export class TaskCreatedEvent extends BaseDomainEvent {
  readonly payload: TaskCreatedPayload;

  constructor(aggregateId: string, version: number, payload: TaskCreatedPayload) {
    super("task.created", aggregateId, version);
    this.payload = Object.freeze({ ...payload });
  }
}
