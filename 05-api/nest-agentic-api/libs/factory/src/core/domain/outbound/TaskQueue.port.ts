export interface TaskQueueEnqueueResult {
  jobId: string;
}

export interface TaskQueueStats {
  enabled: boolean;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface TaskQueuePort {
  enqueue(taskId: string): Promise<TaskQueueEnqueueResult>;
  getStats(): Promise<TaskQueueStats>;
}
