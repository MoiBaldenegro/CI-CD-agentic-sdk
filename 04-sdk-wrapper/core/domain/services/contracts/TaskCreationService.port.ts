import type { CreateTaskProps, TaskPrimitives } from "../../Task.entity.js";

export interface TaskCreationServicePort {
  create(props: CreateTaskProps): TaskPrimitives;
}
