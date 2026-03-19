import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Evaluations } from './Evaluations'
import { McpScans } from './McpScans'
import { Breadcrumb } from '../components/Breadcrumb'

type TabType = 'model' | 'mcp'

export function EvaluationCenter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>(() => searchParams.get('tab') === 'mcp' ? 'mcp' : 'model')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'mcp') {
      setActiveTab('mcp')
    }
  }, [searchParams])

  return (
    <div>
      <Breadcrumb items={[{ label: '评估管理' }]} />

      {/* 标签切换 */}
      <div style={{
        display: 'flex',
        gap: 4,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 4,
        background: 'var(--secondary)',
        marginBottom: 24,
        width: 'fit-content',
      }}>
        <button
          onClick={() => {
            setActiveTab('model')
            setSearchParams({})
          }}
          style={{
            padding: '8px 16px',
            fontSize: 14,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            background: activeTab === 'model' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'model' ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
            fontWeight: activeTab === 'model' ? 600 : 400,
          }}
        >
          模型评估
        </button>
        <button
          onClick={() => {
            setActiveTab('mcp')
            setSearchParams({ tab: 'mcp' })
          }}
          style={{
            padding: '8px 16px',
            fontSize: 14,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            background: activeTab === 'mcp' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'mcp' ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
            fontWeight: activeTab === 'mcp' ? 600 : 400,
          }}
        >
          MCP 评估
        </button>
      </div>

      {/* 内容区域 */}
      {activeTab === 'model' ? <Evaluations /> : <McpScans />}
    </div>
  )
}
