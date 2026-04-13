import { API_CONFIG } from '@/config/api';
import { apiPost } from './api';

const BACKEND = API_CONFIG.BASE_URL;

export interface HarnessConfig {
  apiKey: string;
  accountId: string;
}

export interface HarnessCredentials {
  apiKey: string;
  accountId: string;
  orgId: string;
  projectId: string;
}

// Extract account ID from PAT token: pat.{accountId}.{tokenId}.{secret}
export function extractAccountId(apiKey: string): string {
  const parts = apiKey.split('.');
  if (parts.length >= 2 && parts[0] === 'pat') return parts[1];
  return '';
}

export function buildConfig(apiKey: string): HarnessConfig {
  return { apiKey, accountId: extractAccountId(apiKey) };
}

export interface HarnessProject {
  identifier: string;
  name: string;
  orgIdentifier: string;
  modules: string[];
  description?: string;
}

export interface HarnessPipeline {
  identifier: string;
  name: string;
  description?: string;
  tags?: Record<string, string>;
  storeType?: string;
  createdAt?: number;
  lastUpdatedAt?: number;
  executionSummaryInfo?: {
    lastExecutionStatus?: string;
    lastExecutionTs?: number;
  };
}

export interface HarnessOrg {
  identifier: string;
  name: string;
  description?: string;
}

export interface HarnessPipelineExecution {
  planExecutionId: string;
  name: string;
  status: string;
  startTs?: number;
  endTs?: number;
  pipelineIdentifier: string;
  runSequence: number;
}

// ─── Backend proxy calls (avoids CORS) ────────────────────────────────────────

function body(config: HarnessConfig, extra: Record<string, any> = {}) {
  return {
    api_key: config.apiKey.trim(),
    account_id: config.accountId.trim(),
    ...extra,
  };
}

