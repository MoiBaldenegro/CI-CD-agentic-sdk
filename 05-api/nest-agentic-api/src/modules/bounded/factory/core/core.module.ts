import { DynamicModule, Module } from '@nestjs/common';
import {
  AGENT_GATEWAY,
  FactoryCoreModule,
  TASK_QUEUE,
  TASK_REPOSITORY,
  type AgentGateway,
  type TaskQueuePort,
  type TaskRepository,
} from 'lib/factory';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';

@Module({})
export class CoreModule {
  static register(): DynamicModule {
    return {
      module: CoreModule,
      imports: [
        FactoryCoreModule.registerAsync({
          imports: [InfrastructureModule.register()],
          inject: [TASK_REPOSITORY, AGENT_GATEWAY, TASK_QUEUE],
          useFactory: (
            taskRepository: TaskRepository,
            agentGateway: AgentGateway,
            taskQueue: TaskQueuePort,
          ) => ({ taskRepository, agentGateway, taskQueue }),
        }),
      ],
      exports: [FactoryCoreModule],
    };
  }
}
