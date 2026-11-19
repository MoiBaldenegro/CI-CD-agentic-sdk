export class TaskQueueUnavailableError extends Error {
  readonly code = 'TASK_QUEUE_UNAVAILABLE';

  constructor(message = 'Task queue is not available') {
    super(message);
    this.name = 'TaskQueueUnavailableError';
  }
}
