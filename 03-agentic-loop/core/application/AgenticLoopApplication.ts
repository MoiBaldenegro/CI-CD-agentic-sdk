import type { TaskPrimitives } from "../domain/entities/Task.entity.js";
import type { AgentGateway } from "../domain/outbound/AgentGateway.port.js";
import type { AgentRegistry } from "../domain/outbound/AgentRegistry.port.js";
import type { DomainEventPublisher } from "../domain/outbound/DomainEventPublisher.port.js";
import type { TaskRepository } from "../domain/outbound/TaskRepository.port.js";
import type { UnitOfWork } from "../domain/outbound/UnitOfWork.port.js";
import { TaskAssignmentService } from "../domain/services/TaskAssignmentService.js";
import { TaskExecutionService } from "../domain/services/TaskExecutionService.js";
import { TaskRegistrationService } from "../domain/services/TaskRegistrationService.js";
import type { TaskExecutionSummary } from "./dto/TaskExecutionSummary.js";
import type {
  RunAgenticLoopOptions,
  RunAgenticLoopResult,
} from "./inbound/RunAgenticLoop.port.js";
import type { SubmitTaskCommand, SubmitTaskResult } from "./inbound/SubmitTask.port.js";
import { AgentInvocationService } from "./services/AgentInvocationService.js";
import { TaskPersistenceService } from "./services/TaskPersistenceService.js";
import { CancelTaskUseCase } from "./use-cases/CancelTaskUseCase.js";
import { ExecuteTaskUseCase } from "./use-cases/ExecuteTaskUseCase.js";
import type { ExecuteTaskOptions } from "./use-cases/ExecuteTaskUseCase.js";
import { GetTaskUseCase } from "./use-cases/GetTaskUseCase.js";
import { ListTasksUseCase } from "./use-cases/ListTasksUseCase.js";
import { RunAgenticLoopUseCase } from "./use-cases/RunAgenticLoopUseCase.js";
import { SubmitTaskUseCase } from "./use-cases/SubmitTaskUseCase.js";

export interface AgenticLoopApplicationConfig {
  readonly taskRepository: TaskRepository;
  readonly agentRegistry: AgentRegistry;
  readonly agentGateway: AgentGateway;
  readonly eventPublisher: DomainEventPublisher;
  readonly unitOfWork: UnitOfWork;
}

export class AgenticLoopApplication {
  private readonly submitTaskUseCase: SubmitTaskUseCase;
  private readonly getTaskUseCase: GetTaskUseCase;
  private readonly listTasksUseCase: ListTasksUseCase;
  private readonly cancelTaskUseCase: CancelTaskUseCase;
  private readonly executeTaskUseCase: ExecuteTaskUseCase;
  private readonly runLoopUseCase: RunAgenticLoopUseCase;

  constructor(config: AgenticLoopApplicationConfig) {
    const persistence = new TaskPersistenceService(
      config.taskRepository,
      config.eventPublisher,
      config.unitOfWork,
    );
    const registration = new TaskRegistrationService(config.taskRepository);
    const assignment = new TaskAssignmentService(config.agentRegistry);
    const invocation = new AgentInvocationService(config.agentGateway);
    const execution = new TaskExecutionService();

    this.submitTaskUseCase = new SubmitTaskUseCase(registration, persistence);
    this.getTaskUseCase = new GetTaskUseCase(persistence);
    this.listTasksUseCase = new ListTasksUseCase(config.taskRepository);
    this.cancelTaskUseCase = new CancelTaskUseCase(persistence);
    this.executeTaskUseCase = new ExecuteTaskUseCase(
      persistence,
      assignment,
      invocation,
      execution,
    );
    this.runLoopUseCase = new RunAgenticLoopUseCase(config.taskRepository, this.executeTaskUseCase);
  }

  submitTask(command: SubmitTaskCommand): Promise<SubmitTaskResult> {
    return this.submitTaskUseCase.execute(command);
  }

  getTask(taskId: string): Promise<TaskPrimitives> {
    return this.getTaskUseCase.execute(taskId);
  }

  listTasks(limit = 100): Promise<readonly TaskPrimitives[]> {
    return this.listTasksUseCase.execute(limit);
  }

  cancelTask(taskId: string, reason: string): Promise<TaskPrimitives> {
    return this.cancelTaskUseCase.execute(taskId, reason);
  }

  executeTask(taskId: string, options: ExecuteTaskOptions = {}): Promise<TaskExecutionSummary> {
    return this.executeTaskUseCase.execute(taskId, options);
  }

  run(options: RunAgenticLoopOptions = {}): Promise<RunAgenticLoopResult> {
    return this.runLoopUseCase.run(options);
  }
}
