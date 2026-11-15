import type { TaskExecutionSummary } from "../dto/TaskExecutionSummary.js";

export interface RunAgenticLoopOptions {
  readonly maxTasks?: number;
  readonly capabilities?: readonly string[];
  readonly preferredProvider?: string;
  readonly excludedProviders?: readonly string[];
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly stopOnError?: boolean;
}

export interface TaskExecutionFailure {
  readonly taskId: string;
  readonly code: string;
  readonly message: string;
}

export interface RunAgenticLoopResult {
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly processed: readonly TaskExecutionSummary[];
  readonly failures: readonly TaskExecutionFailure[];
}

export interface RunAgenticLoopPort {
  run(options?: RunAgenticLoopOptions): Promise<RunAgenticLoopResult>;
}
