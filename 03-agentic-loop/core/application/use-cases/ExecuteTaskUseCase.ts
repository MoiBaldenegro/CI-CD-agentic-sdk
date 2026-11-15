import { InvalidStateTransitionError } from "../../../shared/InvalidStateTransitionError.js";
import type { TaskAssignmentService } from "../../domain/services/TaskAssignmentService.js";
import type { TaskExecutionService } from "../../domain/services/TaskExecutionService.js";
import { TASK_STATUS } from "../../domain/value-objects/TaskStatus.vo.js";
import { TaskId } from "../../domain/value-objects/TaskId.vo.js";
import type { TaskExecutionSummary } from "../dto/TaskExecutionSummary.js";
import type { AgentInvocationService } from "../services/AgentInvocationService.js";
import type { TaskPersistenceService } from "../services/TaskPersistenceService.js";

export interface ExecuteTaskOptions {
  readonly capabilities?: readonly string[];
  readonly preferredProvider?: string;
  readonly excludedProviders?: readonly string[];
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export class ExecuteTaskUseCase {
  private readonly persistence: TaskPersistenceService;
  private readonly assignment: TaskAssignmentService;
  private readonly invocation: AgentInvocationService;
  private readonly execution: TaskExecutionService;

  constructor(
    persistence: TaskPersistenceService,
    assignment: TaskAssignmentService,
    invocation: AgentInvocationService,
    execution: TaskExecutionService,
  ) {
    this.persistence = persistence;
    this.assignment = assignment;
    this.invocation = invocation;
    this.execution = execution;
  }

  async execute(
    taskId: string,
    options: ExecuteTaskOptions = {},
  ): Promise<TaskExecutionSummary> {
    const task = await this.persistence.getById(TaskId.from(taskId));

    if (task.status.value === TASK_STATUS.PENDING) {
      task.queue();
    }

    let agent = task.assignee;

    if (agent === null) {
      const descriptor = await this.assignment.assign(task, options);
      agent = descriptor.agent;
    }

    if (task.status.value === TASK_STATUS.QUEUED) {
      task.start();
    }

    if (task.status.value !== TASK_STATUS.IN_PROGRESS) {
      throw new InvalidStateTransitionError(task.status.value, TASK_STATUS.IN_PROGRESS);
    }

    await this.persistence.save(task);

    const result = await this.invocation.invoke(task, agent, {
      ...(options.timeoutMs !== undefined && { timeoutMs: options.timeoutMs }),
      ...(options.signal !== undefined && { signal: options.signal }),
    });

    this.execution.applyResult(task, result);
    await this.persistence.save(task);

    return {
      taskId: task.id.value,
      outcome: result.outcome,
      status: task.status.value,
    };
  }
}
