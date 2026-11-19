import { AgentRef } from './value-objects/agent/AgentRef.vo.js';
import { AcceptanceCriteria } from './value-objects/task/AcceptanceCriteria.vo.js';
import { RepositoryRef } from './value-objects/task/RepositoryRef.vo.js';
import { TaskDescription } from './value-objects/task/TaskDescription.vo.js';
import { TaskId } from './value-objects/task/TaskId.vo.js';
import { TaskMetadata } from './value-objects/task/TaskMetadata.vo.js';
import { TaskPriority } from './value-objects/task/TaskPriority.vo.js';
import { TaskSource } from './value-objects/task/TaskSource.vo.js';
import { TaskSourceRef } from './value-objects/task/TaskSourceRef.vo.js';
import { TaskStatus } from './value-objects/task/TaskStatus.vo.js';
import { TaskTitle } from './value-objects/task/TaskTitle.vo.js';

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

export interface TaskTransitionDetails {
  blockReason?: string | null;
  failureReason?: string | null;
  cancellationReason?: string | null;
  completionSummary?: string | null;
}

export interface TaskPrimitives {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  source: string;
  sourceRef: { externalId: string; url: string | null } | null;
  repository: {
    owner: string;
    name: string;
    baseBranch: string;
  };
  assignee: {
    provider: string;
    agentId: string;
    model: string | null;
  } | null;
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
  //   private readonly events: DomainEvent[];

  private constructor(props: TaskProps) {
    this.props = { ...props };
    // this.events = [];
  }

  static create(props: CreateTaskProps): TaskPrimitives {
    const createdAt = props.createdAt ?? new Date();
    const sourceRef = props.sourceRef ?? null;
    const assignee = props.assignee ?? null;

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
      acceptanceCriteria:
        props.acceptanceCriteria ?? AcceptanceCriteria.empty(),
      metadata: props.metadata ?? TaskMetadata.empty(),
      blockReason: null,
      failureReason: null,
      cancellationReason: null,
      completionSummary: null,
      createdAt,
      updatedAt: createdAt,
      version: 1,
    });

    return task.toPrimitives();
  }

  static fromPrimitives(primitives: TaskPrimitives): Task {
    return new Task({
      id: TaskId.from(primitives.id),
      title: TaskTitle.from(primitives.title),
      description: TaskDescription.from(primitives.description),
      status: TaskStatus.from(primitives.status),
      priority: TaskPriority.from(primitives.priority),
      source: TaskSource.from(primitives.source),
      sourceRef:
        primitives.sourceRef === null
          ? null
          : TaskSourceRef.from(
              primitives.sourceRef.externalId,
              primitives.sourceRef.url,
            ),
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
      acceptanceCriteria: AcceptanceCriteria.from(
        primitives.acceptanceCriteria,
      ),
      metadata: TaskMetadata.from(primitives.metadata),
      blockReason: primitives.blockReason,
      failureReason: primitives.failureReason,
      cancellationReason: primitives.cancellationReason,
      completionSummary: primitives.completionSummary,
      createdAt: new Date(primitives.createdAt),
      updatedAt: new Date(primitives.updatedAt),
      version: primitives.version,
    });
  }

  transitionTo(
    nextStatus: TaskStatus,
    details: TaskTransitionDetails = {},
  ): TaskPrimitives {
    this.props.status.assertTransitionTo(nextStatus);
    this.props.status = nextStatus;

    if (details.blockReason !== undefined) {
      this.props.blockReason = details.blockReason;
    }

    if (details.failureReason !== undefined) {
      this.props.failureReason = details.failureReason;
    }

    if (details.cancellationReason !== undefined) {
      this.props.cancellationReason = details.cancellationReason;
    }

    if (details.completionSummary !== undefined) {
      this.props.completionSummary = details.completionSummary;
    }

    this.props.updatedAt = new Date();
    this.props.version += 1;

    return this.toPrimitives();
  }

  toPrimitives(): TaskPrimitives {
    const { props } = this;

    return {
      id: props.id.value,
      title: props.title.value,
      description: props.description.value,
      status: props.status.value,
      priority: props.priority.value,
      source: props.source.value,
      sourceRef:
        props.sourceRef === null
          ? null
          : {
              externalId: props.sourceRef.externalId,
              url: props.sourceRef.url,
            },
      repository: {
        owner: props.repository.owner,
        name: props.repository.name,
        baseBranch: props.repository.baseBranch,
      },
      assignee:
        props.assignee === null
          ? null
          : {
              provider: props.assignee.provider,
              agentId: props.assignee.agentId,
              model: props.assignee.model,
            },
      acceptanceCriteria: [...props.acceptanceCriteria.items],
      metadata: { ...props.metadata.entries },
      blockReason: props.blockReason,
      failureReason: props.failureReason,
      cancellationReason: props.cancellationReason,
      completionSummary: props.completionSummary,
      createdAt: props.createdAt.toISOString(),
      updatedAt: props.updatedAt.toISOString(),
      version: props.version,
    };
  }
}
