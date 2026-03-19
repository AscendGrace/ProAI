import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { bulkDeleteEvaluations, deleteEvaluation, listEvaluations } from '../api'
import type { EvaluationListItem } from '../types'
import './Evaluations.css'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

// 通过率进度条组件
function PassRateBar({ passRate }: { passRate: number }) {
  const rounded = Math.round(passRate * 100)
  const tone = rounded >= 90 ? 'good' : rounded >= 70 ? 'warn' : 'bad'

  return (
    <div className="passRateCell">
      <div className="passRateHeader">
        <span className={`passRateValue ${tone}`}>{rounded}%</span>
      </div>
      <div className="passRateBarBg">
        <div
          className={`passRateBarFill ${tone}`}
          style={{ width: `${Math.max(0, Math.min(100, rounded))}%` }}
        />
      </div>
    </div>
  )
}

// 状态徽章组件
function StatusBadge({ status }: { status: string }) {
  const getVariant = () => {
    switch (status) {
      case 'completed':
      case '已完成':
        return 'success'
      case 'running':
      case '运行中':
        return 'info'
      case 'failed':
      case '失败':
        return 'danger'
      case 'pending':
      case '待处理':
        return 'warning'
      default:
        return ''
    }
  }

  const getLabel = () => {
    switch (status) {
      case 'completed': return '已完成'
      case 'running': return '运行中'
      case 'failed': return '失败'
      case 'pending': return '待处理'
      default: return status
    }
  }

  return <span className={`badge ${getVariant()}`}>{getLabel()}</span>
}

// 类型徽章组件
function TypeBadge({ standard }: { standard: string }) {
  const getVariant = () => {
    switch (standard) {
      case 'tc260': return 'info'
      case 'general': return 'warning'
      case 'custom': return 'success'
      default: return ''
    }
  }

  const getLabel = () => {
    switch (standard) {
      case 'tc260': return 'TC260测试集'
      case 'general': return '通用测试集'
      case 'custom': return '自定义测试集'
      default: return standard
    }
  }

  return <span className={`badge ${getVariant()}`}>{getLabel()}</span>
}

