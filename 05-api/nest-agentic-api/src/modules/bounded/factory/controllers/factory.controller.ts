import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AcceptanceCriteria,
  Agent,
  AgentApplicationService,
  AgentRef,
  RepositoryRef,
  TaskApplicationService,
  TaskDescription,
  TaskMetadata,
  TaskPriority,
  TaskQueueUnavailableError,
  TaskSource,
  TaskSourceRef,
  TaskTitle,
  type CreateTaskProps,
} from 'lib/factory';
import { resolveAgentAdapter } from '../../../../global/agent.config';
import { resolvePersistenceDriver } from '../../../../global/persistence.config';
import { resolveQueueConfig } from '../../../../global/queue.config';
import {
  ApproveTaskRequest,
  CancelTaskRequest,
  CreateTaskRequest,
  SendPromptRequest,
} from './factory.dto';
import { renderTaskDashboard } from './task-dashboard.page';

@Controller('factory')
export class FactoryController {
  private readonly logger = new Logger(FactoryController.name);

  constructor(
    private readonly agentApplicationService: AgentApplicationService,
    private readonly taskApplicationService: TaskApplicationService,
  ) {}

  @Get('health')
  health() {
    const queue = resolveQueueConfig();
    const modes = {
      persistence: resolvePersistenceDriver(),
      agentAdapter: resolveAgentAdapter(),
      queue: queue.enabled ? 'bullmq' : 'disabled',
    };

    this.logger.log(`GET /factory/health -> ${JSON.stringify(modes)}`);

    return {
      status: 'ok',
      ...modes,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('dashboard')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  dashboard(): string {
    this.logger.log('GET /factory/dashboard');

    return renderTaskDashboard();
  }

  @Post('agents/prompt')
  async sendPrompt(@Body() body: SendPromptRequest) {
    if (typeof body?.text !== 'string' || body.text.trim().length === 0) {
      throw new BadRequestException('text is required');
    }

    const provider = body.provider ?? 'opencode';
    const agentId = body.agentId ?? 'builder-01';

    this.logger.log(
      `POST /factory/agents/prompt -> provider=${provider} agentId=${agentId} chars=${body.text.length}`,
    );

    const agent = Agent.create({
      provider,
      agentId,
      model: body.model ?? null,
    });

    const response = await this.agentApplicationService.sendPrompt(agent, {
      text: body.text,
    });

    this.logger.log(
      `POST /factory/agents/prompt <- sessionId=${response.sessionId ?? 'n/a'} chars=${response.text.length}`,
    );

    return { agent, response };
  }

  @Post('tasks')
  @HttpCode(HttpStatus.ACCEPTED)
  async createTask(@Body() body: CreateTaskRequest) {
    this.assertCreateTaskRequest(body);

    this.logger.log(
      `POST /factory/tasks -> title="${body.title}" source=${body.source ?? 'MANUAL'}`,
    );

    const task = await this.taskApplicationService.createTask(
      this.toCreateTaskProps(body),
    );

    this.logger.log(
      `POST /factory/tasks <- id=${task.id} status=${task.status}; encolando`,
    );

    try {
      const queued = await this.taskApplicationService.queueTask(task.id);

      this.logger.log(
        `POST /factory/tasks <- id=${task.id} jobId=${queued.jobId} status=${queued.task.status}`,
      );

      return {
        task: queued.task,
        queue: {
          name: 'tasks',
          jobId: queued.jobId,
          status: 'queued',
        },
      };
    } catch (error: unknown) {
      if (error instanceof TaskQueueUnavailableError) {
        this.logger.error(
          `POST /factory/tasks <- id=${task.id} no se pudo encolar: ${error.message}`,
        );

        throw new ServiceUnavailableException({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          code: error.code,
          message: error.message,
          task,
        });
      }

      throw error;
    }
  }

  @Post('tasks/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveTask(@Param('id') id: string, @Body() body: ApproveTaskRequest) {
    const summary =
      typeof body?.completionSummary === 'string' &&
      body.completionSummary.trim().length > 0
        ? body.completionSummary.trim()
        : 'Aprobada por humano';

    this.logger.log(`POST /factory/tasks/${id}/approve -> "${summary}"`);

    const task = await this.taskApplicationService.approveTask(id, summary);

    this.logger.log(
      `POST /factory/tasks/${id}/approve <- status=${task.status}`,
    );

    return task;
  }

  @Post('tasks/:id/requeue')
  @HttpCode(HttpStatus.ACCEPTED)
  async requeueTask(@Param('id') id: string) {
    this.logger.log(`POST /factory/tasks/${id}/requeue`);

    const queued = await this.taskApplicationService.queueTask(id);

    this.logger.log(
      `POST /factory/tasks/${id}/requeue <- jobId=${queued.jobId} status=${queued.task.status}`,
    );

    return {
      task: queued.task,
      queue: {
        name: 'tasks',
        jobId: queued.jobId,
        status: 'queued',
      },
    };
  }

  @Post('tasks/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelTask(@Param('id') id: string, @Body() body: CancelTaskRequest) {
    const reason =
      typeof body?.reason === 'string' && body.reason.trim().length > 0
        ? body.reason.trim()
        : 'Cancelada por humano';

    this.logger.log(`POST /factory/tasks/${id}/cancel -> "${reason}"`);

    const task = await this.taskApplicationService.cancelTask(id, reason);

    this.logger.log(
      `POST /factory/tasks/${id}/cancel <- status=${task.status}`,
    );

    return task;
  }

  @Get('queue/stats')
  async getQueueStats() {
    this.logger.log('GET /factory/queue/stats');

    const stats = await this.taskApplicationService.getQueueStats();

    this.logger.log(`GET /factory/queue/stats <- ${JSON.stringify(stats)}`);

    return stats;
  }

  @Get('tasks')
  async listTasks() {
    this.logger.log('GET /factory/tasks');

    const tasks = await this.taskApplicationService.listTasks();

    this.logger.log(`GET /factory/tasks <- total=${tasks.length}`);

    return tasks;
  }

  @Get('tasks/:id')
  async getTask(@Param('id') id: string) {
    this.logger.log(`GET /factory/tasks/${id}`);

    const task = await this.taskApplicationService.getTask(id);

    if (task === null) {
      this.logger.warn(`GET /factory/tasks/${id} <- no encontrada`);
      throw new NotFoundException(`Task ${id} not found`);
    }

    this.logger.log(`GET /factory/tasks/${id} <- status=${task.status}`);

    return task;
  }

  private assertCreateTaskRequest(
    body: CreateTaskRequest | undefined,
  ): asserts body is CreateTaskRequest {
    const repository = body?.repository;

    if (
      body === undefined ||
      typeof body.title !== 'string' ||
      typeof body.description !== 'string' ||
      repository === undefined ||
      typeof repository.owner !== 'string' ||
      typeof repository.name !== 'string'
    ) {
      throw new BadRequestException(
        'title, description and repository.{owner,name} are required',
      );
    }
  }

  private toCreateTaskProps(body: CreateTaskRequest): CreateTaskProps {
    return {
      title: TaskTitle.from(body.title),
      description: TaskDescription.from(body.description),
      source: TaskSource.from(body.source ?? 'MANUAL'),
      repository: RepositoryRef.from(
        body.repository.owner,
        body.repository.name,
        body.repository.baseBranch ?? 'main',
      ),
      sourceRef: body.sourceRef
        ? TaskSourceRef.from(
            body.sourceRef.externalId,
            body.sourceRef.url ?? null,
          )
        : null,
      priority: body.priority
        ? TaskPriority.from(body.priority)
        : TaskPriority.medium(),
      acceptanceCriteria: body.acceptanceCriteria
        ? AcceptanceCriteria.from(body.acceptanceCriteria)
        : AcceptanceCriteria.empty(),
      metadata: body.metadata
        ? TaskMetadata.from(body.metadata)
        : TaskMetadata.empty(),
      assignee: body.assignee
        ? AgentRef.from(
            body.assignee.provider,
            body.assignee.agentId,
            body.assignee.model ?? null,
          )
        : null,
    };
  }
}
