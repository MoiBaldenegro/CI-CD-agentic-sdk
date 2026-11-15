import { Task, type CreateTaskProps, type TaskPrimitives } from "../Task.entity.js";
import type { TaskCreationServicePort } from "./contracts/TaskCreationService.port.js";
import type { TaskValidationServicePort } from "./contracts/TaskValidationService.port.js";

export class TaskCreationService implements TaskCreationServicePort {
  constructor(private readonly validationService: TaskValidationServicePort) {}

  create(props: CreateTaskProps): TaskPrimitives {
    const task = Task.create(props);
    this.validationService.validate(task);
    return task;
  }
}