export function Evaluations() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<EvaluationListItem[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get('type') || 'all')
  const [page, setPage] = useState(1)
  const scrollYRef = useRef(0)
  const shouldRestoreScrollRef = useRef(false)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10)
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, avgPassRate: 0 })
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({ all: 0 })

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  async function refresh(nextTypeFilter?: string, nextPage?: number, nextPageSize?: number, nextQuery?: string) {
    const tf = nextTypeFilter ?? typeFilter
    const p = nextPage ?? page
    const ps = nextPageSize ?? pageSize
    const q = nextQuery ?? query
    setLoading(true)
    setError('')
    try {
      const resp = await listEvaluations(q.trim(), tf, p, ps)
      setItems(resp.items)
      setTotal(resp.total)
      setStats(resp.stats)
      setTypeCounts(resp.typeCounts)
      setSelected({})
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    const initialType = searchParams.get('type') || 'all'
    listEvaluations('', initialType, 1, pageSize)
      .then((resp) => {
        setItems(resp.items)
        setTotal(resp.total)
        setStats(resp.stats)
        setTypeCounts(resp.typeCounts)
        setSelected({})
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    scrollYRef.current = window.scrollY
    void refresh()
  }, [page])

  useEffect(() => {
    if (!loading) {
      if (!shouldRestoreScrollRef.current) return
      shouldRestoreScrollRef.current = false
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollYRef.current)
      })
    }
  }, [loading])

  async function onDeleteOne(id: string) {
    if (!confirm('确定要删除这条记录吗？')) return
    await deleteEvaluation(id)
    await refresh()
  }

  async function onBulkDelete() {
    if (selectedIds.length === 0) return
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 条记录吗？`)) return
    await bulkDeleteEvaluations(selectedIds)
    setPage(1)
    await refresh(undefined, 1)
  }

  function onTypeFilterChange(key: string) {
    shouldRestoreScrollRef.current = false
    setTypeFilter(key)
    setPage(1)
    setSearchParams({ type: key })
    void refresh(key, 1)
  }

  function onQueryChange(value: string) {
    shouldRestoreScrollRef.current = false
    setQuery(value)
    setPage(1)
    void refresh(undefined, 1, undefined, value)
  }

  function onPageChange(newPage: number) {
    scrollYRef.current = window.scrollY
    shouldRestoreScrollRef.current = true
    setPage(newPage)
    void refresh(undefined, newPage)
  }

  function onPageSizeChange(newSize: typeof pageSize) {
    scrollYRef.current = window.scrollY
    shouldRestoreScrollRef.current = true
    setPageSize(newSize)
    setPage(1)
    void refresh(undefined, 1, newSize)
  }

  const typeFilterTabs = [
    { key: 'all', label: '全部' },
    { key: 'tc260', label: 'TC260测试集' },
    { key: 'general', label: '通用测试集' },
    { key: 'custom', label: '自定义测试集' },
  ]

  return (
    <div className="evaluationsPage">
      <section className="card">
        {/* 顶部操作栏 */}
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0 }}>
              <div className="muted" style={{ fontSize: 13 }}>
                共 {stats.total} 条 · 已完成 {stats.completed} · 失败 {stats.failed} · 平均通过率 {Math.round(stats.avgPassRate * 100)}%
              </div>
            </div>
            <div className="row">
              <button className="btn outline" onClick={() => refresh()} disabled={loading}>
                <span style={{ marginRight: 6 }}>↻</span>
                刷新
              </button>
            </div>
          </div>
        </div>

        {/* 筛选栏 */}
        <div style={{ paddingTop: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 16 }}>
            {/* 类型筛选 */}
            <div className="row" style={{ gap: 4 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 2,
                background: 'var(--secondary)'
              }}>
                {typeFilterTabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => onTypeFilterChange(t.key)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 13,
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                      background: typeFilter === t.key ? 'var(--primary)' : 'transparent',
                      color: typeFilter === t.key ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                      fontWeight: typeFilter === t.key ? 600 : 400,
                    }}
                  >
                    {t.label}
                    <span style={{
                      marginLeft: 6,
                      opacity: 0.7,
                      fontSize: 12
                    }}>({typeCounts[t.key] ?? 0})</span>
                  </button>
                ))}
              </div>
              {selectedIds.length > 0 && (
                <button className="btn danger sm" onClick={onBulkDelete} disabled={loading}>
                  批量删除（{selectedIds.length}）
                </button>
              )}
            </div>
            {/* 搜索框 */}
            <div style={{ position: 'relative', width: 280, flexShrink: 0 }}>
              <input
                className="input"
                value={query}
                onChange={(e) => onQueryChange(e.target.value.trimStart())}
                placeholder="搜索任务名称..."
                style={{ width: '100%', minWidth: 'unset' }}
              />
            </div>
          </div>
        </div>

        {error && <div className="muted" style={{ marginTop: 12, color: 'var(--destructive)' }}>{error}</div>}
      </section>

      {/* 数据表格 */}
      <section className="card" style={{ marginTop: 14 }}>
        <table className="table" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={items.length > 0 && items.every((it) => !!selected[it.id])}
                  onChange={(e) => {
                    setSelected((prev) => {
                      const next: Record<string, boolean> = { ...prev }
                      for (const it of items) next[it.id] = e.target.checked
                      return next
                    })
                  }}
                />
              </th>
              <th style={{ width: 140 }}>创建时间</th>
              <th style={{ width: 100 }}>类型</th>
              <th>任务名称</th>
              <th style={{ width: 100 }}>状态</th>
              <th style={{ width: 140 }}>通过率</th>
              <th style={{ width: 100, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                  加载中...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                  暂无评估数据
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!selected[it.id]}
                      onChange={(e) => setSelected((s) => ({ ...s, [it.id]: e.target.checked }))}
                    />
                  </td>
                  <td className="muted" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    {new Date(it.createdAt).toLocaleString('zh-CN', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <TypeBadge standard={it.standard} />
                  </td>
                  <td>
                    <Link to={`/evaluation-management/model/${it.id}`} state={{ fromType: typeFilter }} style={{ fontWeight: 500, color: 'var(--foreground)', textDecoration: 'none' }}>
                      {it.name.length > 50 && !expandedIds.has(it.id) ? `${it.name.slice(0, 50)}...` : it.name}
                    </Link>
                    {it.name.length > 50 && (
                      <span
                        style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, fontSize: 12, whiteSpace: 'nowrap' }}
                        onClick={() => setExpandedIds((s) => {
                          const n = new Set(s)
                          n.has(it.id) ? n.delete(it.id) : n.add(it.id)
                          return n
                        })}
                      >
                        {expandedIds.has(it.id) ? '收起' : '详情'}
                      </span>
                    )}
                    <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      ID: {it.id}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={it.status} />
                  </td>
                  <td>
                    <PassRateBar passRate={it.passRate ?? 0} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn danger sm" onClick={() => onDeleteOne(it.id)} title="删除">
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 分页栏 */}
        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 12,
          marginTop: 12,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}>
          <div className="muted" style={{ fontSize: 13 }}>
            第 {page}/{totalPages} 页 · 共 {total} 条
          </div>
          <div className="row" style={{ gap: 8 }}>
            <select
              className="select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value) as typeof pageSize)}
              style={{ minWidth: 100, padding: '6px 10px', height: 32 }}
            >
              {PAGE_SIZE_OPTIONS.map((v) => (
                <option key={v} value={v}>每页 {v} 条</option>
              ))}
            </select>
            <button className="btn outline sm" disabled={page <= 1} onClick={() => setPage(1)}>
              首页
            </button>
            <button className="btn outline sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              上一页
            </button>
            <button className="btn outline sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              下一页
            </button>
            <button className="btn outline sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
              末页
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
