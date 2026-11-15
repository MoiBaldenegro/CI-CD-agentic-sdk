import { AgentRef } from "../value-objects/AgentRef.vo.js";
import { AcceptanceCriteria } from "../value-objects/AcceptanceCriteria.vo.js";
import { RepositoryRef } from "../value-objects/RepositoryRef.vo.js";
import { TaskDescription } from "../value-objects/TaskDescription.vo.js";
import { TaskId } from "../value-objects/TaskId.vo.js";
import { TaskMetadata } from "../value-objects/TaskMetadata.vo.js";
import { TaskPriority } from "../value-objects/TaskPriority.vo.js";
import type { TaskPriorityValue } from "../value-objects/TaskPriority.vo.js";
import { TaskSource } from "../value-objects/TaskSource.vo.js";
import type { TaskSourceValue } from "../value-objects/TaskSource.vo.js";
import { TaskSourceRef } from "../value-objects/TaskSourceRef.vo.js";
import { TaskStatus, TASK_STATUS } from "../value-objects/TaskStatus.vo.js";
import type { TaskStatusValue } from "../value-objects/TaskStatus.vo.js";
import { TaskTitle } from "../value-objects/TaskTitle.vo.js";
import { DomainValidationError } from "../../../shared/DomainValidationError.js";
import type { DomainEvent } from "../../../shared/DomainEvent.js";
import { TaskAssignedEvent, TaskUnassignedEvent } from "../events/TaskAssigned.event.js";
import { TaskCreatedEvent } from "../events/TaskCreated.event.js";
import { TaskStatusChangedEvent } from "../events/TaskStatusChanged.event.js";
import { TaskSourceReferenceRequiredError } from "../exceptions/TaskSourceReferenceRequiredError.js";
import { TaskTerminalStateError } from "../exceptions/TaskTerminalStateError.js";

const MAX_REASON_LENGTH = 2_000;

