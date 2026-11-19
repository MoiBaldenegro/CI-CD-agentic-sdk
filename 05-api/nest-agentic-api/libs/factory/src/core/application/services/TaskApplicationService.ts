import type {
  CreateTaskProps,
  TaskPrimitives,
  TaskTransitionDetails,
} from '../../domain/Task.entity.js';
import type { TaskQueueStats } from '../../domain/outbound/TaskQueue.port.js';
import { TaskStatus } from '../../domain/value-objects/task/TaskStatus.vo.js';
import { ChangeTaskStatusUseCase } from '../use-cases/ChangeTaskStatus.use-case.js';
import { CreateTaskUseCase } from '../use-cases/CreateTask.use-case.js';
import { GetQueueStatsUseCase } from '../use-cases/GetQueueStats.use-case.js';
import { GetTaskUseCase } from '../use-cases/GetTask.use-case.js';
import { ListTasksUseCase } from '../use-cases/ListTasks.use-case.js';
import {
  QueueTaskUseCase,
  type QueueTaskResult,
} from '../use-cases/QueueTask.use-case.js';

export class TaskApplicationService {
  constructor(
    private readonly createTaskUseCase: CreateTaskUseCase,
    private readonly getTaskUseCase: GetTaskUseCase,
    private readonly listTasksUseCase: ListTasksUseCase,
    private readonly queueTaskUseCase: QueueTaskUseCase,
    private readonly changeTaskStatusUseCase: ChangeTaskStatusUseCase,
    private readonly getQueueStatsUseCase: GetQueueStatsUseCase,
  ) {}

  createTask(props: CreateTaskProps): Promise<TaskPrimitives> {
    return this.createTaskUseCase.execute(props);
  }

  getTask(id: string): Promise<TaskPrimitives | null> {
    return this.getTaskUseCase.execute(id);
  }

  listTasks(): Promise<TaskPrimitives[]> {
    return this.listTasksUseCase.execute();
  }

  queueTask(id: string): Promise<QueueTaskResult> {
    return this.queueTaskUseCase.execute(id);
  }

  changeTaskStatus(
    id: string,
    status: TaskStatus,
    details: TaskTransitionDetails = {},
  ): Promise<TaskPrimitives> {
    return this.changeTaskStatusUseCase.execute(id, status, details);
  }

  approveTask(
    id: string,
    completionSummary = 'Aprobada por humano',
  ): Promise<TaskPrimitives> {
    return this.changeTaskStatus(id, TaskStatus.completed(), {
      completionSummary,
    });
  }

  cancelTask(
    id: string,
    cancellationReason = 'Cancelada por humano',
  ): Promise<TaskPrimitives> {
    return this.changeTaskStatus(id, TaskStatus.cancelled(), {
      cancellationReason,
    });
  }

  getQueueStats(): Promise<TaskQueueStats> {
    return this.getQueueStatsUseCase.execute();
  }
}
