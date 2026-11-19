import { Injectable, Logger } from '@nestjs/common';
import type { TaskPrimitives } from 'lib/factory';
import type { TaskRepository } from 'lib/factory';

@Injectable()
export class InMemoryTaskRepository implements TaskRepository {
  private readonly logger = new Logger(InMemoryTaskRepository.name);
  private readonly tasks = new Map<string, TaskPrimitives>();

  async save(task: TaskPrimitives): Promise<void> {
    this.tasks.set(task.id, structuredClone(task));
    this.logger.log(`Guardada tarea id=${task.id} (total=${this.tasks.size})`);
  }

  async getById(id: string): Promise<TaskPrimitives | null> {
    const task = this.tasks.get(id);
    this.logger.log(
      `Consulta tarea id=${id} -> ${task === undefined ? 'no encontrada' : 'encontrada'}`,
    );
    return task ? structuredClone(task) : null;
  }

  async findAll(): Promise<TaskPrimitives[]> {
    const tasks = [...this.tasks.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((task) => structuredClone(task));

    this.logger.log(`Listadas ${tasks.length} tareas en memoria`);

    return tasks;
  }
}
