import { AgentApplicationService } from "../../core/application/services/AgentApplicationService.js";
import { TaskApplicationService } from "../../core/application/services/TaskApplicationService.js";
import { CreateTaskUseCase } from "../../core/application/use-cases/CreateTask.use-case.js";
import { GetTaskUseCase } from "../../core/application/use-cases/GetTask.use-case.js";
import { SendAgentPromptUseCase } from "../../core/application/use-cases/SendAgentPrompt.use-case.js";
import { AgentPromptService } from "../../core/domain/services/AgentPromptService.js";
import { TaskCreationService } from "../../core/domain/services/TaskCreationService.js";
import { TaskPersistenceService } from "../../core/domain/services/TaskPersistenceService.js";
import { TaskValidationService } from "../../core/domain/services/TaskValidationService.js";
import type { AgentGateway } from "../../core/domain/outbound/AgentGateway.port.js";
import { OpenCodeCliAgentAdapter } from "../agents/OpenCodeCliAgentAdapter.js";
import { OpenRouterAgentAdapter } from "../agents/OpenRouterAgentAdapter.js";
import { InMemoryTaskRepository } from "../persistence/InMemoryTaskRepository.js";

export interface ApplicationContainer {
  readonly tasks: TaskApplicationService;
  readonly agents: AgentApplicationService;
}

export function createApplicationContainer(gateway: AgentGateway): ApplicationContainer {
  const taskRepository = new InMemoryTaskRepository();
  const taskValidationService = new TaskValidationService();
  const taskCreationService = new TaskCreationService(taskValidationService);
  const taskPersistenceService = new TaskPersistenceService(taskRepository);

  const createTaskUseCase = new CreateTaskUseCase(
    taskCreationService,
    taskPersistenceService,
  );
  const getTaskUseCase = new GetTaskUseCase(taskPersistenceService);
  const sendAgentPromptUseCase = new SendAgentPromptUseCase(new AgentPromptService(gateway));

  return {
    tasks: new TaskApplicationService(createTaskUseCase, getTaskUseCase),
    agents: new AgentApplicationService(sendAgentPromptUseCase),
  };
}

export function createOpenCodeApplicationContainer(
  directory: string,
  model?: string,
  systemPrompt?: string,
): ApplicationContainer {
  return createApplicationContainer(
    new OpenCodeCliAgentAdapter({ directory, model, systemPrompt }),
  );
}

export function createOpenRouterApplicationContainer(
  options: ConstructorParameters<typeof OpenRouterAgentAdapter>[0],
): ApplicationContainer {
  return createApplicationContainer(new OpenRouterAgentAdapter(options));
}
