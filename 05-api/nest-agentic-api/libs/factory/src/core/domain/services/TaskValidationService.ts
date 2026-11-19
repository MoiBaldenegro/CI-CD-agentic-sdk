import type { TaskPrimitives } from '../Task.entity.js';
import { DomainValidationError } from '../exceptions/DomainValidationError.js';
import type { TaskValidationServicePort } from './contracts/TaskValidationService.port.js';

const SOURCES_REQUIRING_REFERENCE = new Set([
  'GITHUB_ISSUE',
  'GITLAB_ISSUE',
  'JIRA_ISSUE',
]);

export class TaskValidationService implements TaskValidationServicePort {
  validateId(task: TaskPrimitives): void {
    if (task.id.trim().length === 0) {
      throw new DomainValidationError(
        'TASK_ID_EMPTY',
        'Task id must not be empty',
      );
    }
  }

  validateContent(task: TaskPrimitives): void {
    if (task.title.trim().length === 0) {
      throw new DomainValidationError(
        'TASK_TITLE_EMPTY',
        'Task title must not be empty',
      );
    }

    if (task.description.trim().length === 0) {
      throw new DomainValidationError(
        'TASK_DESCRIPTION_EMPTY',
        'Task description must not be empty',
      );
    }
  }

  validateSourceReference(task: TaskPrimitives): void {
    if (
      SOURCES_REQUIRING_REFERENCE.has(task.source) &&
      task.sourceRef === null
    ) {
      throw new DomainValidationError(
        'TASK_SOURCE_REFERENCE_REQUIRED',
        `Task source ${task.source} requires a source reference`,
      );
    }
  }

  validate(task: TaskPrimitives): void {
    this.validateId(task);
    this.validateContent(task);
    this.validateSourceReference(task);
  }
}
