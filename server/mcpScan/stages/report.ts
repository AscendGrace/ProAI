import type { ScanReport, Vulnerability } from '../types'

export function calcScore(findings: Vulnerability[]): ScanReport['score'] {
  const weights: Record<Vulnerability['severity'], number> = {
    critical: 25,
    high: 15,
    medium: 8,
    low: 3,
    info: 1,
  }

  let total = 0
  for (const finding of findings) {
    if (finding.status === 'false_positive') {
      continue
    }

    const base = weights[finding.severity] ?? 0
    const multiplier = finding.status === 'confirmed' ? 1.0 : finding.status === 'likely' ? 0.7 : 0.4
    total += base * multiplier * (0.5 + 0.5 * clamp01(finding.confidence))
  }

  total = Math.round(total)

  const riskLevel: ScanReport['score']['riskLevel'] =
    total >= 60 ? 'critical' : total >= 35 ? 'high' : total >= 15 ? 'medium' : 'low'

  return { total, riskLevel }
}

export function buildReportMarkdown(input: {
  scanId: string
  project: ScanReport['project']
  findings: Vulnerability[]
  score: ScanReport['score']
}): string {
  const { scanId, project, findings, score } = input
  const lines: string[] = []

  const riskLevelMap: Record<string, string> = {
    critical: '严重',
    high: '高',
    medium: '中',
    low: '低',
    safe: '安全',
  }

  const severityMap: Record<string, string> = {
    critical: '严重',
    high: '高',
    medium: '中',
    low: '低',
    info: '信息',
  }

  const statusMap: Record<string, string> = {
    confirmed: '已确认',
    likely: '较可能',
    needs_review: '待复核',
    false_positive: '误报',
  }

  lines.push('# MCP 扫描报告')
  lines.push('')
  lines.push(`- 扫描 ID: ${scanId}`)
  lines.push(`- 项目: ${project.rootName}`)
  lines.push(`- 语言: ${project.languages.join(', ') || '未知'}`)
  lines.push(`- 框架: ${project.frameworks.join(', ') || '未知'}`)
  lines.push(`- MCP 指标: ${project.mcpIndicators.join(', ') || '无'}`)
  lines.push(`- 评分: ${score.total} (${score.total === 0 ? '安全' : riskLevelMap[score.riskLevel] || score.riskLevel})`)
  lines.push('')
  lines.push('## 评分标准')
  lines.push('')
  lines.push('**状态说明**')
  lines.push('')
  lines.push('- 已确认：漏洞经复核确认真实存在且可利用；')
  lines.push('- 较可能：大概率存在但未完全确认；')
  lines.push('- 已复核/待复核：需要人工进一步判断；')
  lines.push('- 误报：经复核排除，不计入评分')
  lines.push('')
  lines.push('**评分公式**')
  lines.push('')
  lines.push('单项得分 = 基础分 × 状态系数 × (0.5 + 0.5 × 置信度)，总分为各项累加')
  lines.push('')
  lines.push('- 基础分：严重 25、高危 15、中危 8、低危 3、信息 1')
  lines.push('- 状态系数：已确认 1.0、较可能 0.7、已复核/待复核 0.4、误报不计分')
  lines.push('')
  lines.push('**风险等级判定**')
  lines.push('')
  lines.push('- 总分 ≥ 60：严重；')
  lines.push('- 总分 ≥ 35：高危；')
  lines.push('- 总分 ≥ 15：中危；')
  lines.push('- 总分 < 15：低危；')
  lines.push('')
  lines.push(`## 发现问题 (${findings.length})`)
  lines.push('')

  for (const finding of findings) {
    lines.push(`### ${finding.id}: ${finding.title}`)
    lines.push('')
    lines.push(`- 严重程度: ${severityMap[finding.severity] || finding.severity}`)
    lines.push(`- 状态: ${statusMap[finding.status] || finding.status}`)
    lines.push(`- 类别: ${finding.category}`)
    lines.push(`- 置信度: ${Math.round(clamp01(finding.confidence) * 100)}%`)
    lines.push('')
    lines.push('**描述**')
    lines.push('')
    lines.push(finding.description || '-')
    lines.push('')
    lines.push('**影响**')
    lines.push('')
    lines.push(finding.impact || '-')
    lines.push('')
    lines.push('**证据**')
    lines.push('')

    if (finding.evidence.length) {
      for (const evidence of finding.evidence) {
        const location =
          typeof evidence.lineStart === 'number'
            ? `${evidence.file}:${evidence.lineStart}${typeof evidence.lineEnd === 'number' ? `-${evidence.lineEnd}` : ''}`
            : evidence.file

        lines.push(`- ${location}`)
        if (evidence.snippet) {
          lines.push('')
          lines.push('```')
          lines.push(evidence.snippet.trimEnd())
          lines.push('```')
          lines.push('')
        }
      }
    } else {
      lines.push('- (无)')
    }

    lines.push('')
    lines.push('**利用方式**')
    lines.push('')
    lines.push(finding.exploitation || '-')
    lines.push('')
    lines.push('**修复建议**')
    lines.push('')
    lines.push(finding.remediation || '-')
    lines.push('')

    if (finding.notes) {
      lines.push('**备注**')
      lines.push('')
      lines.push(finding.notes)
      lines.push('')
    }
  }

  return lines.join('\n')
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}
