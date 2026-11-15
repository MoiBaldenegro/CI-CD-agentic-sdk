import type { CreateTaskProps, TaskPrimitives } from "../../domain/Task.entity.js";
import { CreateTaskUseCase } from "../use-cases/CreateTask.use-case.js";
import { GetTaskUseCase } from "../use-cases/GetTask.use-case.js";

export class TaskApplicationService {
  constructor(
    private readonly createTaskUseCase: CreateTaskUseCase,
    private readonly getTaskUseCase: GetTaskUseCase,
  ) {}

  createTask(props: CreateTaskProps): TaskPrimitives {
    return this.createTaskUseCase.execute(props);
  }

  getTask(id: string): TaskPrimitives | null {
    return this.getTaskUseCase.execute(id);
  }
}
