import { API_CONFIG } from "@/config/api";
import { apiStreamFetch, apiPost, apiGet } from "./api";

export interface OrchestrationQueryRequest {
    project_id: string;
    query: string;
    max_chunks?: number;
    source_filter?: 'confluence' | 'jira' | null;
    include_context?: boolean;
}

export interface Source {
    type: 'confluence' | 'jira';
    title: string;
    url: string;
    similarity: number;
}

export interface SSEEvent {
    type: 'chunk' | 'sources' | 'done' | 'error';
    content?: string;
    sources?: Source[];
    message?: string;
}

/**
 * Stream RAG query responses from the orchestration endpoint
 * Uses Server-Sent Events (SSE) for real-time streaming
 */
export async function* streamOrchestrationQuery(
    request: OrchestrationQueryRequest
): AsyncGenerator<SSEEvent, void, unknown> {
    const API_URL = `${API_CONFIG.BASE_URL}/api/orchestration/query`;

    try {
        const response = await apiStreamFetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                project_id: request.project_id,
                query: request.query,
                max_chunks: request.max_chunks || 10,
                source_filter: request.source_filter || null,
                include_context: request.include_context !== false,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        // Read SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
            throw new Error('Response body is not readable');
        }

        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            // Decode chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE messages
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        yield data as SSEEvent;
                    } catch (e) {
                        console.error('Failed to parse SSE data:', line, e);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Orchestration query error:', error);
        yield {
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}

/**
 * Trigger incremental sync for a project
 * Only syncs changed Confluence pages and Jira issues
 */
export async function triggerIncrementalSync(projectId: string): Promise<{
    success: boolean;
    message: string;
}> {
    const API_URL = `${API_CONFIG.BASE_URL}/api/sync/projects/${projectId}/sync`;

    try {
        const response = await apiPost(API_URL, {
            sync_type: 'incremental',
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return {
            success: true,
            message: data.message || 'Sync started successfully',
        };
    } catch (error) {
        console.error('Sync error:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to start sync',
        };
    }
}

/**
 * Get sync status for a project
 */
export async function getSyncStatus(projectId: string): Promise<{
    confluence_pages: number;
    jira_issues: number;
    total_embeddings: number;
} | null> {
    const API_URL = `${API_CONFIG.BASE_URL}/api/sync/projects/${projectId}/status`;

    try {
        const response = await apiGet(API_URL);

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to get sync status:', error);
        return null;
    }
}