async function post<T>(path: string, payload: object): Promise<T> {
  const res = await apiPost(`${BACKEND}${path}`, payload);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function getAccount(config: HarnessConfig) {
  return post<any>('/api/harness/account', body(config));
}

export async function listOrganizations(config: HarnessConfig): Promise<HarnessOrg[]> {
  return post<HarnessOrg[]>('/api/harness/organizations', body(config));
}

export async function listProjects(config: HarnessConfig, orgId?: string): Promise<HarnessProject[]> {
  return post<HarnessProject[]>('/api/harness/projects', body(config, { org_id: orgId }));
}

export async function listPipelines(
  config: HarnessConfig,
  orgId: string,
  projectId: string
): Promise<HarnessPipeline[]> {
  return post<HarnessPipeline[]>('/api/harness/pipelines', body(config, { org_id: orgId, project_id: projectId }));
}

export interface PipelineDetail {
  metadata: {
    identifier: string;
    name: string;
    description?: string;
    tags?: Record<string, string>;
    storeType?: string;
    created?: number;
    updated?: number;
  };
  yaml: string;
  recent_executions: HarnessPipelineExecution[];
}

export interface FailedNode {
  name: string;
  identifier: string;
  type: string;
  status: string;
  startTs?: number;
  endTs?: number;
  errorMessage?: string;
  failureType?: string[];
}

export interface StageInfo {
  name: string;
  identifier: string;
  status: string;
  startTs?: number;
  endTs?: number;
  errorMessage?: string;
}

export interface ExecutionLogs {
  executionId: string;
  pipelineIdentifier: string;
  pipelineName: string;
  status: string;
  startTs?: number;
  endTs?: number;
  triggerType?: string;
  triggeredBy?: string;
  errorMessage?: string;
  stages: StageInfo[];
  failed_nodes: FailedNode[];
}

export async function getExecutionLogs(
  config: HarnessConfig,
  orgId: string,
  projectId: string,
  executionId: string
): Promise<ExecutionLogs> {
  return post<ExecutionLogs>('/api/harness/execution-logs', body(config, {
    org_id: orgId,
    project_id: projectId,
    execution_id: executionId,
  }));
}

export async function getPipelineDetail(
  config: HarnessConfig,
  orgId: string,
  projectId: string,
  pipelineId: string
): Promise<PipelineDetail> {
  return post<PipelineDetail>('/api/harness/pipeline-detail', body(config, {
    org_id: orgId,
    project_id: projectId,
    pipeline_id: pipelineId,
  }));
}

export async function listPipelineExecutions(
  config: HarnessConfig,
  orgId: string,
  projectId: string
): Promise<HarnessPipelineExecution[]> {
  return post<HarnessPipelineExecution[]>('/api/harness/executions', body(config, { org_id: orgId, project_id: projectId }));
}

export async function testAidaGenerate(
  config: HarnessConfig,
  orgId: string,
  projectId: string,
  prompt: string
): Promise<{ status_code: number; endpoint: string; response: any }> {
  return post<any>('/api/harness/aida/generate-pipeline', body(config, {
    org_id: orgId,
    project_id: projectId,
    prompt,
  }));
}

export interface PipelineCodebase {
  connector_ref: string;
  repo_name: string;
  default_branch: string;
  build_type: string;
  branch_value: string;
  is_runtime_input: boolean;
  store_type: string;
  git_branch: string;
}

export async function getPipelineCodebase(
  config: HarnessConfig,
  orgId: string,
  projectId: string,
  pipelineId: string
): Promise<PipelineCodebase> {
  return post<PipelineCodebase>('/api/harness/pipeline-codebase', body(config, {
    org_id: orgId,
    project_id: projectId,
    pipeline_id: pipelineId,
  }));
}

export async function getRepoBranches(
  config: HarnessConfig,
  orgId: string,
  projectId: string,
  connectorRef: string,
  repoName: string
): Promise<string[]> {
  const result = await post<{ branches: string[] }>('/api/harness/repo-branches', body(config, {
    org_id: orgId,
    project_id: projectId,
    connector_ref: connectorRef,
    repo_name: repoName,
  }));
  return result.branches;
}

export interface PipelineTrigger {
  identifier: string;
  name: string;
  type: string;
  enabled: boolean;
  webhookUrl: string;
  webhookSecret: string;
}

export async function getPipelineTriggers(
  config: HarnessConfig,
  orgId: string,
  projectId: string,
  pipelineId: string
): Promise<{ triggers: PipelineTrigger[] }> {
  return post('/api/harness/pipeline-triggers', body(config, {
    org_id: orgId,
    project_id: projectId,
    pipeline_id: pipelineId,
  }));
}

export interface PipelineInputSet {
  identifier: string;
  name: string;
  description: string;
  inputSetType: string;
  tags: Record<string, string>;
}

export async function getTriggerDetail(
  config: HarnessConfig,
  orgId: string,
  projectId: string,
  pipelineId: string,
  triggerId: string
): Promise<{ yaml: string; name: string; type: string; enabled: boolean }> {
  return post('/api/harness/trigger-detail', body(config, {
    org_id: orgId,
    project_id: projectId,
    pipeline_id: pipelineId,
    trigger_id: triggerId,
  }));
}

export async function getInputSetDetail(
  config: HarnessConfig,
  orgId: string,
  projectId: string,
  pipelineId: string,
  inputSetId: string
): Promise<{ yaml: string; name: string; inputSetType: string }> {
  return post('/api/harness/input-set-detail', body(config, {
    org_id: orgId,
    project_id: projectId,
    pipeline_id: pipelineId,
    input_set_id: inputSetId,
  }));
}

export async function getPipelineInputSets(
  config: HarnessConfig,
  orgId: string,
  projectId: string,
  pipelineId: string
): Promise<{ inputSets: PipelineInputSet[] }> {
  return post('/api/harness/pipeline-input-sets', body(config, {
    org_id: orgId,
    project_id: projectId,
    pipeline_id: pipelineId,
  }));
}

export async function triggerViaWebhook(
  config: HarnessConfig,
  orgId: string,
  projectId: string,
  pipelineId: string,
  branch: string
): Promise<{ status: string; method: string; trigger: string }> {
  return post(`/api/harness/trigger-via-webhook?branch=${encodeURIComponent(branch)}`, body(config, {
    org_id: orgId,
    project_id: projectId,
    pipeline_id: pipelineId,
  }));
}

export async function triggerProbe(
  config: HarnessConfig,
  orgId: string,
  projectId: string,
  pipelineId: string,
  branch?: string
): Promise<{ pipeline_id: string; branch: string; results: any[] }> {
  return post('/api/harness/trigger-probe', body(config, {
    org_id: orgId,
    project_id: projectId,
    pipeline_id: pipelineId,
    branch: branch || 'main',
  }));
}

export async function triggerExecution(
  config: HarnessConfig,
  orgId: string,
  projectId: string,
  pipelineId: string,
  branch?: string,
  notes?: string
): Promise<{ execution_id: string; status: string }> {
  return post('/api/harness/trigger-execution', body(config, {
    org_id: orgId,
    project_id: projectId,
    pipeline_id: pipelineId,
    branch: branch || 'main',
    notes: notes || '',
  }));
}

export async function updatePipeline(
  config: HarnessConfig,
  orgId: string,
  projectId: string,
  pipelineId: string,
  yaml: string
): Promise<{ success: boolean; message: string }> {
  return post('/api/harness/update-pipeline', body(config, {
    org_id: orgId,
    project_id: projectId,
    pipeline_id: pipelineId,
    yaml,
  }));
}

export interface PipelineAnalysis {
  pipeline_type: "CI" | "CD";
  failing_step: string;
  failing_step_identifier: string;
  root_cause: string;
  proposed_changes: {
    field: string;
    current_value: string;
    proposed_value: string;
    reason: string;
  }[];
}

export async function aiAnalyzePipeline(
  config: HarnessConfig,
  yaml: string,
  errorContext: string
): Promise<PipelineAnalysis> {
  return post('/api/harness/ai-analyze-pipeline', body(config, { yaml, error_context: errorContext }));
}

export async function aiEditPipeline(
  config: HarnessConfig,
  yaml: string,
  instruction: string
): Promise<{ yaml: string }> {
  return post('/api/harness/ai-edit-pipeline', body(config, { yaml, instruction }));
}

export async function aiSummarizeLogs(
  config: HarnessConfig,
  executionData: ExecutionLogs
): Promise<{ summary: string }> {
  return post('/api/harness/ai-summarize-logs', body(config, { execution_data: executionData }));
}

// ─── IDP (Internal Developer Portal) ─────────────────────────────────────────

export interface IdpEntity {
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    description?: string;
    tags?: string[];
    links?: { url: string; title: string }[];
  };
  spec?: {
    type?: string;
    lifecycle?: string;
    owner?: string;
    system?: string;
    language?: string;
  };
}

