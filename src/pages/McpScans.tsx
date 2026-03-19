import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteMcpScan, listMcpScans } from '../api'
import type { McpScanListItem } from '../types'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'completed' ? 'success' : status === 'running' ? 'info' : status === 'failed' ? 'danger' : 'warning'
  const label = status === 'completed' ? '已完成' : status === 'running' ? '运行中' : status === 'failed' ? '失败' : status === 'queued' ? '待处理' : status === 'pending' ? '待处理' : status
  return <span className={`badge ${variant}`}>{label}</span>
}

export function McpScans() {
  const [scans, setScans] = useState<McpScanListItem[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10)
  const scrollYRef = useRef(0)
  const shouldRestoreScrollRef = useRef(false)

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  async function refresh(nextQuery?: string, nextPage?: number, nextPageSize?: number) {
    const q = nextQuery ?? query
    const p = nextPage ?? page
    const ps = nextPageSize ?? pageSize
    setLoading(true)
    setError('')
    try {
      const resp = await listMcpScans(q.trim(), p, ps)
      setScans(resp.items)
      setTotal(resp.total)
      setSelected({})
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
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

  async function onDelete(id: string) {
    if (!confirm('确定要删除这条记录吗？')) return
    await deleteMcpScan(id)
    await refresh()
  }

  async function onBulkDelete() {
    if (selectedIds.length === 0) return
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 条记录吗？`)) return
    for (const id of selectedIds) await deleteMcpScan(id)
    setPage(1)
    await refresh(undefined, 1)
  }

  function onQueryChange(value: string) {
    shouldRestoreScrollRef.current = false
    setQuery(value)
    setPage(1)
    void refresh(value, 1)
  }

  return (
    <div>
      <section className="card">
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="muted" style={{ fontSize: 13 }}>
              共 {total} 条 · 已完成 {scans.filter(s => s.status === 'completed').length} · 失败 {scans.filter(s => s.status === 'failed').length}
            </div>
            <div className="row">
              <div style={{ position: 'relative', width: 280, flexShrink: 0 }}>
                <input
                  className="input"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value.trimStart())}
                  placeholder="搜索任务名称..."
                  style={{ width: '100%', minWidth: 'unset' }}
                />
              </div>
              <button className="btn outline" onClick={refresh} disabled={loading}>
                <span style={{ marginRight: 6 }}>↻</span>
                刷新
              </button>
            </div>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div style={{ paddingTop: 16 }}>
            <button className="btn danger sm" onClick={onBulkDelete} disabled={loading}>
              批量删除（{selectedIds.length}）
            </button>
          </div>
        )}

        {error && <div className="muted" style={{ marginTop: 12, color: 'var(--destructive)' }}>{error}</div>}
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <table className="table" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={scans.length > 0 && scans.every((s) => !!selected[s.id])}
                  onChange={(e) => {
                    setSelected((prev) => {
                      const next: Record<string, boolean> = { ...prev }
                      for (const s of scans) next[s.id] = e.target.checked
                      return next
                    })
                  }}
                />
              </th>
              <th style={{ width: 140 }}>创建时间</th>
              <th>任务名称</th>
              <th style={{ width: 100 }}>状态</th>
              <th style={{ width: 100, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                  加载中...
                </td>
              </tr>
            ) : scans.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                  暂无评估数据
                </td>
              </tr>
            ) : (
              scans.map((scan) => (
                <tr key={scan.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!selected[scan.id]}
                      onChange={(e) => setSelected((s) => ({ ...s, [scan.id]: e.target.checked }))}
                    />
                  </td>
                  <td className="muted" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    {new Date(scan.createdAt).toLocaleString('zh-CN', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td>
                    {(() => {
                      const name = scan.name || scan.originalFilename || ''
                      return (
                        <>
                          <Link to={`/evaluation-management/mcp/${scan.id}`} style={{ fontWeight: 500, color: 'var(--foreground)', textDecoration: 'none' }}>
                            {name.length > 50 && !expandedIds.has(scan.id) ? `${name.slice(0, 50)}...` : name}
                          </Link>
                          {name.length > 50 && (
                            <span
                              style={{ color: 'var(--info)', cursor: 'pointer', marginLeft: 6, fontSize: 12, whiteSpace: 'nowrap' }}
                              onClick={() => setExpandedIds((s) => {
                                const n = new Set(s)
                                n.has(scan.id) ? n.delete(scan.id) : n.add(scan.id)
                                return n
                              })}
                            >
                              {expandedIds.has(scan.id) ? '收起' : '详情'}
                            </span>
                          )}
                        </>
                      )
                    })()}
                    <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      ID: {scan.id}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={scan.status} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn danger sm" onClick={() => onDelete(scan.id)} title="删除">
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
              onChange={(e) => {
                scrollYRef.current = window.scrollY
                shouldRestoreScrollRef.current = true
                const newSize = Number(e.target.value) as typeof pageSize
                setPageSize(newSize)
                setPage(1)
                void refresh(undefined, 1, newSize)
              }}
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
