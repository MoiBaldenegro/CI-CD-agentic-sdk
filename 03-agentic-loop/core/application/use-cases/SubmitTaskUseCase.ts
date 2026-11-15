import { Task } from "../../domain/entities/Task.entity.js";
import { TaskRegistrationService } from "../../domain/services/TaskRegistrationService.js";
import { AcceptanceCriteria } from "../../domain/value-objects/AcceptanceCriteria.vo.js";
import { AgentRef } from "../../domain/value-objects/AgentRef.vo.js";
import { RepositoryRef } from "../../domain/value-objects/RepositoryRef.vo.js";
import { TaskDescription } from "../../domain/value-objects/TaskDescription.vo.js";
import { TaskMetadata } from "../../domain/value-objects/TaskMetadata.vo.js";
import { TaskPriority } from "../../domain/value-objects/TaskPriority.vo.js";
import { TaskSource } from "../../domain/value-objects/TaskSource.vo.js";
import { TaskSourceRef } from "../../domain/value-objects/TaskSourceRef.vo.js";
import { TaskTitle } from "../../domain/value-objects/TaskTitle.vo.js";
import type {
  SubmitTaskCommand,
  SubmitTaskPort,
  SubmitTaskResult,
} from "../inbound/SubmitTask.port.js";
import type { TaskPersistenceService } from "../services/TaskPersistenceService.js";

export class SubmitTaskUseCase implements SubmitTaskPort {
  private readonly registration: TaskRegistrationService;
  private readonly persistence: TaskPersistenceService;

  constructor(registration: TaskRegistrationService, persistence: TaskPersistenceService) {
    this.registration = registration;
    this.persistence = persistence;
  }

  async execute(command: SubmitTaskCommand): Promise<SubmitTaskResult> {
    const task = Task.create({
      title: TaskTitle.from(command.title),
      description: TaskDescription.from(command.description),
      source: TaskSource.from(command.source),
      repository: RepositoryRef.from(
        command.repository.owner,
        command.repository.name,
        command.repository.baseBranch,
      ),
      ...(command.sourceRef !== undefined && command.sourceRef !== null
        ? {
            sourceRef: TaskSourceRef.from(
              command.sourceRef.externalId,
              command.sourceRef.url,
            ),
          }
        : {}),
      ...(command.priority !== undefined
        ? { priority: TaskPriority.from(command.priority) }
        : {}),
      ...(command.acceptanceCriteria !== undefined
        ? { acceptanceCriteria: AcceptanceCriteria.from(command.acceptanceCriteria) }
        : {}),
      ...(command.metadata !== undefined
        ? { metadata: TaskMetadata.from(command.metadata) }
        : {}),
      ...(command.assignee !== undefined && command.assignee !== null
        ? {
            assignee: AgentRef.from(
              command.assignee.provider,
              command.assignee.agentId,
              command.assignee.model,
            ),
          }
        : {}),
    });

    await this.registration.ensureNotDuplicated(task);
    await this.persistence.save(task);

    return { taskId: task.id, version: task.version };
  }
}