export interface IdpScorecard {
  id?: string;
  name: string;
  description?: string;
  totalScore?: number;
  maxScore?: number;
  components?: number;
  checks?: { name: string; passing: boolean; weight?: number }[];
}

export interface IdpWorkflow {
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  kind?: string;
  metadata?: { name: string; description?: string; tags?: string[] };
  spec?: { type?: string };
}

function idpBody(config: HarnessConfig) {
  return body(config);
}

export async function idpListCatalog(config: HarnessConfig): Promise<{ entities: IdpEntity[]; error?: string }> {
  return post('/api/harness/idp/catalog', idpBody(config));
}

export async function idpListScorecards(config: HarnessConfig): Promise<{ scorecards: IdpScorecard[]; error?: string }> {
  return post('/api/harness/idp/scorecards', idpBody(config));
}

export async function idpListWorkflows(config: HarnessConfig): Promise<{ workflows: IdpWorkflow[]; error?: string }> {
  return post('/api/harness/idp/workflows', idpBody(config));
}

// ─── Query intent parser ───────────────────────────────────────────────────────

export type QueryIntent = 'account' | 'organizations' | 'projects' | 'pipelines' | 'executions' | 'unknown';

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ChatToolCall {
  name: string;
  input: Record<string, any>;
}

export async function harnessChat(
  config: HarnessConfig,
  orgId: string,
  projectId: string,
  message: string,
  history: any[]
): Promise<{ answer: string; tool_calls: ChatToolCall[]; history: any[] }> {
  return post('/api/harness/chat', {
    api_key: config.apiKey.trim(),
    account_id: config.accountId.trim(),
    org_id: orgId,
    project_id: projectId,
    message,
    history,
  });
}

export function parseQueryIntent(query: string): QueryIntent {
  const q = query.toLowerCase();
  if (/account|profile|plan|info/.test(q)) return 'account';
  if (/org|organisation|organization/.test(q)) return 'organizations';
  if (/project/.test(q)) return 'projects';
  if (/execution|run|history|deploy|status/.test(q)) return 'executions';
  if (/pipeline/.test(q)) return 'pipelines';
  return 'unknown';
}
