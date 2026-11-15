import type { TaskId } from "../../domain/value-objects/TaskId.vo.js";

export interface SubmitTaskSourceRef {
  readonly externalId: string;
  readonly url: string | null;
}

export interface SubmitTaskRepository {
  readonly owner: string;
  readonly name: string;
  readonly baseBranch: string;
}

export interface SubmitTaskAssignee {
  readonly provider: string;
  readonly agentId: string;
  readonly model: string | null;
}

export interface SubmitTaskCommand {
  readonly title: string;
  readonly description: string;
  readonly source: string;
  readonly sourceRef?: SubmitTaskSourceRef | null;
  readonly repository: SubmitTaskRepository;
  readonly priority?: string;
  readonly acceptanceCriteria?: readonly string[];
  readonly metadata?: Readonly<Record<string, string>>;
  readonly assignee?: SubmitTaskAssignee | null;
}

export interface SubmitTaskResult {
  readonly taskId: TaskId;
  readonly version: number;
}

export interface SubmitTaskPort {
  execute(command: SubmitTaskCommand): Promise<SubmitTaskResult>;
}
