import { BaseDomainEvent } from "../../../shared/DomainEvent.js";

export class TaskAssignedEvent extends BaseDomainEvent {
  readonly provider: string;
  readonly agentId: string;
  readonly model: string | null;
  readonly previousProvider: string | null;
  readonly previousAgentId: string | null;

  constructor(
    aggregateId: string,
    version: number,
    provider: string,
    agentId: string,
    model: string | null,
    previousProvider: string | null,
    previousAgentId: string | null,
  ) {
    super("task.assigned", aggregateId, version);
    this.provider = provider;
    this.agentId = agentId;
    this.model = model;
    this.previousProvider = previousProvider;
    this.previousAgentId = previousAgentId;
  }
}

export class TaskUnassignedEvent extends BaseDomainEvent {
  readonly previousProvider: string;
  readonly previousAgentId: string;

  constructor(aggregateId: string, version: number, previousProvider: string, previousAgentId: string) {
    super("task.unassigned", aggregateId, version);
    this.previousProvider = previousProvider;
    this.previousAgentId = previousAgentId;
  }
}
