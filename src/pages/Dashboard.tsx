import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getOverview } from '../api'
import type { Overview } from '../types'
import { Breadcrumb } from '../components/Breadcrumb'

const COLORS = ['#5d8fff', '#48d18f', '#ffa94d']

export function Dashboard() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    getOverview()
      .then((next) => {
        setData(next)
        setError('')
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const arsenalData = useMemo(() => {
    const counts = data?.arsenalCounts ?? {}
    return [
      { key: 'tc260', name: 'TC260 测试集', value: counts.tc260 ?? 0 },
      { key: 'general', name: '通用测试集', value: counts.general ?? 0 },
      { key: 'custom', name: '自定义测试集', value: counts.custom ?? 0 },
    ]
  }, [data])

  const recent = data?.recentEvaluations ?? []
  const recentMcp = data?.recentMcpScans ?? []
  const trend = data?.trend ?? []
  const mcpTrend = data?.mcpTrend ?? []

  const recentAll = useMemo(() => {
    const merged: Array<{ id: string; name: string; status: string; createdAt: number; type: 'model' | 'mcp' }> = [
      ...recent.map((it) => ({ id: it.id, name: it.name, status: it.status, createdAt: it.createdAt, type: 'model' as const })),
      ...recentMcp.map((it) => ({ id: it.id, name: it.name, status: it.status, createdAt: it.createdAt, type: 'mcp' as const })),
    ]
    return merged.sort((a, b) => b.createdAt - a.createdAt)
  }, [recent, recentMcp])

  const combinedTrend = useMemo(() => {
    // Generate all 14 days (UTC, matching backend strftime with 'unixepoch')
    const days: string[] = []
    const now = new Date()
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    for (let i = 13; i >= 0; i--) {
      const d = new Date(todayUTC - i * 86400000)
      days.push(d.toISOString().slice(0, 10))
    }

    const map = new Map<string, { day: string; modelCnt: number; mcpCnt: number; passRate: number }>()
    days.forEach((day) => {
      map.set(day, { day, modelCnt: 0, mcpCnt: 0, passRate: 0 })
    })

    trend.forEach((item) => {
      const existing = map.get(item.day)
      if (existing) {
        existing.modelCnt = item.cnt
        existing.passRate = Math.round(item.passRate * 100)
      }
    })

    mcpTrend.forEach((item) => {
      const existing = map.get(item.day)
      if (existing) {
        existing.mcpCnt = item.cnt
      }
    })

    return days.map((day) => map.get(day)!)
  }, [trend, mcpTrend])

  return (
    <div>
      <Breadcrumb items={[{ label: '数据面板' }]} />
      {error ? (
        <div className="card" style={{ gridColumn: 'span 12' }}>
          <div className="muted">加载失败：{error}</div>
        </div>
      ) : null}

      <div className="cardGrid">
        <section className="card" style={{ gridColumn: 'span 4' }}>
          <div className="cardHeader">
            <div>弹药库占比</div>
            <Link className="btn secondary" to="/arsenal">
              管理弹药库
            </Link>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={arsenalData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  animationBegin={0}
                  animationDuration={800}
                  animationEasing="ease-out"
                >
                  {arsenalData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card" style={{ gridColumn: 'span 8' }}>
          <div className="cardHeader">
            <div>评估趋势（近 14 天）</div>
            <Link className="btn secondary" to="/evaluation-management">
              查看任务
            </Link>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={combinedTrend} margin={{ left: -20, right: 30, top: 5, bottom: 5 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="day" tick={{ fill: '#374151', fontSize: 12 }} interval={0} textAnchor="end" height={60} tickFormatter={(value) => value.slice(5)} />
                <YAxis tick={{ fill: '#374151', fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="modelCnt" stroke="#5d8fff" strokeWidth={2} name="模型评估" />
                <Line type="monotone" dataKey="mcpCnt" stroke="#ffa94d" strokeWidth={2} name="MCP 评估" />
                <Line type="monotone" dataKey="passRate" stroke="#48d18f" strokeWidth={2} name="通过率" unit="%" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            蓝线：模型评估 | 橙线：MCP 评估 | 绿线：通过率（%）
          </div>
        </section>

        <section className="card" style={{ gridColumn: 'span 12' }}>
          <div className="cardHeader">
            <div>最近评估任务</div>
            <div className="row" style={{ gap: 8 }}>
              <Link className="btn secondary" to="/evaluation/model">
                新建模型评估
              </Link>
              <Link className="btn secondary" to="/evaluation/mcp">
                新建 MCP 评估
              </Link>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>任务名称</th>
                <th>类型</th>
                <th>状态</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {recentAll.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    暂无数据
                  </td>
                </tr>
              ) : (
                recentAll.map((item) => (
                  <tr key={`${item.type}-${item.id}`}>
                    <td>
                      <Link to={item.type === 'model' ? `/evaluation-management/model/${item.id}` : `/evaluation-management/mcp/${item.id}`} style={{ color: '#000000', textDecoration: 'none' }}>
                        {item.name.length > 50 ? (
                          expandedIds.has(item.id) ? (
                            <>
                              <div style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', maxWidth: '730px' }}>{item.name}</div>
                              <span style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }} onClick={(e) => { e.preventDefault(); setExpandedIds((s) => { const n = new Set(s); n.delete(item.id); return n }) }}>收起</span>
                            </>
                          ) : (
                            <>
                              {item.name.slice(0, 50)}...
                              <span style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, whiteSpace: 'nowrap' }} onClick={(e) => { e.preventDefault(); setExpandedIds((s) => new Set(s).add(item.id)) }}>详情</span>
                            </>
                          )
                        ) : item.name}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${item.type === 'model' ? 'info' : 'warning'}`}>{item.type === 'model' ? '模型评估' : 'MCP 评估'}</span>
                    </td>
                    <td>
                      <span className={`badge ${getStatusVariant(item.status)}`}>{formatStatus(item.status)}</span>
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {formatDateTime(item.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    pending: '待处理',
    queued: '排队中',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
  }
  return map[status] || status
}

function getStatusVariant(status: string) {
  switch (status) {
    case 'completed':
      return 'success'
    case 'running':
      return 'info'
    case 'failed':
      return 'danger'
    case 'pending':
    case 'queued':
      return 'warning'
    default:
      return ''
  }
}

function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
