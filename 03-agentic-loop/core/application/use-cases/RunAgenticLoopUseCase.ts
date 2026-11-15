import { DomainError } from "../../../shared/DomainError.js";
import type { TaskRepository } from "../../domain/outbound/TaskRepository.port.js";
import type { TaskExecutionSummary } from "../dto/TaskExecutionSummary.js";
import type {
  RunAgenticLoopOptions,
  RunAgenticLoopPort,
  RunAgenticLoopResult,
  TaskExecutionFailure,
} from "../inbound/RunAgenticLoop.port.js";
import type { ExecuteTaskUseCase } from "./ExecuteTaskUseCase.js";

export class RunAgenticLoopUseCase implements RunAgenticLoopPort {
  private readonly repository: TaskRepository;
  private readonly executeTask: ExecuteTaskUseCase;

  constructor(repository: TaskRepository, executeTask: ExecuteTaskUseCase) {
    this.repository = repository;
    this.executeTask = executeTask;
  }

  async run(options: RunAgenticLoopOptions = {}): Promise<RunAgenticLoopResult> {
    const maxTasks = Math.max(0, options.maxTasks ?? 5);
    const startedAt = new Date();
    const processed: TaskExecutionSummary[] = [];
    const failures: TaskExecutionFailure[] = [];
    const tasks = maxTasks === 0 ? [] : await this.repository.findNext(maxTasks);

    for (const task of tasks) {
      try {
        const summary = await this.executeTask.execute(task.id.value, {
          ...(options.capabilities !== undefined && { capabilities: options.capabilities }),
          ...(options.preferredProvider !== undefined && {
            preferredProvider: options.preferredProvider,
          }),
          ...(options.excludedProviders !== undefined && {
            excludedProviders: options.excludedProviders,
          }),
          ...(options.timeoutMs !== undefined && { timeoutMs: options.timeoutMs }),
          ...(options.signal !== undefined && { signal: options.signal }),
        });

        processed.push(summary);
      } catch (error) {
        failures.push(toFailure(task.id.value, error));

        if (options.stopOnError === true) {
          break;
        }
      }
    }

    return {
      startedAt,
      finishedAt: new Date(),
      processed,
      failures,
    };
  }
}

function toFailure(taskId: string, error: unknown): TaskExecutionFailure {
  if (error instanceof DomainError) {
    return { taskId, code: error.code, message: error.message };
  }

  return {
    taskId,
    code: "UNEXPECTED_ERROR",
    message: error instanceof Error ? error.message : String(error),
  };
}
