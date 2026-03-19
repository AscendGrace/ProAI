import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import './layout.css'

// SVG 图标组件
const icons = {
  rocket: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
  ),
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1"/>
      <rect width="7" height="5" x="14" y="3" rx="1"/>
      <rect width="7" height="9" x="14" y="12" rx="1"/>
      <rect width="7" height="5" x="3" y="16" rx="1"/>
    </svg>
  ),
  plus: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 12h8"/>
      <path d="M12 8v8"/>
    </svg>
  ),
  list: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"/>
      <path d="M12 11h4"/>
      <path d="M12 16h4"/>
      <path d="M8 11h.01"/>
      <path d="M8 16h.01"/>
    </svg>
  ),
  target: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  chevronDown: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6"/>
    </svg>
  ),
}

const navItems: Array<{ to: string; label: string; icon: keyof typeof icons }> = [
  { to: '/', label: '快速启动', icon: 'rocket' },
  { to: '/dashboard', label: '数据面板', icon: 'dashboard' },
  { to: '/evaluation-management', label: '评估管理', icon: 'list' },
  { to: '/arsenal', label: '弹药库', icon: 'target' },
  { to: '/settings/model', label: '模型设置', icon: 'settings' },
]

export function AppLayout() {
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [evalExpanded, setEvalExpanded] = useState(pathname.startsWith('/evaluation'))

  const isNavActive = (to: string) => {
    if (to === '/') return pathname === '/'
    return pathname.startsWith(to)
  }

  const toggleSidebar = () => {
    setCollapsed(!collapsed)
  }

  return (
    <div className={`appShell ${collapsed ? 'collapsed' : ''}`}>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebarHeader">
          <div className="brand">
            <img src="/logo.png" alt="ProAI" className="brandLogo" />
            {!collapsed && <span className="brandText">ProAI</span>}
          </div>
          <button
            className="collapseBtn"
            onClick={toggleSidebar}
            title={collapsed ? '展开菜单' : '收起菜单'}
            aria-label={collapsed ? '展开菜单' : '收起菜单'}
          >
            {collapsed ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9.78 12.78a.75.75 0 01-1.06 0L4.47 8.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L6.06 8l3.72 3.72a.75.75 0 010 1.06z"/>
              </svg>
            )}
          </button>
        </div>
        <nav className="nav">
          {navItems.map((it) => {
            if (it.to === '/evaluation-management') {
              return (
                <div key="evaluation-group">
                  <div className={collapsed ? 'navGroup' : ''}>
                    <button
                      onClick={() => !collapsed && setEvalExpanded(!evalExpanded)}
                      className={`navItem ${pathname.startsWith('/evaluation/') ? 'active' : ''}`}
                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                      title={collapsed ? '评估中心' : undefined}
                    >
                      <span className="navIcon">{icons.plus}</span>
                      {!collapsed && <span className="navLabel">评估中心</span>}
                      {!collapsed && <span style={{ marginLeft: 'auto', transition: 'transform 150ms', transform: evalExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>{icons.chevronDown}</span>}
                    </button>
                    {collapsed && (
                      <div className="navFlyout">
                        <Link to="/evaluation/model" className={`navItem ${pathname === '/evaluation/model' ? 'active' : ''}`}>
                          模型评估
                        </Link>
                        <Link to="/evaluation/mcp" className={`navItem ${pathname === '/evaluation/mcp' ? 'active' : ''}`}>
                          MCP 评估
                        </Link>
                      </div>
                    )}
                  </div>
                  {evalExpanded && !collapsed && (
                    <div style={{ paddingLeft: 36 }}>
                      <Link to="/evaluation/model" className={`navItem ${pathname === '/evaluation/model' ? 'active' : ''}`} style={{ fontSize: 13 }}>
                        模型评估
                      </Link>
                      <Link to="/evaluation/mcp" className={`navItem ${pathname === '/evaluation/mcp' ? 'active' : ''}`} style={{ fontSize: 13 }}>
                        MCP 评估
                      </Link>
                    </div>
                  )}
                  <Link to={it.to} className={`navItem ${isNavActive(it.to) && !pathname.startsWith('/evaluation/') ? 'active' : ''}`} title={collapsed ? it.label : undefined}>
                    <span className="navIcon">{icons[it.icon]}</span>
                    {!collapsed && <span className="navLabel">{it.label}</span>}
                  </Link>
                </div>
              )
            }
            return (
              <Link key={it.to} to={it.to} className={`navItem ${isNavActive(it.to) ? 'active' : ''}`} title={collapsed ? it.label : undefined}>
                <span className="navIcon">{icons[it.icon]}</span>
                {!collapsed && <span className="navLabel">{it.label}</span>}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="main">
        {/* 版本号 - 显示在所有页面右上角 */}
        <div style={{
          position: 'absolute',
          right: 32,
          top: 24,
          zIndex: 10,
          fontSize: 11,
          fontWeight: 400,
          color: '#00000093',
          fontFamily: 'Lato, sans-serif',
        }}>
          Version: 社区公益版 V1.0.0
        </div>
        <Outlet />
      </main>
    </div>
  )
}
