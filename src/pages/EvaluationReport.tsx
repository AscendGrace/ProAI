import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getEvaluationReport } from '../api'
import type { EvaluationReport as Report } from '../types'
import { Breadcrumb } from '../components/Breadcrumb'

const PAGE_SIZE = 10

export function EvaluationReport() {
  const { id } = useParams()
  const location = useLocation()
  const fromType = (location.state as { fromType?: string })?.fromType || 'all'
  const backUrl = `/evaluation-management${fromType !== 'all' ? `?type=${fromType}` : ''}`
  const [data, setData] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const status = data?.evaluation.status ?? ''
  const shouldPoll = status === 'running' || status === 'pending'

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      try {
        const resp = await getEvaluationReport(id)
        if (!cancelled) {
          setData(resp)
          setError('')
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id || !shouldPoll) return
    const t = window.setInterval(() => {
      void getEvaluationReport(id)
        .then((resp) => {
          setData(resp)
          setError('')
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
    }, 2000)
    return () => window.clearInterval(t)
  }, [id, shouldPoll])

  const summary = useMemo(() => {
    const e = data?.evaluation
    if (!e) return null
    return {
      name: e.name,
      standard: formatStandard(e.standard),
      passRate: Math.round((e.passRate ?? 0) * 100),
      total: e.totalCount != null && e.totalCount >= 0 ? e.totalCount : 0,
      pass: e.passCount != null && e.passCount >= 0 ? e.passCount : 0,
      fail: e.failCount != null && e.failCount >= 0 ? e.failCount : 0,
      status: e.status,
      error: e.error,
      createdAt: e.createdAt,
      startedAt: e.startedAt,
      finishedAt: e.finishedAt,
      targetProvider: e.targetProvider,
      targetBaseUrl: e.targetBaseUrl,
      targetModel: e.targetModel,
    }
  }, [data])

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data?.items.length ?? 0) / pageSize)), [data?.items.length, pageSize])
  const pageItems = useMemo(() => {
    if (!data?.items) return []
    const start = (page - 1) * pageSize
    return data.items.slice(start, start + pageSize)
  }, [data?.items, page, pageSize])

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages))
  }, [totalPages])

  function onExport() {
    if (!data) return
    const html = buildReportHtml(data)
    const createdAt = data.evaluation.createdAt ? new Date(data.evaluation.createdAt).toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/[: ]/g, '-') : 'report'
    const safeName = (data.evaluation.name || 'evaluation').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)
    downloadText(`${safeName}-${createdAt}.html`, html, 'text/html;charset=utf-8')
  }

  return (
    <div>
      <Breadcrumb items={[{ label: '评估管理', path: backUrl }, { label: '模型评估' }]} />
      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <Link className="btn secondary" to={backUrl}>
              返回列表
            </Link>
            {summary ? (
              <>
                <span className="badge">{summary.standard}</span>
                <span className="badge">{formatStatus(summary.status)}</span>
                <span className="badge">通过率 {summary.passRate}%</span>
                <span className="muted">
                  共 {summary.total} 条，已测试 {data?.items.length ?? 0} 条，通过 {summary.pass}，未通过 {summary.fail}
                </span>
              </>
            ) : null}
          </div>
          <div className="row">
            {!shouldPoll && (
              <button className="btn secondary" type="button" onClick={onExport} disabled={!data}>
                导出报告
              </button>
            )}
            {shouldPoll ? <span className="muted">评估进行中，自动刷新…</span> : null}
          </div>
        </div>
        {summary ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {summary.name.length > 50 ? (
                expandedIds.has('report-title') ? (
                  <>
                    {summary.name}
                    <span style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, fontSize: 14, whiteSpace: 'nowrap' }} onClick={() => setExpandedIds((s) => { const n = new Set(s); n.delete('report-title'); return n })}>收起</span>
                  </>
                ) : (
                  <>
                    {summary.name.slice(0, 50)}...
                    <span style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, fontSize: 14, whiteSpace: 'nowrap' }} onClick={() => setExpandedIds((s) => new Set(s).add('report-title'))}>详情</span>
                  </>
                )
              ) : summary.name}
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              时间：{formatTime(summary.createdAt)}{summary.finishedAt ? `（完成 ${formatTime(summary.finishedAt)}）` : ''}
            </div>
            {summary.targetBaseUrl ? (
              <div className="muted" style={{ marginTop: 4 }}>
                被测模型接口：{formatTargetEndpoint(summary.targetProvider, summary.targetBaseUrl)}
                {summary.targetModel ? `（model=${summary.targetModel}）` : ''}
              </div>
            ) : null}
            {summary.error ? <div className="muted" style={{ marginTop: 6 }}>错误：{summary.error}</div> : null}
          </div>
        ) : null}
        {error ? <div className="muted" style={{ marginTop: 10 }}>加载失败：{error}</div> : null}
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <div className="cardHeader">
          <div>测试明细</div>
          <span className="muted">已测试 {data?.items.length ?? 0} / {summary?.total ?? 0} 条</span>
        </div>
        {data?.items.length ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pageItems.map((it, idx) => {
                const isError = it.evaluatorScore == null
                const passed = !isError && it.evaluatorScore === 0
                const resultLabel = isError ? '异常' : passed ? '通过' : '未通过'
                const resultColor = isError ? 'rgba(202,138,4,0.5)' : passed ? 'rgba(72,209,143,0.5)' : 'rgba(255,72,72,0.5)'
                const globalIdx = (page - 1) * pageSize + idx + 1
                return (
                  <div key={it.id} className="card">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <div className="row">
                        <span className="badge">#{globalIdx}</span>
                      <span className="badge">
                        {it.riskType.length > 30 ? (
                          expandedIds.has(`${it.id}-rt`) ? (
                            <>
                              <span style={{ display: 'inline-block', maxHeight: 200, overflowY: 'auto', maxWidth: 300 }}>{it.riskType}</span>
                              <span style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }} onClick={() => setExpandedIds((s) => { const n = new Set(s); n.delete(`${it.id}-rt`); return n })}>收起</span>
                            </>
                          ) : (
                            <>
                              {it.riskType.slice(0, 30)}...
                              <span style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }} onClick={() => setExpandedIds((s) => new Set(s).add(`${it.id}-rt`))}>详情</span>
                            </>
                          )
                        ) : it.riskType}
                      </span>
                      {it.riskSubType && (
                        <span className="badge">
                          {it.riskSubType.length > 30 ? (
                            expandedIds.has(`${it.id}-rst`) ? (
                              <>
                                <span style={{ display: 'inline-block', maxHeight: 200, overflowY: 'auto', maxWidth: 300 }}>{it.riskSubType}</span>
                                <span style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }} onClick={() => setExpandedIds((s) => { const n = new Set(s); n.delete(`${it.id}-rst`); return n })}>收起</span>
                              </>
                            ) : (
                              <>
                                {it.riskSubType.slice(0, 30)}...
                                <span style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }} onClick={() => setExpandedIds((s) => new Set(s).add(`${it.id}-rst`))}>详情</span>
                              </>
                            )
                          ) : it.riskSubType}
                        </span>
                      )}
                      <span className="badge" style={{ borderColor: resultColor }}>
                        {resultLabel}
                      </span>
                    </div>
                    <div className="muted">{new Date(it.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="split" style={{ marginTop: 10 }}>
                    <div>
                      <div className="muted" style={{ marginBottom: 6 }}>
                        输入（prompt）
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
                        {it.inputPrompt.length > 200 ? (
                          expandedIds.has(`${it.id}-input`) ? (
                            <>
                              {it.inputPrompt}
                              <span
                                style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }}
                                onClick={() => setExpandedIds((s) => { const n = new Set(s); n.delete(`${it.id}-input`); return n })}
                              >
                                收起
                              </span>
                            </>
                          ) : (
                            <>
                              {it.inputPrompt.slice(0, 200)}...
                              <span
                                style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }}
                                onClick={() => setExpandedIds((s) => new Set(s).add(`${it.id}-input`))}
                              >
                                详情
                              </span>
                            </>
                          )
                        ) : it.inputPrompt}
                      </div>
                    </div>
                    <div>
                      <div className="muted" style={{ marginBottom: 6 }}>
                        输出（被测模型）
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
                        {it.modelOutput.length > 200 ? (
                          expandedIds.has(`${it.id}-output`) ? (
                            <>
                              {it.modelOutput}
                              <span
                                style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }}
                                onClick={() => setExpandedIds((s) => { const n = new Set(s); n.delete(`${it.id}-output`); return n })}
                              >
                                收起
                              </span>
                            </>
                          ) : (
                            <>
                              {it.modelOutput.slice(0, 200)}...
                              <span
                                style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }}
                                onClick={() => setExpandedIds((s) => new Set(s).add(`${it.id}-output`))}
                              >
                                详情
                              </span>
                            </>
                          )
                        ) : it.modelOutput}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {totalPages > 1 && (
            <div style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 12,
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}>
              <div className="muted" style={{ fontSize: 13 }}>
                第 {page}/{totalPages} 页 · 共 {data?.items.length ?? 0} 条
              </div>
              <div className="row" style={{ gap: 8 }}>
                <select
                  className="select"
                  value={pageSize}
                  style={{ minWidth: 100}}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                >
                  <option value={10}>每页 10 条</option>
                  <option value={25}>每页 25 条</option>
                  <option value={50}>每页 50 条</option>
                  <option value={100}>每页 100 条</option>
                </select>
                <button className="btn outline sm" disabled={page <= 1} onClick={() => setPage(1)}>首页</button>
                <button className="btn outline sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
                <button className="btn outline sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</button>
                <button className="btn outline sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>末页</button>
              </div>
            </div>
          )}
          </>
        ) : (
          <div className="muted">暂无明细</div>
        )}
      </section>
    </div>
  )
}

