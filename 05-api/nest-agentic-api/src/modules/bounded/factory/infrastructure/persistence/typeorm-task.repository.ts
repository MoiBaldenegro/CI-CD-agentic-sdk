import { Injectable, Logger } from '@nestjs/common';
import type { TaskPrimitives } from 'lib/factory';
import type { TaskRepository } from 'lib/factory';
import { currentManager } from 'lib/persistence';
import { DataSource } from 'typeorm';
import { TaskOrmEntity } from './task.orm-entity';

@Injectable()
export class TypeOrmTaskRepository implements TaskRepository {
  private readonly logger = new Logger(TypeOrmTaskRepository.name);

  constructor(private readonly dataSource: DataSource) {}

  async save(task: TaskPrimitives): Promise<void> {
    const repository = currentManager(this.dataSource).getRepository(
      TaskOrmEntity,
    );
    await repository.save(this.toOrm(task));
    this.logger.log(`Guardada tarea id=${task.id} en Postgres`);
  }

  async getById(id: string): Promise<TaskPrimitives | null> {
    const repository = currentManager(this.dataSource).getRepository(
      TaskOrmEntity,
    );
    const entity = await repository.findOne({ where: { id } });
    this.logger.log(
      `Consulta tarea id=${id} en Postgres -> ${entity === null ? 'no encontrada' : 'encontrada'}`,
    );
    return entity ? this.toPrimitives(entity) : null;
  }

  async findAll(): Promise<TaskPrimitives[]> {
    const repository = currentManager(this.dataSource).getRepository(
      TaskOrmEntity,
    );
    const entities = await repository.find({ order: { createdAt: 'DESC' } });

    this.logger.log(`Listadas ${entities.length} tareas en Postgres`);

    return entities.map((entity) => this.toPrimitives(entity));
  }

  private toOrm(task: TaskPrimitives): TaskOrmEntity {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      source: task.source,
      sourceRef: task.sourceRef,
      repository: task.repository,
      assignee: task.assignee,
      acceptanceCriteria: task.acceptanceCriteria,
      metadata: task.metadata,
      blockReason: task.blockReason,
      failureReason: task.failureReason,
      cancellationReason: task.cancellationReason,
      completionSummary: task.completionSummary,
      createdAt: new Date(task.createdAt),
      updatedAt: new Date(task.updatedAt),
      version: task.version,
    };
  }

  private toPrimitives(entity: TaskOrmEntity): TaskPrimitives {
    return {
      id: entity.id,
      title: entity.title,
      description: entity.description,
      status: entity.status,
      priority: entity.priority,
      source: entity.source,
      sourceRef: entity.sourceRef,
      repository: entity.repository,
      assignee: entity.assignee,
      acceptanceCriteria: entity.acceptanceCriteria,
      metadata: entity.metadata,
      blockReason: entity.blockReason,
      failureReason: entity.failureReason,
      cancellationReason: entity.cancellationReason,
      completionSummary: entity.completionSummary,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      version: entity.version,
    };
  }
}
