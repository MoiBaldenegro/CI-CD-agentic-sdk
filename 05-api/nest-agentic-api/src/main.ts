import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  resolveAgentAdapter,
  resolveOpenCodeCliConfig,
} from './global/agent.config';
import { resolvePersistenceDriver } from './global/persistence.config';
import { resolveQueueConfig } from './global/queue.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = Number(process.env.PORT ?? 3006);
  const host = process.env.HOST?.trim() || '127.0.0.1';
  const agentAdapter = resolveAgentAdapter();
  const queue = resolveQueueConfig();

  const app = await NestFactory.create(AppModule);

  logger.log(
    `PERSISTENCE=${resolvePersistenceDriver()} AGENT_ADAPTER=${agentAdapter}`,
  );

  logger.log(
    `QUEUE_ENABLED=${queue.enabled}${
      queue.enabled
        ? ` REDIS=${queue.options.connection.host}:${queue.options.connection.port}/${queue.options.connection.db ?? 0}`
        : ''
    }`,
  );

  if (agentAdapter === 'opencode-cli') {
    const openCode = resolveOpenCodeCliConfig();
    logger.log(
      `OPENCODE_WORKSPACE=${openCode.directory} OPENCODE_MODEL=${openCode.model ?? 'default'}`,
    );
  }

  if (host !== '127.0.0.1' && host !== 'localhost' && !process.env.API_KEY) {
    logger.warn(
      `HOST=${host} expone la API en la red sin API_KEY: cualquiera podría ejecutar prompts en el agente`,
    );
  }

  await app.listen(port, host);
  logger.log(`API escuchando en http://${host}:${port}`);
}

void bootstrap();
