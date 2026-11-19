import { getQueueToken } from '@nestjs/bullmq';

export const TASK_QUEUE_NAME = 'tasks';
export const TASK_QUEUE_TOKEN = getQueueToken(TASK_QUEUE_NAME);
