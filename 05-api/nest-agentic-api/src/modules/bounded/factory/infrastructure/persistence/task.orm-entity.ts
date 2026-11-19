import { Column, Entity, PrimaryColumn } from 'typeorm';

export interface TaskSourceRefJson {
  externalId: string;
  url: string | null;
}

export interface TaskRepositoryRefJson {
  owner: string;
  name: string;
  baseBranch: string;
}

export interface TaskAssigneeJson {
  provider: string;
  agentId: string;
  model: string | null;
}

@Entity({ name: 'tasks' })
export class TaskOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: string;

  @Column({ type: 'varchar', length: 32 })
  priority!: string;

  @Column({ type: 'varchar', length: 32 })
  source!: string;

  @Column({ name: 'source_ref', type: 'jsonb', nullable: true })
  sourceRef!: TaskSourceRefJson | null;

  @Column({ type: 'jsonb' })
  repository!: TaskRepositoryRefJson;

  @Column({ type: 'jsonb', nullable: true })
  assignee!: TaskAssigneeJson | null;

  @Column({ name: 'acceptance_criteria', type: 'jsonb' })
  acceptanceCriteria!: string[];

  @Column({ type: 'jsonb' })
  metadata!: Record<string, string>;

  @Column({ name: 'block_reason', type: 'text', nullable: true })
  blockReason!: string | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason!: string | null;

  @Column({ name: 'completion_summary', type: 'text', nullable: true })
  completionSummary!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'int' })
  version!: number;
}
