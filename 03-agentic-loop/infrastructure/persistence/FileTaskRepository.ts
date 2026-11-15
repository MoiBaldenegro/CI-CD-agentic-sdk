import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Task } from "../../core/domain/entities/Task.entity.js";
import type { TaskPrimitives } from "../../core/domain/entities/Task.entity.js";
import type { TaskRepository } from "../../core/domain/outbound/TaskRepository.port.js";
import { TaskPrioritizationService } from "../../core/domain/services/TaskPrioritizationService.js";
import type { TaskId } from "../../core/domain/value-objects/TaskId.vo.js";
import type { TaskStatus } from "../../core/domain/value-objects/TaskStatus.vo.js";

export class FileTaskRepository implements TaskRepository {
  private readonly filePath: string;
  private readonly prioritization = new TaskPrioritizationService();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async save(task: Task): Promise<void> {
    const tasks = await this.loadAll();
    const index = tasks.findIndex((stored) => stored.id.equals(task.id));

    if (index >= 0) {
      tasks[index] = task;
    } else {
      tasks.push(task);
    }

    await this.writeAll(tasks);
  }

  async findById(id: TaskId): Promise<Task | null> {
    const tasks = await this.loadAll();
    return tasks.find((task) => task.id.equals(id)) ?? null;
  }

  async findBySourceRef(source: string, externalId: string): Promise<Task | null> {
    const tasks = await this.loadAll();

    return (
      tasks.find(
        (task) => task.source.value === source && task.sourceRef?.externalId === externalId,
      ) ?? null
    );
  }

  async findByStatus(status: TaskStatus, limit = 100): Promise<readonly Task[]> {
    const tasks = await this.loadAll();
    return tasks.filter((task) => task.status.equals(status)).slice(0, limit);
  }

  async findAll(limit = 100): Promise<readonly Task[]> {
    const tasks = await this.loadAll();
    return tasks.slice(0, limit);
  }

  async findNext(limit = 5): Promise<readonly Task[]> {
    const tasks = await this.loadAll();
    const queueable = tasks.filter((task) => this.prioritization.isQueueable(task));
    return this.prioritization.prioritize(queueable).slice(0, limit);
  }

  async delete(id: TaskId): Promise<void> {
    const tasks = await this.loadAll();
    await this.writeAll(tasks.filter((task) => !task.id.equals(id)));
  }

  private async loadAll(): Promise<Task[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const primitives = JSON.parse(raw) as TaskPrimitives[];
      return primitives.map((primitive) => Task.fromPrimitives(primitive));
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  private async writeAll(tasks: readonly Task[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });

    const payload = tasks.map((task) => task.toPrimitives());
    const temporaryPath = `${this.filePath}.tmp`;

    await writeFile(temporaryPath, JSON.stringify(payload, null, 2), "utf8");
    await rename(temporaryPath, this.filePath);
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
