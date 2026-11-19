import { DynamicModule, Logger, Module, Provider } from '@nestjs/common';
import { AGENT_GATEWAY, TASK_QUEUE, TASK_REPOSITORY } from 'lib/factory';
import {
  resolveAgentAdapter,
  resolveOpenCodeCliConfig,
} from '../../../../global/agent.config';
import { resolvePersistenceDriver } from '../../../../global/persistence.config';
import { resolveQueueConfig } from '../../../../global/queue.config';
import { OpenCodeCliAgentAdapter } from './agents/OpenCodeCliAgentAdapter';
import { SimulatedAgentGateway } from './agents/simulated-agent.gateway';
import { UnavailableAgentGateway } from './agents/unavailable-agent.gateway';
import { InMemoryTaskRepository } from './persistence/in-memory-task.repository';
import { TypeOrmTaskRepository } from './persistence/typeorm-task.repository';
import { BullMqTaskQueueAdapter } from './queue/bullmq-task-queue.adapter';
import { UnavailableTaskQueueAdapter } from './queue/unavailable-task-queue.adapter';

@Module({})
export class InfrastructureModule {
  static register(): DynamicModule {
    const persistence = resolvePersistenceDriver();
    const agent = resolveAgentAdapter();
    const queue = resolveQueueConfig();
    new Logger('InfrastructureModule').log(
      `persistence=${persistence} agentAdapter=${agent} queue=${queue.enabled ? 'bullmq' : 'disabled'}`,
    );

    return {
      module: InfrastructureModule,
      providers: [
        taskRepositoryProvider(persistence),
        agentGatewayProvider(agent),
        taskQueueProvider(queue.enabled),
      ],
      exports: [TASK_REPOSITORY, AGENT_GATEWAY, TASK_QUEUE],
    };
  }
}

function taskRepositoryProvider(
  persistence: ReturnType<typeof resolvePersistenceDriver>,
): Provider {
  if (persistence === 'memory') {
    return {
      provide: TASK_REPOSITORY,
      useClass: InMemoryTaskRepository,
    };
  }

  return {
    provide: TASK_REPOSITORY,
    useClass: TypeOrmTaskRepository,
  };
}

function agentGatewayProvider(
  agent: ReturnType<typeof resolveAgentAdapter>,
): Provider {
  if (agent === 'simulated') {
    return {
      provide: AGENT_GATEWAY,
      useClass: SimulatedAgentGateway,
    };
  }

  if (agent === 'unavailable') {
    return {
      provide: AGENT_GATEWAY,
      useClass: UnavailableAgentGateway,
    };
  }

  return {
    provide: AGENT_GATEWAY,
    useFactory: () => new OpenCodeCliAgentAdapter(resolveOpenCodeCliConfig()),
  };
}

function taskQueueProvider(enabled: boolean): Provider {
  if (enabled) {
    return {
      provide: TASK_QUEUE,
      useClass: BullMqTaskQueueAdapter,
    };
  }

  return {
    provide: TASK_QUEUE,
    useClass: UnavailableTaskQueueAdapter,
  };
}
