import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { getEvaluatorSettings, startMcpScan, testModelConnection } from '../api'
import type { McpScanListItem, Provider } from '../types'
import { Breadcrumb } from '../components/Breadcrumb'

function normalizeBaseUrl(raw: string): string {
  const v = raw.trim()
  if (!v) return v
  if (!/^https?:\/\//i.test(v)) return `http://${v}`
  return v
}

function isValidUrl(raw: string): boolean {
  if (!raw.trim()) return true
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const h = u.hostname
    if (!h) return false
    if (h === 'localhost') return true
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true
    if (h.includes('.') && !h.startsWith('.') && !h.endsWith('.')) return true
    return false
  } catch {
    return false
  }
}

export function NewMcpScan() {
  const nav = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState(`MCP 评估-${new Date().toLocaleString()}`)
  const [provider, setProvider] = useState<Provider>('openai')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState('')
  const [testPassed, setTestPassed] = useState(false)
  const [testing, setTesting] = useState(false)
  const [baseUrlError, setBaseUrlError] = useState('')

  useEffect(() => {
    getEvaluatorSettings()
      .then((settings) => {
        if (!settings) return
        setProvider(settings.provider)
        setBaseUrl(settings.baseUrl)
        setModel(settings.model || '')
        setApiKey(settings.apiKey || '')
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false))

    const hasSeenTour = localStorage.getItem('mcpScanTourSeen')
    if (!hasSeenTour) {
      setTimeout(() => {
        const driverObj = driver({
          showProgress: true,
          nextBtnText: '下一步',
          prevBtnText: '上一步',
          doneBtnText: '完成',
          steps: [
            {
              element: '#mcp-form-fields',
              popover: {
                title: '配置参数',
                description: '填写任务名称、上传 ZIP 项目文件，并配置 AI 模型参数。',
              },
            },
            {
              element: '#test-connection-btn',
              popover: {
                title: '测试模型连通性',
                description: '点击这里验证 AI 模型是否可以正常连接。',
              },
            },
            {
              element: '#start-scan-btn',
              popover: {
                title: '开始评估',
                description: '配置完成并测试通过后，点击这里开始 MCP 安全评估。',
              },
            },
          ],
          onDestroyStarted: () => {
            localStorage.setItem('mcpScanTourSeen', 'true')
            driverObj.destroy()
          },
        })
        driverObj.drive()
      }, 500)
    }
  }, [])

  useEffect(() => {
    setTestPassed(false)
    setTestResult('')
    setError('')
  }, [provider, baseUrl, apiKey, model])

  if (initialLoading) {
    return (
      <div>
        <Breadcrumb items={[{ label: '评估中心', path: '/evaluation/mcp' }, { label: '新建 MCP 评估' }]} />
        <section className="card">
          <div style={{ padding: '20px', textAlign: 'center', color: '#7f8c8d' }}>加载中...</div>
        </section>
      </div>
    )
  }

  async function onTestConnection() {
    setError('')
    if (!name.trim()) { setError('任务名称不能为空'); return }
    if (!file) { setError('项目文件不能为空'); return }
    if (!baseUrl.trim()) { setError('Base URL 不能为空'); return }
    if (!model.trim()) { setError('模型名称不能为空'); return }

    setTesting(true)
    setTestResult('')
    setTestPassed(false)
    if (!isValidUrl(normalizeBaseUrl(baseUrl))) { setTestResult('Base URL 格式不正确'); setTesting(false); return }

    try {
      const response = await testModelConnection({
        provider,
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim() ? apiKey.trim() : undefined,
        model: model.trim(),
      })

      if (response.ok) {
        setTestResult(`模型连通：OK（${response.latencyMs ?? 0}ms）`)
        setTestPassed(true)
      } else {
        const errMsg = response.error ?? 'unknown'
        const display = errMsg.toLowerCase().includes('model is required') && model.trim() ? '模型不存在' : errMsg
        setTestResult(`模型连通：失败（${display}）`)
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const display = errMsg.toLowerCase().includes('model is required') && model.trim() ? '模型不存在' : errMsg
      setTestResult(`模型连通：失败（${display}）`)
    } finally {
      setTesting(false)
    }
  }

  async function onSubmit() {
    if (uploading) return

    setError('')
    if (!name.trim()) { setError('任务名称不能为空'); return }
    if (!file) { setError('项目文件不能为空'); return }
    if (!baseUrl.trim()) { setError('Base URL 不能为空'); return }
    if (!model.trim()) { setError('模型名称不能为空'); return }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (name) formData.append('name', name)
      if (model) formData.append('model', model)
      if (apiKey) formData.append('apiKey', apiKey)
      if (baseUrl) formData.append('baseUrl', baseUrl)

      const response = await fetch('/api/mcp-scans/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const data = await response.json()
      await startMcpScan(data.scanId, data.fileId)

      const initialStatus: McpScanListItem = {
        id: data.scanId,
        name: name.trim() || undefined,
        originalFilename: file.name,
        status: 'running',
        progress: { stage: 'unpacking', percent: 5 },
        createdAt: Date.now(),
      }

      nav(`/evaluation-management/mcp/${data.scanId}`, {
        state: { initialStatus },
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setUploading(false)
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: '评估中心', path: '/evaluation/mcp' }, { label: '新建 MCP 评估' }]} />

      <div className="cardGrid">
        <section className="card" style={{ gridColumn: 'span 12' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="cardHeader">
              <div>配置参数</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {!testPassed ? (
                <span className="muted" style={{ fontSize: 12, marginRight: 12 }}>
                  请先测试模型连通性
                </span>
              ) : null}
              <button
                id="start-scan-btn"
                type="button"
                className="btn"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void onSubmit()
                }}
                disabled={!file || !testPassed || uploading}
              >
                {uploading ? '启动中...' : '开始评估'}
              </button>
            </div>
          </div>

          <div className="cardGrid" id="mcp-form-fields">
            <div style={{ gridColumn: 'span 6' }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                任务名称
              </div>
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="请输入任务名称" />
            </div>

            <div style={{ gridColumn: 'span 6' }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                裁判模型类型
              </div>
              <select className="select" style={{ minWidth: 250 }} value={provider} onChange={(event) => setProvider(event.target.value as Provider)}>
                <option value="ollama">Ollama (/api/chat)</option>
                <option value="openai">OpenAI (/v1/chat/completions)</option>
              </select>
            </div>

            <div style={{ gridColumn: 'span 6' }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                项目文件（ZIP 格式）
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".zip"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const nextFile = event.target.files?.[0]
                  if (!nextFile) return
                  if (!nextFile.name.toLowerCase().endsWith('.zip')) {
                    setError('仅支持上传 .zip 格式文件')
                    event.target.value = ''
                    return
                  }
                  setError('')
                  setFile(nextFile)
                }}
              />
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn outline"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    fileRef.current?.click()
                  }}
                >
                  选择文件
                </button>
                {file ? <span style={{ fontSize: 14 }}>{file.name}</span> : null}
              </div>
            </div>

            <div style={{ gridColumn: 'span 6' }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                模型名称（model）
              </div>
              <input className="input" maxLength={30} value={model} onChange={(event) => setModel(event.target.value)} />
              {model.length >= 30 && <div style={{ color: '#e74c3c', fontSize: 12, marginTop: 4 }}>模型名称不能超过 30 个字符</div>}
            </div>

            <div style={{ gridColumn: 'span 6' }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                Base URL
              </div>
              <input
                className="input"
                value={baseUrl}
                onChange={(event) => { setBaseUrl(event.target.value); setBaseUrlError('') }}
                onBlur={() => {
                  const normalized = normalizeBaseUrl(baseUrl)
                  if (normalized !== baseUrl) setBaseUrl(normalized)
                  if (normalized && !isValidUrl(normalized)) {
                    setBaseUrlError('URL 格式不正确，示例：http://localhost:11434')
                  } else {
                    setBaseUrlError('')
                  }
                }}
              />
              {baseUrlError && <div style={{ color: '#e74c3c', fontSize: 12, marginTop: 4 }}>{baseUrlError}</div>}
            </div>

            {provider === 'openai' ? (
              <div style={{ gridColumn: 'span 6' }}>
                <div className="muted" style={{ marginBottom: 6 }}>
                  API Key
                </div>
                <input
                  className="input"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                />
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              id="test-connection-btn"
              type="button"
              className="btn secondary"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void onTestConnection()
              }}
              disabled={testing || uploading}
            >
              {testing ? '测试中...' : '测试连通性'}
            </button>
            {testResult ? <div className="muted" style={{ marginTop: 8 }}>{testResult}</div> : null}
          </div>
        </section>

        {error ? (
          <section className="card" style={{ gridColumn: 'span 12' }}>
            <div className="muted">{error}</div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
