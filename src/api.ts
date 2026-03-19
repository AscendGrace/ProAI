import type {
  EvaluationListItem,
  EvaluationReport,
  EvaluatorSettings,
  LibraryType,
  McpScanListItem,
  McpScanReport,
  Overview,
  PromptItem,
  Provider,
} from './types'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export function getOverview() {
  return apiFetch<Overview>('/api/overview')
}

export function listEvaluations(query: string, standard: string, page: number, pageSize: number) {
  const params = new URLSearchParams()
  if (query.trim()) params.set('query', query.trim())
  if (standard && standard !== 'all') params.set('standard', standard)
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  return apiFetch<{
    items: EvaluationListItem[]
    total: number
    stats: { total: number; completed: number; failed: number; avgPassRate: number }
    typeCounts: Record<string, number>
  }>(`/api/evaluations?${params.toString()}`)
}

export function createEvaluation(input: {
  name: string
  standard: Exclude<LibraryType, 'all'>
  count: number
  target: { provider: Provider; baseUrl: string; apiKey?: string; model?: string }
}) {
  return apiFetch<{ id: string }>('/api/evaluations', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getEvaluationReport(id: string) {
  return apiFetch<EvaluationReport>(`/api/evaluations/${encodeURIComponent(id)}`)
}

export function deleteEvaluation(id: string) {
  return apiFetch<{ ok: true }>(`/api/evaluations/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function bulkDeleteEvaluations(ids: string[]) {
  return apiFetch<{ ok: true }>('/api/evaluations/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export function getPromptCounts() {
  return apiFetch<Record<string, number>>('/api/prompts/count')
}

export function listPrompts(library: LibraryType, query: string, page: number, pageSize: number) {
  const params = new URLSearchParams()
  params.set('library', library)
  if (query.trim()) params.set('query', query.trim())
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  return apiFetch<{ items: PromptItem[]; total: number }>(`/api/prompts?${params.toString()}`)
}

export function createPrompt(input: { library: Exclude<LibraryType, 'all'>; riskType: string; prompt: string }) {
  return apiFetch<{ id: string }>('/api/prompts', { method: 'POST', body: JSON.stringify(input) })
}

export function deletePrompt(id: string) {
  return apiFetch<{ ok: true }>(`/api/prompts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function bulkDeletePrompts(ids: string[]) {
  return apiFetch<{ ok: true }>('/api/prompts/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export function importPrompts(input: { library: Exclude<LibraryType, 'all'>; csv: string }) {
  return apiFetch<{ inserted: number }>('/api/prompts/import', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getEvaluatorSettings() {
  return apiFetch<EvaluatorSettings>('/api/settings/evaluator')
}

export function saveEvaluatorSettings(settings: EvaluatorSettings) {
  return apiFetch<{ ok: true }>('/api/settings/evaluator', {
    method: 'POST',
    body: JSON.stringify(settings),
  })
}

export function testModelConnection(input: { provider: Provider; baseUrl: string; apiKey?: string; model?: string }) {
  return apiFetch<{ ok: boolean; latencyMs?: number; outputPreview?: string; error?: string }>('/api/models/test', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function testEvaluatorConnection() {
  return apiFetch<{ ok: boolean; latencyMs?: number; outputPreview?: string; error?: string }>(
    '/api/settings/evaluator/test',
  )
}

export function testEvaluationConnections(id: string) {
  return apiFetch<{
    target: { ok: boolean; latencyMs?: number; outputPreview?: string; error?: string }
    evaluator: { ok: boolean; latencyMs?: number; outputPreview?: string; error?: string }
  }>(`/api/evaluations/${encodeURIComponent(id)}/conn-test`)
}

// MCP 扫描 API
export function listMcpScans(query = '', page = 1, pageSize = 10) {
  return apiFetch<{ items: McpScanListItem[]; total: number }>(`/api/mcp-scans?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`)
}

export async function uploadMcpScan(file: File, options?: { name?: string; model?: string; apiKey?: string; baseUrl?: string }) {
  const formData = new FormData()
  formData.append('file', file)
  if (options?.name) formData.append('name', options.name)
  if (options?.model) formData.append('model', options.model)
  if (options?.apiKey) formData.append('apiKey', options.apiKey)
  if (options?.baseUrl) formData.append('baseUrl', options.baseUrl)

  const res = await fetch('/api/mcp-scans/upload', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  return (await res.json()) as { scanId: string }
}

export function getMcpScanReport(scanId: string) {
  return apiFetch<McpScanReport>(`/api/mcp-scans/${encodeURIComponent(scanId)}/report`)
}

export function getMcpScanStatus(scanId: string) {
  return apiFetch<McpScanListItem>(`/api/mcp-scans/${encodeURIComponent(scanId)}`)
}

export function deleteMcpScan(scanId: string) {
  return apiFetch<{ ok: true }>(`/api/mcp-scans/${encodeURIComponent(scanId)}`, { method: 'DELETE' })
}

export function startMcpScan(scanId: string, fileId: string) {
  return apiFetch<{ ok: true }>(`/api/mcp-scans/${encodeURIComponent(scanId)}/start`, {
    method: 'POST',
    body: JSON.stringify({ fileId }),
  })
}
