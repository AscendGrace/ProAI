export interface Vulnerability {
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
  notes?: string
}

export interface ProjectInfo {
  rootName: string
  languages: string[]
  frameworks: string[]
  mcpIndicators: string[]
  fileStats: {
    totalFiles: number
    totalBytes: number
  }
}

export interface ScanOptions {
  model?: string
  apiKey?: string
  baseUrl?: string
  language?: 'zh' | 'en'
}

export interface ScanReport {
  scanId: string
  generatedAt: number
  project: ProjectInfo
  findings: Vulnerability[]
  score: {
    total: number
    riskLevel: 'critical' | 'high' | 'medium' | 'low'
  }
  markdown: string
}
