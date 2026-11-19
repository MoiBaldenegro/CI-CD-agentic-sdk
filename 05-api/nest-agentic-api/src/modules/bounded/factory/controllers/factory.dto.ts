export interface SendPromptRequest {
  text: string;
  provider?: string;
  agentId?: string;
  model?: string | null;
}

export interface RepositoryRequest {
  owner: string;
  name: string;
  baseBranch?: string;
}

export interface SourceRefRequest {
  externalId: string;
  url?: string | null;
}

export interface AgentRequest {
  provider: string;
  agentId: string;
  model?: string | null;
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  source?: string;
  repository: RepositoryRequest;
  sourceRef?: SourceRefRequest | null;
  priority?: string;
  acceptanceCriteria?: string[];
  metadata?: Record<string, string>;
  assignee?: AgentRequest | null;
}

export interface ApproveTaskRequest {
  completionSummary?: string;
}

export interface CancelTaskRequest {
  reason?: string;
}
