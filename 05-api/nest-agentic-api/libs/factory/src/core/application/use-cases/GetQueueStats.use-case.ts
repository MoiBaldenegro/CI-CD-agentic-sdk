import type {
  TaskQueuePort,
  TaskQueueStats,
} from '../../domain/outbound/TaskQueue.port.js';

export class GetQueueStatsUseCase {
  constructor(private readonly taskQueue: TaskQueuePort) {}

  execute(): Promise<TaskQueueStats> {
    return this.taskQueue.getStats();
  }
}