export interface TaskProps {
  id: TaskId;
  title: TaskTitle;
  description: TaskDescription;
  status: TaskStatus;
  priority: TaskPriority;
  source: TaskSource;
  sourceRef: TaskSourceRef | null;
  repository: RepositoryRef;
  assignee: AgentRef | null;
  acceptanceCriteria: AcceptanceCriteria;
  metadata: TaskMetadata;
  blockReason: string | null;
  failureReason: string | null;
  cancellationReason: string | null;
  completionSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface CreateTaskProps {
  readonly title: TaskTitle;
  readonly description: TaskDescription;
  readonly source: TaskSource;
  readonly repository: RepositoryRef;
  readonly sourceRef?: TaskSourceRef | null;
  readonly priority?: TaskPriority;
  readonly acceptanceCriteria?: AcceptanceCriteria;
  readonly metadata?: TaskMetadata;
  readonly assignee?: AgentRef | null;
  readonly createdAt?: Date;
}

export interface TaskPrimitives {
  id: string;
  title: string;
  description: string;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  source: TaskSourceValue;
  sourceRef: { externalId: string; url: string | null } | null;
  repository: { owner: string; name: string; baseBranch: string };
  assignee: { provider: string; agentId: string; model: string | null } | null;
  acceptanceCriteria: string[];
  metadata: Record<string, string>;
  blockReason: string | null;
  failureReason: string | null;
  cancellationReason: string | null;
  completionSummary: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export class Task {
  private readonly props: TaskProps;
  private readonly events: DomainEvent[];

  private constructor(props: TaskProps) {
    this.props = { ...props };
    this.events = [];
  }

  static create(props: CreateTaskProps): Task {
    const createdAt = props.createdAt ?? new Date();
    const sourceRef = props.sourceRef ?? null;
    const assignee = props.assignee ?? null;

    if (props.source.isExternalIssue() && sourceRef === null) {
      throw new TaskSourceReferenceRequiredError(props.source.value);
    }

    const task = new Task({
      id: TaskId.generate(),
      title: props.title,
      description: props.description,
      status: TaskStatus.pending(),
      priority: props.priority ?? TaskPriority.medium(),
      source: props.source,
      sourceRef,
      repository: props.repository,
      assignee,
      acceptanceCriteria: props.acceptanceCriteria ?? AcceptanceCriteria.empty(),
      metadata: props.metadata ?? TaskMetadata.empty(),
      blockReason: null,
      failureReason: null,
      cancellationReason: null,
      completionSummary: null,
      createdAt,
      updatedAt: createdAt,
      version: 1,
    });

    assertInvariants(task.props);
    task.record(
      new TaskCreatedEvent(task.id.value, task.version, {
        title: task.title.value,
        source: task.source.value,
        priority: task.priority.value,
        repository: task.repository.fullName,
        assignee: task.assignee,
      }),
    );

    return task;
  }

  static reconstitute(props: TaskProps): Task {
    assertInvariants(props);
    return new Task(props);
  }

  static fromPrimitives(primitives: TaskPrimitives): Task {
    const createdAt = parseDate(primitives.createdAt, "createdAt");
    const updatedAt = parseDate(primitives.updatedAt, "updatedAt");
    const source = TaskSource.from(primitives.source);
    const sourceRef =
      primitives.sourceRef === null
        ? null
        : TaskSourceRef.from(primitives.sourceRef.externalId, primitives.sourceRef.url);

    if (source.isExternalIssue() && sourceRef === null) {
      throw new TaskSourceReferenceRequiredError(source.value);
    }

    return Task.reconstitute({
      id: TaskId.from(primitives.id),
      title: TaskTitle.from(primitives.title),
      description: TaskDescription.from(primitives.description),
      status: TaskStatus.from(primitives.status),
      priority: TaskPriority.from(primitives.priority),
      source,
      sourceRef,
      repository: RepositoryRef.from(
        primitives.repository.owner,
        primitives.repository.name,
        primitives.repository.baseBranch,
      ),
      assignee:
        primitives.assignee === null
          ? null
          : AgentRef.from(
              primitives.assignee.provider,
              primitives.assignee.agentId,
              primitives.assignee.model,
            ),
      acceptanceCriteria: AcceptanceCriteria.from(primitives.acceptanceCriteria),
      metadata: TaskMetadata.from(primitives.metadata),
      blockReason: primitives.blockReason,
      failureReason: primitives.failureReason,
      cancellationReason: primitives.cancellationReason,
      completionSummary: primitives.completionSummary,
      createdAt,
      updatedAt,
      version: primitives.version,
    });
  }

  get id(): TaskId {
    return this.props.id;
  }

  get title(): TaskTitle {
    return this.props.title;
  }

  get description(): TaskDescription {
    return this.props.description;
  }

  get status(): TaskStatus {
    return this.props.status;
  }

  get priority(): TaskPriority {
    return this.props.priority;
  }

  get source(): TaskSource {
    return this.props.source;
  }

  get sourceRef(): TaskSourceRef | null {
    return this.props.sourceRef;
  }

  get repository(): RepositoryRef {
    return this.props.repository;
  }

  get assignee(): AgentRef | null {
    return this.props.assignee;
  }

  get acceptanceCriteria(): AcceptanceCriteria {
    return this.props.acceptanceCriteria;
  }

  get metadata(): TaskMetadata {
    return this.props.metadata;
  }

  get blockReason(): string | null {
    return this.props.blockReason;
  }

  get failureReason(): string | null {
    return this.props.failureReason;
  }

  get cancellationReason(): string | null {
    return this.props.cancellationReason;
  }

  get completionSummary(): string | null {
    return this.props.completionSummary;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }

  get version(): number {
    return this.props.version;
  }

  isTerminal(): boolean {
    return this.props.status.isTerminal();
  }

  queue(): void {
    this.transitionTo(TaskStatus.queued());
  }

  start(): void {
    this.transitionTo(TaskStatus.inProgress());
  }

  block(reason: string): void {
    const normalized = normalizeReason(reason, "TASK_BLOCK_REASON_REQUIRED", "blockReason");
    this.transitionTo(TaskStatus.blocked(), normalized, () => {
      this.props.blockReason = normalized;
    });
  }

  resume(): void {
    this.transitionTo(TaskStatus.inProgress());
  }

  submitForReview(reason: string | null = null): void {
    const normalized =
      reason === null || reason.trim().length === 0
        ? null
        : normalizeReason(reason, "TASK_REVIEW_REASON_INVALID", "reason");
    this.transitionTo(TaskStatus.inReview(), normalized);
  }

  requestChanges(reason: string): void {
    const normalized = normalizeReason(reason, "TASK_CHANGES_REASON_REQUIRED", "reason");
    this.transitionTo(TaskStatus.inProgress(), normalized);
  }

  complete(summary: string): void {
    const normalized = normalizeReason(
      summary,
      "TASK_COMPLETION_SUMMARY_REQUIRED",
      "completionSummary",
    );
    this.transitionTo(TaskStatus.completed(), normalized, () => {
      this.props.completionSummary = normalized;
    });
  }

  fail(reason: string): void {
    const normalized = normalizeReason(reason, "TASK_FAILURE_REASON_REQUIRED", "failureReason");
    this.transitionTo(TaskStatus.failed(), normalized, () => {
      this.props.failureReason = normalized;
    });
  }

  cancel(reason: string): void {
    const normalized = normalizeReason(
      reason,
      "TASK_CANCELLATION_REASON_REQUIRED",
      "cancellationReason",
    );
    this.transitionTo(TaskStatus.cancelled(), normalized, () => {
      this.props.cancellationReason = normalized;
    });
  }

  assign(agent: AgentRef): void {
    this.ensureMutable();

    if (this.props.assignee?.equals(agent) === true) return;

    const previous = this.props.assignee;
    this.props.assignee = agent;
    const version = this.touch();
    this.record(
      new TaskAssignedEvent(
        this.id.value,
        version,
        agent.provider,
        agent.agentId,
        agent.model,
        previous?.provider ?? null,
        previous?.agentId ?? null,
      ),
    );
  }

  unassign(): void {
    this.ensureMutable();

    const previous = this.props.assignee;
    if (previous === null) return;

    this.props.assignee = null;
    const version = this.touch();
    this.record(
      new TaskUnassignedEvent(this.id.value, version, previous.provider, previous.agentId),
    );
  }

  updateTitle(title: TaskTitle): void {
    this.ensureMutable();
    if (this.props.title.equals(title)) return;
    this.props.title = title;
    this.touch();
  }

  updateDescription(description: TaskDescription): void {
    this.ensureMutable();
    if (this.props.description.equals(description)) return;
    this.props.description = description;
    this.touch();
  }

  changePriority(priority: TaskPriority): void {
    this.ensureMutable();
    if (this.props.priority.equals(priority)) return;
    this.props.priority = priority;
    this.touch();
  }

  replaceAcceptanceCriteria(acceptanceCriteria: AcceptanceCriteria): void {
    this.ensureMutable();
    this.props.acceptanceCriteria = acceptanceCriteria;
    this.touch();
  }

  updateMetadata(metadata: TaskMetadata): void {
    this.ensureMutable();
    this.props.metadata = metadata;
    this.touch();
  }

  pullDomainEvents(): readonly DomainEvent[] {
    const events = [...this.events];
    this.events.length = 0;
    return events;
  }

  toPrimitives(): TaskPrimitives {
    return {
      id: this.id.value,
      title: this.title.value,
      description: this.description.value,
      status: this.status.value,
      priority: this.priority.value,
      source: this.source.value,
      sourceRef:
        this.sourceRef === null
          ? null
          : { externalId: this.sourceRef.externalId, url: this.sourceRef.url },
      repository: {
        owner: this.repository.owner,
        name: this.repository.name,
        baseBranch: this.repository.baseBranch,
      },
      assignee:
        this.assignee === null
          ? null
          : {
              provider: this.assignee.provider,
              agentId: this.assignee.agentId,
              model: this.assignee.model,
            },
      acceptanceCriteria: [...this.acceptanceCriteria.items],
      metadata: { ...this.metadata.entries },
      blockReason: this.blockReason,
      failureReason: this.failureReason,
      cancellationReason: this.cancellationReason,
      completionSummary: this.completionSummary,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      version: this.version,
    };
  }

  private transitionTo(next: TaskStatus, reason: string | null = null, mutate?: () => void): void {
    const from = this.props.status;
    from.assertTransitionTo(next);

    mutate?.();
    this.props.status = next;
    if (next.value !== TASK_STATUS.BLOCKED) {
      this.props.blockReason = null;
    }

    const version = this.touch();
    this.record(
      new TaskStatusChangedEvent(this.id.value, version, from.value, next.value, reason),
    );
  }

  private ensureMutable(): void {
    if (this.isTerminal()) {
      throw new TaskTerminalStateError(this.id.value, this.status.value);
    }
  }

  private touch(): number {
    this.props.version += 1;
    this.props.updatedAt = new Date();
    return this.props.version;
  }

  private record(event: DomainEvent): void {
    this.events.push(event);
  }
}

function assertInvariants(props: TaskProps): void {
  assertValidDate(props.createdAt, "createdAt");
  assertValidDate(props.updatedAt, "updatedAt");

  if (props.updatedAt.getTime() < props.createdAt.getTime()) {
    throw new DomainValidationError(
      "TASK_UPDATED_BEFORE_CREATED",
      "Task updatedAt must not be earlier than createdAt",
    );
  }

  if (!Number.isInteger(props.version) || props.version < 1) {
    throw new DomainValidationError("TASK_VERSION_INVALID", "Task version must be a positive integer", {
      version: props.version,
    });
  }

  if (props.status.value === TASK_STATUS.BLOCKED && !isNonEmpty(props.blockReason)) {
    throw new DomainValidationError(
      "TASK_BLOCK_REASON_REQUIRED",
      "A blocked task requires a block reason",
    );
  }

  if (props.status.value === TASK_STATUS.COMPLETED && !isNonEmpty(props.completionSummary)) {
    throw new DomainValidationError(
      "TASK_COMPLETION_SUMMARY_REQUIRED",
      "A completed task requires a completion summary",
    );
  }

  if (props.status.value === TASK_STATUS.FAILED && !isNonEmpty(props.failureReason)) {
    throw new DomainValidationError(
      "TASK_FAILURE_REASON_REQUIRED",
      "A failed task requires a failure reason",
    );
  }

  if (props.status.value === TASK_STATUS.CANCELLED && !isNonEmpty(props.cancellationReason)) {
    throw new DomainValidationError(
      "TASK_CANCELLATION_REASON_REQUIRED",
      "A cancelled task requires a cancellation reason",
    );
  }
}

function normalizeReason(value: string, code: string, field: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new DomainValidationError(code, `${field} must not be empty`, { field });
  }

  if (normalized.length > MAX_REASON_LENGTH) {
    throw new DomainValidationError(code, `${field} must be at most ${MAX_REASON_LENGTH} characters`, {
      field,
      length: normalized.length,
    });
  }

  return normalized;
}

function assertValidDate(date: Date, field: string): void {
  if (Number.isNaN(date.getTime())) {
    throw new DomainValidationError("TASK_DATE_INVALID", `${field} must be a valid date`, { field });
  }
}

function parseDate(value: string, field: string): Date {
  const date = new Date(value);
  assertValidDate(date, field);
  return date;
}

function isNonEmpty(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}
