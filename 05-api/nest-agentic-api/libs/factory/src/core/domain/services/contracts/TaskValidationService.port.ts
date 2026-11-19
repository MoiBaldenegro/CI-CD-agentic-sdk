import type { TaskPrimitives } from '../../Task.entity.js';

export interface TaskValidationServicePort {
  validateId(task: TaskPrimitives): void;
  validateContent(task: TaskPrimitives): void;
  validateSourceReference(task: TaskPrimitives): void;
  validate(task: TaskPrimitives): void;
}
