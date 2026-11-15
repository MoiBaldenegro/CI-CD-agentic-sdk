import type { Task } from "../../domain/entities/Task.entity.js";
import { TaskNotFoundError } from "../../domain/exceptions/TaskNotFoundError.js";
import type { DomainEventPublisher } from "../../domain/outbound/DomainEventPublisher.port.js";
import type { TaskRepository } from "../../domain/outbound/TaskRepository.port.js";
import type { UnitOfWork } from "../../domain/outbound/UnitOfWork.port.js";
import type { TaskId } from "../../domain/value-objects/TaskId.vo.js";

export class TaskPersistenceService {
  private readonly repository: TaskRepository;
  private readonly eventPublisher: DomainEventPublisher;
  private readonly unitOfWork: UnitOfWork;

  constructor(
    repository: TaskRepository,
    eventPublisher: DomainEventPublisher,
    unitOfWork: UnitOfWork,
  ) {
    this.repository = repository;
    this.eventPublisher = eventPublisher;
    this.unitOfWork = unitOfWork;
  }

  async save(task: Task): Promise<void> {
    await this.unitOfWork.run(async () => {
      await this.repository.save(task);

      const events = task.pullDomainEvents();

      if (events.length > 0) {
        await this.eventPublisher.publish(events);
      }
    });
  }

  async getById(taskId: TaskId): Promise<Task> {
    const task = await this.repository.findById(taskId);

    if (task === null) {
      throw new TaskNotFoundError(taskId.value);
    }

    return task;
  }
}