function formatStatus(s: string) {
  if (s === 'completed') return '已完成'
  if (s === 'running') return '运行中'
  if (s === 'failed') return '失败'
  if (s === 'pending') return '待处理'
  return s
}

function formatStandard(s: string) {
  if (s === 'tc260') return 'TC260测试集'
  if (s === 'general') return '通用测试集'
  if (s === 'custom') return '自定义测试集'
  return s
}

function formatTime(ts: number | null | undefined) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString()
}

function formatTargetEndpoint(provider: unknown, baseUrl: string) {
  const b = baseUrl.replace(/\/$/, '')
  if (provider === 'ollama') return `${b}/api/chat`
  if (provider === 'openai') return b.endsWith('/v1') ? `${b}/chat/completions` : `${b}/v1/chat/completions`
  return b
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

function truncatedPre(text: string, maxLen: number) {
  if (text.length <= maxLen) return `<pre>${escapeHtml(text)}</pre>`
  const short = escapeHtml(text.slice(0, maxLen))
  const full = escapeHtml(text)
  return `<div class="truncate-wrap"><pre class="truncate-short">${short}...<span class="toggle" onclick="this.closest('.truncate-wrap').classList.add('expanded')">详情</span></pre><pre class="truncate-full">${full}<span class="toggle" onclick="this.closest('.truncate-wrap').classList.remove('expanded')">收起</span></pre></div>`
}

function buildReportHtml(report: Report) {
  const e = report.evaluation
  const standard = formatStandard(e.standard)
  const createdAt = formatTime(e.createdAt)
  const finishedAt = e.finishedAt ? formatTime(e.finishedAt) : ''
  const endpoint = e.targetBaseUrl ? formatTargetEndpoint(e.targetProvider, e.targetBaseUrl) : '-'
  const passRate = `${Math.round((e.passRate ?? 0) * 100)}%`
  const total = e.totalCount ?? 0
  const pass = e.passCount ?? 0
  const fail = e.failCount ?? 0
  const year = new Date().getFullYear()

  const TRUNCATE_LEN = 200

  const rows = report.items
    .map((it, idx) => {
      const isError = it.evaluatorScore == null
      const passed = !isError && it.evaluatorScore === 0
      const result = isError ? '异常' : passed ? '通过' : '未通过'
      const cls = isError ? 'err' : passed ? 'ok' : 'bad'
      return `<tr>
  <td class="c">${idx + 1}</td>
  <td class="c">${truncatedPre(it.riskType, 30)}</td>
  <td>${truncatedPre(it.inputPrompt, TRUNCATE_LEN)}</td>
  <td>${truncatedPre(it.modelOutput, TRUNCATE_LEN)}</td>
  <td class="c ${cls}">${result}</td>
  <td class="c">${escapeHtml(formatTime(it.createdAt))}</td>
</tr>`
    })
    .join('\n')

  const title = escapeHtml(e.name || '评估报告')
  const targetModel = e.targetModel ? `（model=${escapeHtml(String(e.targetModel))}）` : ''

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
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
    .bad { color: #b42318; font-weight: 600; }
    .err { color: #ca8a04; font-weight: 600; }
    .footer { margin-top: 26px; padding-top: 14px; border-top: 1px solid #eee; color: #666; font-size: 12px; display: flex; justify-content: space-between; }
    .truncate-wrap .truncate-full { display: none; }
    .truncate-wrap.expanded .truncate-short { display: none; }
    .truncate-wrap.expanded .truncate-full { display: block; }
    .toggle { color: #3b82f6; cursor: pointer; margin-left: 6px; white-space: nowrap; }
  </style>
</head>
<body>
  <div class="page">
    <h1>模型评估报告</h1>

    <h2>基本信息</h2>
    <div class="meta">
      <div class="kv"><div class="k">任务名称</div><div class="v">${title}</div></div>
      <div class="kv"><div class="k">时间</div><div class="v">${escapeHtml(createdAt)}${finishedAt ? `（完成 ${escapeHtml(finishedAt)}）` : ''}</div></div>
      <div class="kv"><div class="k">被测模型接口</div><div class="v">${escapeHtml(endpoint)}${targetModel}</div></div>
      <div class="kv"><div class="k">状态</div><div class="v">${escapeHtml(formatStatus(e.status))}</div></div>
    </div>

    <h2>评估结果统计</h2>
    <div class="meta">
      <div class="kv"><div class="k">评估标准</div><div class="v">${escapeHtml(standard)}</div></div>
      <div class="kv"><div class="k">评估数量</div><div class="v">${escapeHtml(String(total))}</div></div>
      <div class="kv"><div class="k">通过率</div><div class="v">${escapeHtml(passRate)}</div></div>
      <div class="kv"><div class="k">通过/未通过</div><div class="v">${escapeHtml(`${pass}/${fail}`)}</div></div>
    </div>

    <h2>测试明细</h2>
    <table>
      <thead>
        <tr>
          <th style="width:60px" class="c">序号</th>
          <th style="width:110px" class="c">风险类型</th>
          <th>输入（prompt）</th>
          <th>输出（被测模型）</th>
          <th style="width:90px" class="c">结果</th>
          <th style="width:160px" class="c">时间</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="6" class="c">暂无明细</td></tr>'}
      </tbody>
    </table>

    <div class="footer">
      <div>华清未央</div>
      <div>© ${year} 华清未央</div>
    </div>
  </div>
</body>
</html>`
}
