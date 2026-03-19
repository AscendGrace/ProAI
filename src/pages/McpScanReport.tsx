import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getMcpScanReport, getMcpScanStatus } from '../api'
import type { McpScanListItem, McpScanReport as McpScanReportData } from '../types'
import { Breadcrumb } from '../components/Breadcrumb'

type LocationState = {
  initialStatus?: McpScanListItem
}

export function McpScanReport({ scanId: propScanId }: { scanId?: string } = {}) {
  const { id: routeScanId } = useParams<{ id: string }>()
  const scanId = propScanId || routeScanId
  const location = useLocation()
  const initialStatus = (location.state as LocationState | null)?.initialStatus ?? null
  const [report, setReport] = useState<McpScanReportData | null>(null)
  const [status, setStatus] = useState<McpScanListItem | null>(initialStatus)
  const [error, setError] = useState('')

  const shouldPoll = status?.status === 'running' || status?.status === 'pending'
  const isCompleted = status?.status === 'completed' && !!report
  const title = status?.name || status?.originalFilename || report?.project.rootName || 'MCP 评估'

  useEffect(() => {
    if (!scanId) return

    let cancelled = false

    const load = async () => {
      try {
        const nextStatus = await getMcpScanStatus(scanId)
        if (cancelled) return

        if (nextStatus.status === 'completed') {
          const nextReport = await getMcpScanReport(scanId)
          if (cancelled) return
          setReport(nextReport)
        }

        setStatus(nextStatus)
        setError('')
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [scanId])

  useEffect(() => {
    if (!scanId || !shouldPoll) return

    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const nextStatus = await getMcpScanStatus(scanId)
          if (nextStatus.status === 'completed') {
            const nextReport = await getMcpScanReport(scanId)
            setReport(nextReport)
          }
          setStatus(nextStatus)
        } catch {
        }
      })()
    }, 2000)

    return () => window.clearInterval(timer)
  }, [scanId, shouldPoll])

  function onExport() {
    if (!report || !status) return
    const html = buildMcpReportHtml(report, status, title)
    const createdAt = status.createdAt ? new Date(status.createdAt).toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/[: ]/g, '-') : 'report'
    const safeName = (title || 'mcp-scan').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)
    downloadText(`${safeName}-${createdAt}.html`, html, 'text/html;charset=utf-8')
  }

  return (
    <div>
      <Breadcrumb items={[{ label: '评估管理', path: '/evaluation-management?tab=mcp' }, { label: 'MCP 评估' }]} />

      <section className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <Link className="btn secondary" to="/evaluation-management?tab=mcp">
              返回列表
            </Link>
            {status ? (
              <>
                <span className={`badge ${status.status === 'completed' ? 'success' : status.status === 'running' ? 'info' : status.status === 'failed' ? 'danger' : 'warning'}`}>
                  {formatScanStatus(status.status)}
                </span>
                {report ? (
                  <span className={`badge ${report.findings.length === 0 ? 'success' : getRiskVariant(report.score.riskLevel)}`}>
                    风险等级：{report.findings.length === 0 ? '安全' : formatSeverityLabel(report.score.riskLevel)}
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="row">
            {shouldPoll ? <span className="muted">扫描进行中，自动刷新…</span> : null}
            {isCompleted ? (
              <button className="btn secondary" type="button" onClick={onExport}>导出报告</button>
            ) : null}
          </div>
        </div>
        {status ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              时间：{formatTime(status.createdAt)}{report ? `（完成 ${formatTime(report.generatedAt)}）` : ''}
            </div>
            {status.judgeBaseUrl ? (
              <div className="muted" style={{ marginTop: 4 }}>
                裁判模型接口：{formatJudgeEndpoint(status.judgeBaseUrl)}
                {status.judgeModel ? `（model=${status.judgeModel}）` : ''}
              </div>
            ) : null}
          </div>
        ) : null}
        {error ? <div className="muted" style={{ marginTop: 10 }}>加载失败：{error}</div> : null}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="cardHeader">
          <div className="cardTitle">扫描进度</div>
        </div>
        {!status ? (
          <div className="muted" style={{ padding: 16 }}>加载中...</div>
        ) : (
          <div style={{ padding: 16 }}>
            <div className="muted" style={{ marginBottom: 8 }}>
              状态：{formatScanStatus(status.status)}
            </div>
            {status.status !== 'completed' ? (
              <div>
                <div className="muted" style={{ marginBottom: 4 }}>
                  {formatStage(status.progress.stage)} - {status.progress.percent}%
                </div>
                <div style={{ width: '100%', height: 8, background: 'var(--secondary)', borderRadius: 4 }}>
                  <div
                    style={{
                      width: `${status.progress.percent}%`,
                      height: '100%',
                      background: 'var(--primary)',
                      borderRadius: 4,
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              </div>
            ) : !report ? (
              <div className="muted">报告生成完成，正在加载报告内容...</div>
            ) : null}
            {status.error ? <div style={{ marginTop: 12, color: 'var(--destructive)' }}>{status.error}</div> : null}
          </div>
        )}
      </section>

      <div className="cardGrid" style={{ marginTop: 16 }}>
        <section className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>风险评分</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: report ? (report.findings.length === 0 ? '#16a34a' : getRiskColor(report.score.riskLevel)) : '#000000' }}>
            {report ? report.score.total : '-'}
          </div>
          <div className={`badge ${report ? (report.findings.length === 0 ? 'success' : getRiskVariant(report.score.riskLevel)) : status?.status === 'failed' ? 'danger' : 'info'}`} style={{ marginTop: 8 }}>
            {report ? (report.findings.length === 0 ? '安全' : formatSeverityLabel(report.score.riskLevel)) : status?.status === 'failed' ? '扫描失败' : '待处理'}
          </div>
        </section>

        <section className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>发现问题</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{report ? report.findings.length : '-'}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            {report
              ? (['critical', 'high', 'medium', 'low', 'info'] as const)
                  .map((s) => `${formatSeverityLabel(s)}：${report.findings.filter((item) => item.severity === s).length}`)
                  .join(' | ')
              : status?.status === 'failed' ? '扫描失败' : '等待扫描完成'}
          </div>
        </section>

        <section className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>项目语言</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>
            {report ? report.project.languages.join(', ') || '-' : '-'}
          </div>
        </section>

        <section className="card" style={{ gridColumn: 'span 3' }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>文件统计</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>
            {report ? `${report.project.fileStats.totalFiles} 个文件` : '-'}
          </div>
        </section>
      </div>

      {isCompleted ? (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="cardHeader">
            <div className="cardTitle">评分标准</div>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            <div style={{ marginBottom: 12 }}>
              <strong>状态说明</strong>
              <div className="muted">已确认：漏洞经复核确认真实存在且可利用；较可能：大概率存在但未完全确认；已复核/待复核：需要人工进一步判断；误报：经复核排除，不计入评分</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>评分公式</strong>
              <div className="muted">单项得分 = 基础分 × 状态系数 × (0.5 + 0.5 × 置信度)，总分为各项累加</div>
              <div className="muted">基础分：严重 25、高危 15、中危 8、低危 3、信息 1</div>
              <div className="muted">状态系数：已确认 1.0、较可能 0.7、已复核/待复核 0.4、误报不计分</div>
            </div>
            <div>
              <strong>风险等级判定</strong>
              <div className="muted">总分 ≥ 60：严重、 ≥ 35：高危、 ≥ 15：中危、 &lt; 15：低危</div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="cardHeader">
          <div className="cardTitle">漏洞详情</div>
        </div>
        {!isCompleted ? (
          <div className="muted" style={{ padding: 32, textAlign: 'center' }}>
            {status?.status === 'failed' ? '扫描失败' : '扫描进行中，完成后将在这里展示漏洞详情'}
          </div>
        ) : report.findings.length === 0 ? (
          <div className="muted" style={{ padding: 32, textAlign: 'center' }}>未发现安全问题</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {report.findings.map((finding) => (
              <div key={finding.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className={`badge ${getSeverityVariant(finding.severity)}`}>
                    {formatSeverityLabel(finding.severity)}
                  </span>
                  <span className={`badge ${getStatusVariant(finding.status)}`}>
                    {formatStatusLabel(finding.status)}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{finding.title}</span>
                </div>
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  <strong>描述：</strong>
                  {finding.description}
                </div>
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  <strong>影响：</strong>
                  {finding.impact}
                </div>
                <div style={{ fontSize: 13 }}>
                  <strong>修复建议：</strong>
                  {finding.remediation}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="cardHeader">
          <div className="cardTitle">完整报告</div>
        </div>
        {!isCompleted ? (
          <div className="muted" style={{ padding: 32, textAlign: 'center' }}>
            {status?.status === 'failed' ? '扫描失败' : '扫描进行中，完成后将在这里展示完整报告'}
          </div>
        ) : (
          <div>
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                状态：{formatScanStatus(status!.status)} · 时间：{formatTime(status!.createdAt)}{report ? `（完成 ${formatTime(report.generatedAt)}）` : ''}
              </div>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>{report.markdown}</pre>
          </div>
        )}
      </section>
    </div>
  )
}

function formatScanStatus(status: McpScanListItem['status']) {
  const map: Record<McpScanListItem['status'], string> = {
    pending: '待处理',
    queued: '排队中',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
  }
  return map[status]
}

function formatStage(stage: string) {
  const map: Record<string, string> = {
    pending: '待处理',
    unpacking: '解压文件',
    project_analysis: '项目分析',
    ai_audit: 'AI 审计',
    exploitability_review: '可利用性复核',
    reporting: '生成报告',
    completed: '已完成',
    failed: '失败',
  }
  return map[stage] || stage
}

function formatTime(ts: number | null | undefined) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString()
}

function formatJudgeEndpoint(baseUrl: string | undefined) {
  if (!baseUrl) return '-'
  return baseUrl.replace(/\/$/, '')
}

function formatSeverityLabel(level: string) {
  const map: Record<string, string> = {
    critical: '严重',
    high: '高危',
    medium: '中危',
    low: '低危',
    info: '信息',
  }
  return map[level] || level
}

function getRiskColor(level: string) {
  if (level === 'critical') return '#dc2626'
  if (level === 'high') return '#ea580c'
  if (level === 'medium') return '#ca8a04'
  return '#16a34a'
}

function getRiskVariant(level: string) {
  if (level === 'critical') return 'danger'
  if (level === 'high') return 'warning'
  if (level === 'medium') return 'info'
  return 'success'
}

function getSeverityVariant(severity: string) {
  if (severity === 'critical') return 'danger'
  if (severity === 'high') return 'warning'
  if (severity === 'medium') return 'info'
  if (severity === 'low') return 'success'
  return ''
}

function formatStatusLabel(status: string) {
  const map: Record<string, string> = {
    confirmed: '已确认',
    likely: '较可能',
    needs_review: '待复核',
    false_positive: '误报',
    reviewed: '已复核',
  }
  return map[status] || status
}

function getStatusVariant(status: string) {
  if (status === 'confirmed') return 'danger'
  if (status === 'likely') return 'warning'
  if (status === 'needs_review') return 'info'
  if (status === 'false_positive') return ''
  return ''
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildMcpReportHtml(report: McpScanReportData, status: McpScanListItem, title: string) {
  const createdAt = formatTime(status.createdAt)
  const completedAt = report.generatedAt ? formatTime(report.generatedAt) : ''
  const year = new Date().getFullYear()

  const getStatusClass = (status: string) => {
    if (status === 'confirmed') return 'bad'
    if (status === 'likely') return 'warn'
    if (status === 'needs_review') return 'info'
    if (status === 'false_positive') return 'ok'
    return ''
  }

  const findingRows = report.findings
    .map((f, idx) => `<tr>
  <td class="c">${idx + 1}</td>
  <td class="c ${f.severity === 'critical' || f.severity === 'high' ? 'bad' : f.severity === 'medium' ? 'warn' : 'ok'}">${escapeHtml(formatSeverityLabel(f.severity))}</td>
  <td class="c ${getStatusClass(f.status)}">${escapeHtml(formatStatusLabel(f.status))}</td>
  <td>${escapeHtml(f.title)}</td>
  <td><pre>${escapeHtml(f.description)}</pre></td>
  <td><pre>${escapeHtml(f.impact)}</pre></td>
  <td><pre>${escapeHtml(f.remediation)}</pre></td>
</tr>`)
    .join('\n')

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} - MCP 评估报告</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif; color: #111; margin: 0; background: #fff; }
    .page { max-width: 1100px; margin: 0 auto; padding: 28px 22px 40px; }
    h1 { font-size: 20px; margin: 0 0 14px; }
    h2 { font-size: 14px; margin: 22px 0 10px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; }
    .kv { border: 1px solid #e6e6e6; border-radius: 10px; padding: 10px 12px; }
    .k { font-size: 12px; color: #666; margin-bottom: 6px; }
    .v { font-size: 13px; color: #111; word-break: break-all; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #e6e6e6; }
    th, td { border-bottom: 1px solid #eee; padding: 9px 10px; vertical-align: top; font-size: 12px; }
    th { background: #fafafa; text-align: left; font-weight: 600; color: #222; }
    tr:last-child td { border-bottom: 0; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size: 12px; line-height: 1.55; }
    .c { text-align: center; white-space: nowrap; }
    .ok { color: #0a7f47; font-weight: 600; }
    .warn { color: #ca8a04; font-weight: 600; }
    .bad { color: #b42318; font-weight: 600; }
    .info { color: #3b82f6; font-weight: 600; }
    .markdown-report { margin-top: 6px; white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.7; }
    .footer { margin-top: 26px; padding-top: 14px; border-top: 1px solid #eee; color: #666; font-size: 12px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="page">
    <h1>MCP 评估报告</h1>

    <h2>基本信息</h2>
    <div class="meta">
      <div class="kv"><div class="k">任务名称</div><div class="v">${escapeHtml(title)}</div></div>
      <div class="kv"><div class="k">时间</div><div class="v">${escapeHtml(createdAt)}${completedAt ? `（完成 ${escapeHtml(completedAt)}）` : ''}</div></div>
      ${status.judgeBaseUrl ? `<div class="kv"><div class="k">裁判模型接口</div><div class="v">${escapeHtml(formatJudgeEndpoint(status.judgeBaseUrl))}${status.judgeModel ? `（model=${escapeHtml(status.judgeModel)}）` : ''}</div></div>` : ''}
      <div class="kv"><div class="k">项目语言</div><div class="v">${escapeHtml(report.project.languages.join(', ') || '-')}</div></div>
      <div class="kv"><div class="k">文件统计</div><div class="v">${report.project.fileStats.totalFiles} 个文件</div></div>
    </div>

    <h2>评估结果</h2>
    <div class="meta">
      <div class="kv"><div class="k">风险评分</div><div class="v">${report.score.total}</div></div>
      <div class="kv"><div class="k">风险等级</div><div class="v">${escapeHtml(report.findings.length === 0 ? '安全' : formatSeverityLabel(report.score.riskLevel))}</div></div>
      <div class="kv"><div class="k">发现问题</div><div class="v">${report.findings.length} 项</div></div>
      <div class="kv"><div class="k">问题分布</div><div class="v">${(['critical', 'high', 'medium', 'low', 'info'] as const).map(s => `${formatSeverityLabel(s)}：${report.findings.filter(f => f.severity === s).length}`).join(' | ')}</div></div>
    </div>

    <h2>评分标准</h2>
    <div style="font-size:12px;color:#444;line-height:1.8">
      <p><b>状态说明：</b>已确认：漏洞经复核确认真实存在且可利用；较可能：大概率存在但未完全确认；已复核/待复核：需要人工进一步判断；误报 — 经复核排除，不计入评分</p>
      <p><b>评分公式：</b>单项得分 = 基础分 × 状态系数 × (0.5 + 0.5 × 置信度)，总分为各项累加。基础分：严重 25、高危 15、中危 8、低危 3、信息 1。状态系数：已确认 1.0、较可能 0.7、已复核/待复核 0.4、误报不计分</p>
      <p><b>风险等级判定：</b>总分 ≥ 60 严重；≥ 35 高危；≥ 15 中危；&lt; 15 低危</p>
    </div>

    <h2>漏洞详情</h2>
    <table>
      <thead>
        <tr>
          <th style="width:50px" class="c">序号</th>
          <th style="width:70px" class="c">等级</th>
          <th style="width:70px" class="c">状态</th>
          <th style="width:200px">标题</th>
          <th>描述</th>
          <th>影响</th>
          <th>修复建议</th>
        </tr>
      </thead>
      <tbody>
        ${findingRows || '<tr><td colspan="7" class="c">未发现安全问题</td></tr>'}
      </tbody>
    </table>

    <h2>完整报告</h2>
    <pre class="markdown-report">${escapeHtml(report.markdown)}</pre>

    <div class="footer">
      <div>华清未央</div>
      <div>&copy; ${year} 华清未央</div>
    </div>
  </div>
</body>
</html>`
}
