import { DynamicModule, Module, Provider } from '@nestjs/common';
import { AgentApplicationService } from './core/application/services/AgentApplicationService.js';
import { TaskApplicationService } from './core/application/services/TaskApplicationService.js';
import { ChangeTaskStatusUseCase } from './core/application/use-cases/ChangeTaskStatus.use-case.js';
import { CreateTaskUseCase } from './core/application/use-cases/CreateTask.use-case.js';
import { GetQueueStatsUseCase } from './core/application/use-cases/GetQueueStats.use-case.js';
import { GetTaskUseCase } from './core/application/use-cases/GetTask.use-case.js';
import { ListTasksUseCase } from './core/application/use-cases/ListTasks.use-case.js';
import { QueueTaskUseCase } from './core/application/use-cases/QueueTask.use-case.js';
import { SendAgentPromptUseCase } from './core/application/use-cases/SendAgentPrompt.use-case.js';
import type { AgentGateway } from './core/domain/outbound/AgentGateway.port.js';
import type { TaskQueuePort } from './core/domain/outbound/TaskQueue.port.js';
import type { TaskRepository } from './core/domain/outbound/TaskRepository.port.js';
import { AgentPromptService } from './core/domain/services/AgentPromptService.js';
import { TaskCreationService } from './core/domain/services/TaskCreationService.js';
import { TaskPersistenceService } from './core/domain/services/TaskPersistenceService.js';
import { TaskValidationService } from './core/domain/services/TaskValidationService.js';

export interface FactoryCoreModuleOptions {
  taskRepository: TaskRepository;
  agentGateway: AgentGateway;
  taskQueue: TaskQueuePort;
}

export interface FactoryCoreModuleAsyncOptions {
  imports?: DynamicModule['imports'];
  inject?: any[];
  useFactory: (
    ...args: any[]
  ) => FactoryCoreModuleOptions | Promise<FactoryCoreModuleOptions>;
}

const CORE_OPTIONS = Symbol('FACTORY_CORE_OPTIONS');

const exportedProviders = [TaskApplicationService, AgentApplicationService];

function createProviders(): Provider[] {
  return [
    {
      provide: TaskValidationService,
      useFactory: () => new TaskValidationService(),
    },
    {
      provide: TaskCreationService,
      useFactory: (validation: TaskValidationService) =>
        new TaskCreationService(validation),
      inject: [TaskValidationService],
    },
    {
      provide: TaskPersistenceService,
      useFactory: (options: FactoryCoreModuleOptions) =>
        new TaskPersistenceService(options.taskRepository),
      inject: [CORE_OPTIONS],
    },
    {
      provide: AgentPromptService,
      useFactory: (options: FactoryCoreModuleOptions) =>
        new AgentPromptService(options.agentGateway),
      inject: [CORE_OPTIONS],
    },
    {
      provide: CreateTaskUseCase,
      useFactory: (
        creation: TaskCreationService,
        persistence: TaskPersistenceService,
      ) => new CreateTaskUseCase(creation, persistence),
      inject: [TaskCreationService, TaskPersistenceService],
    },
    {
      provide: GetTaskUseCase,
      useFactory: (persistence: TaskPersistenceService) =>
        new GetTaskUseCase(persistence),
      inject: [TaskPersistenceService],
    },
    {
      provide: ListTasksUseCase,
      useFactory: (persistence: TaskPersistenceService) =>
        new ListTasksUseCase(persistence),
      inject: [TaskPersistenceService],
    },
    {
      provide: QueueTaskUseCase,
      useFactory: (
        options: FactoryCoreModuleOptions,
        persistence: TaskPersistenceService,
      ) => new QueueTaskUseCase(persistence, options.taskQueue),
      inject: [CORE_OPTIONS, TaskPersistenceService],
    },
    {
      provide: ChangeTaskStatusUseCase,
      useFactory: (persistence: TaskPersistenceService) =>
        new ChangeTaskStatusUseCase(persistence),
      inject: [TaskPersistenceService],
    },
    {
      provide: GetQueueStatsUseCase,
      useFactory: (options: FactoryCoreModuleOptions) =>
        new GetQueueStatsUseCase(options.taskQueue),
      inject: [CORE_OPTIONS],
    },
    {
      provide: SendAgentPromptUseCase,
      useFactory: (promptService: AgentPromptService) =>
        new SendAgentPromptUseCase(promptService),
      inject: [AgentPromptService],
    },
    {
      provide: TaskApplicationService,
      useFactory: (
        create: CreateTaskUseCase,
        get: GetTaskUseCase,
        list: ListTasksUseCase,
        queue: QueueTaskUseCase,
        changeStatus: ChangeTaskStatusUseCase,
        queueStats: GetQueueStatsUseCase,
      ) =>
        new TaskApplicationService(
          create,
          get,
          list,
          queue,
          changeStatus,
          queueStats,
        ),
      inject: [
        CreateTaskUseCase,
        GetTaskUseCase,
        ListTasksUseCase,
        QueueTaskUseCase,
        ChangeTaskStatusUseCase,
        GetQueueStatsUseCase,
      ],
    },
    {
      provide: AgentApplicationService,
      useFactory: (send: SendAgentPromptUseCase) =>
        new AgentApplicationService(send),
      inject: [SendAgentPromptUseCase],
    },
  ];
}

@Module({})
export class FactoryCoreModule {
  static register(options: FactoryCoreModuleOptions): DynamicModule {
    return {
      module: FactoryCoreModule,
      providers: [
        { provide: CORE_OPTIONS, useValue: options },
        ...createProviders(),
      ],
      exports: exportedProviders,
    };
  }

  static registerAsync(options: FactoryCoreModuleAsyncOptions): DynamicModule {
    return {
      module: FactoryCoreModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: CORE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        ...createProviders(),
      ],
      exports: exportedProviders,
    };
  }
}
