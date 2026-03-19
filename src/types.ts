export type LibraryType = 'tc260' | 'general' | 'custom' | 'all'
export type Provider = 'ollama' | 'openai'

export type Overview = {
  recentEvaluations: Array<{
    id: string
    name: string
    standard: Exclude<LibraryType, 'all'>
    status: string
    passRate: number
    createdAt: number
  }>
  recentMcpScans: Array<{
    id: string
    name: string
    status: string
    createdAt: number
  }>
  passRate30d: number
  arsenalCounts: Record<string, number>
  trend: Array<{ day: string; cnt: number; passRate: number }>
  mcpTrend: Array<{ day: string; cnt: number }>
}

export type PromptItem = {
  id: string
  library: Exclude<LibraryType, 'all'>
  riskType: string
  riskSubType?: string
  prompt: string
  createdAt: number
}

export type EvaluationListItem = {
  id: string
  name: string
  standard: Exclude<LibraryType, 'all'>
  status: string
  passRate: number
  totalCount: number
  passCount: number
  failCount: number
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
  error: string | null
}

export type EvaluationReport = {
  evaluation: EvaluationListItem & {
    targetProvider?: Provider
    targetBaseUrl?: string
    targetModel?: string | null
  }
  items: Array<{
    id: string
    inputPrompt: string
    riskType: string
    riskSubType?: string
    modelOutput: string
    evaluatorScore: number | null
    evaluatorRawOutput: string | null
    createdAt: number
  }>
}

export type EvaluatorSettings = {
  provider: Provider
  baseUrl: string
  apiKey: string
  model?: string
  systemPrompt: string
}

// MCP 扫描相关类型
export type McpScanStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed'

export type McpScanProgress = {
  stage: string
  percent: number
}

export type McpScanListItem = {
  id: string
  name?: string
  originalFilename: string
  status: McpScanStatus
  progress: McpScanProgress
  createdAt: number
  error?: string
  scoreTotal?: number
  scoreRiskLevel?: 'low' | 'medium' | 'high' | 'critical'
  judgeModel?: string
  judgeBaseUrl?: string
}

export type McpVulnerability = {
  id: string
  title: string
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  status: 'confirmed' | 'likely' | 'needs_review' | 'false_positive'
  description: string
  impact: string
  evidence: Array<{
    file: string
    lineStart?: number
    lineEnd?: number
    snippet?: string
  }>
  exploitation: string
  remediation: string
  confidence: number
}

export type McpScanReport = {
  scanId: string
  generatedAt: number
  project: {
    rootName: string
    languages: string[]
    frameworks: string[]
    mcpIndicators: string[]
    fileStats: {
      totalFiles: number
      totalBytes: number
    }
  }
  findings: McpVulnerability[]
  score: {
    total: number
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  }
  markdown: string
}
