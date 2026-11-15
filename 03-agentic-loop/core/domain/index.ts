export { Task } from "./entities/Task.entity.js";
export type {
  CreateTaskProps,
  TaskPrimitives,
  TaskProps,
} from "./entities/Task.entity.js";

export { AcceptanceCriteria } from "./value-objects/AcceptanceCriteria.vo.js";
export { AgentRef } from "./value-objects/AgentRef.vo.js";
export { RepositoryRef } from "./value-objects/RepositoryRef.vo.js";
export { TaskDescription } from "./value-objects/TaskDescription.vo.js";
export { TaskId } from "./value-objects/TaskId.vo.js";
export { TaskMetadata } from "./value-objects/TaskMetadata.vo.js";
export { TaskPriority, TASK_PRIORITY } from "./value-objects/TaskPriority.vo.js";
export type { TaskPriorityValue } from "./value-objects/TaskPriority.vo.js";
export { TaskSource, TASK_SOURCE } from "./value-objects/TaskSource.vo.js";
export type { TaskSourceValue } from "./value-objects/TaskSource.vo.js";
export { TaskSourceRef } from "./value-objects/TaskSourceRef.vo.js";
export { TaskStatus, TASK_STATUS } from "./value-objects/TaskStatus.vo.js";
export type { TaskStatusValue } from "./value-objects/TaskStatus.vo.js";
export { TaskTitle } from "./value-objects/TaskTitle.vo.js";

export { DomainError } from "../../shared/DomainError.js";
export { DomainValidationError } from "../../shared/DomainValidationError.js";
export { InvalidStateTransitionError } from "../../shared/InvalidStateTransitionError.js";
export { ValueObject } from "../../shared/ValueObject.js";
export { BaseDomainEvent } from "../../shared/DomainEvent.js";
export type { DomainEvent } from "../../shared/DomainEvent.js";

export { TaskCreatedEvent } from "./events/TaskCreated.event.js";
export type { TaskCreatedPayload } from "./events/TaskCreated.event.js";
export { TaskAssignedEvent, TaskUnassignedEvent } from "./events/TaskAssigned.event.js";
export { TaskStatusChangedEvent } from "./events/TaskStatusChanged.event.js";

export type {
  AgentArtifact,
  AgentArtifactKindValue,
  AgentExecutionContext,
  AgentExecutionRequest,
  AgentExecutionResult,
  AgentGateway,
  AgentOutcomeValue,
  AgentUsage,
} from "./outbound/AgentGateway.port.js";
export { AGENT_ARTIFACT_KIND, AGENT_OUTCOME } from "./outbound/AgentGateway.port.js";
export type {
  AgentDescriptor,
  AgentRegistry,
  AgentRequirements,
} from "./outbound/AgentRegistry.port.js";
export type { DomainEventPublisher } from "./outbound/DomainEventPublisher.port.js";
export type { TaskRepository } from "./outbound/TaskRepository.port.js";
export type { UnitOfWork } from "./outbound/UnitOfWork.port.js";
