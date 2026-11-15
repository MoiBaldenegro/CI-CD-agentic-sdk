import { BaseDomainEvent } from "../../../shared/DomainEvent.js";
import type { TaskStatusValue } from "../value-objects/TaskStatus.vo.js";

export class TaskStatusChangedEvent extends BaseDomainEvent {
  readonly from: TaskStatusValue;
  readonly to: TaskStatusValue;
  readonly reason: string | null;

  constructor(
    aggregateId: string,
    version: number,
    from: TaskStatusValue,
    to: TaskStatusValue,
    reason: string | null,
  ) {
    super("task.status-changed", aggregateId, version);
    this.from = from;
    this.to = to;
    this.reason = reason;
  }
}
