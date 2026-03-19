import { promises as fs } from 'fs'
import path from 'path'
import type { McpScanStore } from './mcpScanStore.js'
import type { ScanOptions } from './mcpScan/types.js'
import { unzipToDirectory } from './mcpScan/util/unzip.js'
import { analyzeProject } from './mcpScan/stages/analyzeProject.js'
import { runAiAudit } from './mcpScan/stages/runAiAudit.js'
import { reviewExploitability } from './mcpScan/stages/reviewExploitability.js'
import { buildReportMarkdown, calcScore } from './mcpScan/stages/report.js'

export async function runMcpScan(input: {
  scanId: string
  zipBuffer: Buffer
  store: McpScanStore
  options?: { model?: string; apiKey?: string; baseUrl?: string }
}) {
  const { scanId, zipBuffer, store, options } = input
  const extractDir = path.join('temp', 'mcp-scans', scanId)

  try {
    await store.updateStatus(scanId, 'running', 'unpacking', 5)
    await store.log(scanId, 'info', '开始解压文件 / Unpacking archive...')
    await unzipToDirectory(zipBuffer, extractDir)
    await store.log(scanId, 'info', '解压完成 / Extraction complete')
    await store.updateStatus(scanId, 'running', 'unpacking', 10)

    await store.updateStatus(scanId, 'running', 'project_analysis', 15)
    await store.log(scanId, 'info', '正在分析项目结构 / Analyzing project structure...')
    const project = await analyzeProject({ rootDir: extractDir, scanStore: store, scanId })
    await store.log(scanId, 'info', `项目分析完成: ${project.languages.join(', ')} / Project analysis complete`)
    await store.updateStatus(scanId, 'running', 'project_analysis', 25)

    await store.updateStatus(scanId, 'running', 'ai_audit', 30)
    await store.log(scanId, 'info', '正在进行 AI 安全评估 / Running AI security audit...')
    await store.log(scanId, 'info', `使用模型: ${options?.model || 'gpt-4o'}`)
    const scanOptions: ScanOptions = { model: options?.model, apiKey: options?.apiKey, baseUrl: options?.baseUrl }
    const initialFindings = await runAiAudit({ rootDir: extractDir, project, scanStore: store, scanId, options: scanOptions })
    await store.log(
      scanId,
      'info',
      `AI 安全评估完成，发现 ${initialFindings.length} 个潜在问题 / AI audit found ${initialFindings.length} potential issues`,
    )
    await store.updateStatus(scanId, 'running', 'ai_audit', 55)

    await store.updateStatus(scanId, 'running', 'exploitability_review', 60)
    await store.log(scanId, 'info', '正在复核可利用性 / Reviewing exploitability...')
    const reviewedFindings = await reviewExploitability({
      rootDir: extractDir,
      project,
      findings: initialFindings,
      scanStore: store,
      scanId,
      options: scanOptions,
    })
    const confirmedCount = reviewedFindings.filter((finding) => finding.status === 'confirmed' || finding.status === 'likely').length
    await store.log(
      scanId,
      'info',
      `复核完成，确认 ${confirmedCount} 个问题 / Review complete, ${confirmedCount} confirmed issues`,
    )
    await store.updateStatus(scanId, 'running', 'exploitability_review', 85)

    await store.updateStatus(scanId, 'running', 'reporting', 90)
    await store.log(scanId, 'info', '正在生成报告 / Generating report...')
    const score = calcScore(reviewedFindings)
    const markdown = buildReportMarkdown({ project, findings: reviewedFindings, score, scanId })
    const report = { scanId, generatedAt: Date.now(), project, findings: reviewedFindings, score, markdown }
    await store.saveReport(scanId, report)
    await store.updateStatus(scanId, 'completed', 'completed', 100)
    await store.log(
      scanId,
      'info',
      `扫描完成! 风险评分: ${score.total} (${score.riskLevel}) / Scan complete! Risk score: ${score.total} (${score.riskLevel})`,
    )

    try {
      await fs.rm(extractDir, { recursive: true, force: true })
      await store.log(scanId, 'info', '临时文件已清理 / Temporary files cleaned')
    } catch (error) {
      await store.log(scanId, 'warn', `清理临时文件失败: ${error} / Failed to clean temporary files: ${error}`)
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    await store.setError(scanId, message)
    await store.log(scanId, 'error', `扫描失败: ${message} / Scan failed: ${message}`)
    await store.updateStatus(scanId, 'failed', 'failed', 100)

    try {
      await fs.rm(extractDir, { recursive: true, force: true })
    } catch {}
  }
}
