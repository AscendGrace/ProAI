import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { createEvaluation, getPromptCounts, testEvaluatorConnection, testModelConnection } from '../api'
import type { Provider } from '../types'
import { Breadcrumb } from '../components/Breadcrumb'

type Step = 1 | 2

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
    // localhost 或 IP 地址（含端口）或包含 . 的域名
    if (h === 'localhost') return true
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true
    if (h.includes('.') && !h.startsWith('.') && !h.endsWith('.')) return true
    return false
  } catch {
    return false
  }
}

export function NewEvaluation() {
  const nav = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState<string>('')
  const [targetTestPassed, setTargetTestPassed] = useState(false)
  const [evaluatorTestPassed, setEvaluatorTestPassed] = useState(false)
  const [testing, setTesting] = useState(false)
  const [baseUrlError, setBaseUrlError] = useState('')

  const cached = localStorage.getItem('newEvaluation')
  const initial = cached ? JSON.parse(cached) : null

  const [name, setName] = useState(initial?.name || `模型评估-${new Date().toLocaleString()}`)
  const [provider, setProvider] = useState<Provider>(initial?.provider || 'ollama')
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl || '')
  const [apiKey, setApiKey] = useState(initial?.apiKey || '')
  const [model, setModel] = useState(initial?.model || '')

  const [standard, setStandard] = useState<'tc260' | 'general' | 'custom'>('tc260')
  const [testMode, setTestMode] = useState<'random' | 'all'>('all')
  const [count, setCount] = useState<number | ''>(20)
  const [promptCounts, setPromptCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    getPromptCounts().then(setPromptCounts).catch(() => {})
  }, [])

  const maxCount = promptCounts[standard] ?? 0

  useEffect(() => {
    setError('')
  }, [testMode, standard])

  useEffect(() => {
    setTargetTestPassed(false)
    setEvaluatorTestPassed(false)
    setTestResult('')
    setError('')
  }, [provider, baseUrl, apiKey, model])

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('evaluationTourSeen')
    if (!hasSeenTour) {
      const driverObj = driver({
        showProgress: true,
        nextBtnText: '下一步',
        prevBtnText: '上一步',
        doneBtnText: '完成',
        steps: [
          { element: '#step1-form', popover: { title: '配置参数', description: '填写评估任务名称、被测模型类型、Base URL 和模型名称' } },
          { element: '#test-connection-btn', popover: { title: '测试连通性', description: '点击测试被测模型和裁判模型的连通性' } },
          { element: '#next-btn', popover: { title: '下一步', description: '测试通过后，点击进入下一步' } },
        ],
        onDestroyStarted: () => {
          localStorage.setItem('evaluationTourSeen', 'true')
          driverObj.destroy()
        }
      })
      setTimeout(() => driverObj.drive(), 500)
    }
  }, [])

  useEffect(() => {
    if (step === 2) {
      const hasSeenStep2 = localStorage.getItem('evaluationTourStep2Seen')
      if (!hasSeenStep2) {
        const driverObj = driver({
          showProgress: true,
          nextBtnText: '下一步',
          prevBtnText: '上一步',
          doneBtnText: '完成',
          steps: [
            { element: '#test-standard', popover: { title: '选择测试集', description: '选择要使用的测试集' } },
            { element: '#test-mode', popover: { title: '选择测试模式', description: '选择全部测试或随机测试' } },
            { element: '#start-btn', popover: { title: '开始评估', description: '点击开始评估任务' } },
          ],
          onDestroyStarted: () => {
            localStorage.setItem('evaluationTourStep2Seen', 'true')
            driverObj.destroy()
          }
        })
        setTimeout(() => driverObj.drive(), 500)
      }
    }
  }, [step])

  useEffect(() => {
    const data = { name, provider, baseUrl, apiKey, model, standard, testMode, count }
    localStorage.setItem('newEvaluation', JSON.stringify(data))
  }, [name, provider, baseUrl, apiKey, model, standard, testMode, count])

  const canNext = useMemo(() => name.trim() && baseUrl.trim() && targetTestPassed && evaluatorTestPassed, [name, baseUrl, targetTestPassed, evaluatorTestPassed])

  async function onTestConnection() {
    setError('')
    if (!name.trim()) { setError('任务名称不能为空'); return }
    if (!baseUrl.trim()) { setError('Base URL 不能为空'); return }
    if (!model.trim()) { setError('模型名称不能为空'); return }

    setTesting(true)
    setTestResult('')
    setTargetTestPassed(false)
    setEvaluatorTestPassed(false)
    if (!isValidUrl(normalizeBaseUrl(baseUrl))) { setTestResult('Base URL 格式不正确'); setTesting(false); return }

    const results: string[] = []

    // 测试被测模型
    try {
      const resp = await testModelConnection({
        provider,
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim() ? apiKey.trim() : undefined,
        model: model.trim(),
      })
      if (resp.ok) {
        results.push(`被测模型：OK（${resp.latencyMs ?? 0}ms）`)
        setTargetTestPassed(true)
      } else {
        const errMsg = resp.error ?? 'unknown'
        const display = errMsg.toLowerCase().includes('model is required') && model.trim() ? '模型不存在' : errMsg
        results.push(`被测模型：失败（${display}）`)
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      const display = errMsg.toLowerCase().includes('model is required') && model.trim() ? '模型不存在' : errMsg
      results.push(`被测模型：失败（${display}）`)
    }

    // 测试裁判模型
    try {
      const resp = await testEvaluatorConnection()
      if (resp.ok) {
        results.push(`裁判模型：OK（${resp.latencyMs ?? 0}ms）`)
        setEvaluatorTestPassed(true)
      } else {
        results.push(`裁判模型：失败（${resp.error ?? 'unknown'}）`)
      }
    } catch (e: unknown) {
      results.push(`裁判模型：失败（${e instanceof Error ? e.message : String(e)}）`)
    }

    setTestResult(results.join(' | '))
    setTesting(false)
  }

  async function onStart() {
    setError('')
    if (!name.trim()) { setError('任务名称不能为空'); return }
    if (!baseUrl.trim()) { setError('Base URL 不能为空'); return }
    const normalized = normalizeBaseUrl(baseUrl)
    if (!isValidUrl(normalized)) { setError('Base URL 格式不正确'); return }
    if (!model.trim()) { setError('模型名称不能为空'); return }
    if (testMode === 'random' && !count) {
      setError('随机条数不能为空')
      return
    }
    if (testMode === 'random' && !Number.isInteger(Number(count))) {
      setError('随机条数必须为整数')
      return
    }
    if (testMode === 'random' && (count as number) < 1) {
      setError('随机条数不能小于 1')
      return
    }
    if (testMode === 'random' && (count as number) > maxCount) {
      setError(`随机条数不能超过当前测试集的最大条数 ${maxCount}`)
      return
    }
    setLoading(true)
    try {
      const resp = await createEvaluation({
        name: name.trim(),
        standard,
        count: testMode === 'all' ? -1 : count as number,
        target: {
          provider,
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim() ? apiKey.trim() : undefined,
          model: model.trim() ? model.trim() : undefined,
        },
      })
      nav(`/evaluation-management/model/${resp.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: '评估中心', path: '/evaluation/model' }, { label: '新建模型评估' }]} />

      <div className="cardGrid">
        <section className="card" style={{ gridColumn: 'span 12' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row">
              <span className="badge">步骤 {step}/2</span>
              <span className="muted">{step === 1 ? '配置参数' : '选择测试集'}</span>
            </div>
            <div className="row">
              {step === 2 ? (
                <button className="btn secondary" onClick={() => { setError(''); setStep(1) }} disabled={loading}>
                  上一步
                </button>
              ) : null}
              {step === 1 ? (
                <>
                  {!targetTestPassed || !evaluatorTestPassed ? (
                    <span className="muted" style={{ fontSize: 12, marginRight: 12 }}>
                      {!targetTestPassed && !evaluatorTestPassed ? '请先测试被测模型和裁判模型连通性' : ''}
                    </span>
                  ) : null}
                  <button id="next-btn" className="btn" onClick={() => setStep(2)} disabled={!canNext || loading}>
                    下一步
                  </button>
                </>
              ) : (
                <button id="start-btn" className="btn" onClick={onStart} disabled={loading}>
                  {loading ? '启动中…' : '开始评估'}
                </button>
              )}
            </div>
          </div>
        </section>

        {step === 1 ? (
          <section className="card" style={{ gridColumn: 'span 12' }}>
            <div className="cardHeader">
              <div>步骤1：配置参数</div>
            </div>
            <div id="step1-form" className="cardGrid">
              <div style={{ gridColumn: 'span 6' }}>
                <div className="muted" style={{ marginBottom: 6 }}>
                  任务名称
                </div>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入任务名称" />
              </div>
              <div style={{ gridColumn: 'span 6' }}>
                <div className="muted" style={{ marginBottom: 6 }}>
                  被测模型类型
                </div>
                <select className="select" value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
                  <option value="ollama">Ollama（/api/chat）</option>
                  <option value="openai">OpenAI（/v1/chat/completions）</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 6' }}>
                <div className="muted" style={{ marginBottom: 6 }}>
                  Base URL
                </div>
                <input
                  className="input"
                  value={baseUrl}
                  onChange={(e) => { setBaseUrl(e.target.value); setBaseUrlError('') }}
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
              <div style={{ gridColumn: 'span 6' }}>
                <div className="muted" style={{ marginBottom: 6 }}>
                  模型名称（model）
                </div>
                <input className="input" maxLength={30} value={model} onChange={(e) => setModel(e.target.value)} />
                {model.length >= 30 && <div style={{ color: '#e74c3c', fontSize: 12, marginTop: 4 }}>模型名称不能超过 30 个字符</div>}
              </div>
              {provider === 'openai' && (
                <div style={{ gridColumn: 'span 12' }}>
                  <div className="muted" style={{ marginBottom: 6 }}>
                    API Key
                  </div>
                  <input type="password" className="input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                </div>
              )}
            </div>
            <div style={{ marginTop: 16 }}>
              <button id="test-connection-btn" className="btn secondary" type="button" onClick={onTestConnection} disabled={testing || loading}>
                {testing ? '测试中…' : '测试连通性'}
              </button>
              {testResult ? <div className="muted" style={{ marginTop: 8 }}>{testResult}</div> : null}
            </div>
          </section>
        ) : (
          <section className="card" style={{ gridColumn: 'span 12' }}>
            <div className="cardHeader">
              <div>步骤2：选择测试集</div>
            </div>
            <div className="cardGrid">
              <div style={{ gridColumn: 'span 6' }}>
                <div className="muted" style={{ marginBottom: 6 }}>
                  测试集
                </div>
                <select
                  id="test-standard"
                  className="select"
                  value={standard}
                  onChange={(e) => setStandard(e.target.value as 'tc260' | 'general' | 'custom')}
                >
                  <option value="tc260">TC260测试集</option>
                  <option value="general">通用测试集</option>
                  <option value="custom">自定义测试集</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 6' }}>
                <div className="muted" style={{ marginBottom: 6 }}>
                  测试模式
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <select
                    id="test-mode"
                    className="select"
                    value={testMode}
                    onChange={(e) => setTestMode(e.target.value as 'random' | 'all')}
                  >
                    <option value="random">随机测试</option>
                    <option value="all">全部测试</option>
                  </select>
                  {testMode === 'random' ? (
                    <input
                      className="input"
                      type="number"
                      value={count}
                      min={1}
                      max={maxCount}
                      onChange={(e) => {
                        if (e.target.validity.badInput) {
                          setError('请输入有效的数字')
                          return
                        }
                        if (e.target.value === '') { setCount(''); setError(''); return }
                        const n = Number(e.target.value)
                        if (!Number.isInteger(n)) {
                          setCount(e.target.value as any)
                          setError('随机条数必须为整数')
                          return
                        } else if (maxCount > 0 && n > maxCount) {
                          setCount(maxCount)
                          setError(`已自动调整为当前测试集最大条数 ${maxCount}`)
                        } else if (n < 1) {
                          setCount(1)
                          setError('随机条数不能小于 1，已自动调整为 1')
                        } else {
                          setCount(n)
                          setError('')
                        }
                      }}
                      placeholder="随机条数"
                    />
                  ) : (
                    <div />
                  )}
                </div>
              </div>
              <div className="muted" style={{ gridColumn: 'span 12' }}>
                {testMode === 'random'
                  ? '点击开始评估后会新建评估任务，并从所选测试集中随机抽取prompt进行测试。'
                  : '点击开始评估后会新建评估任务，并测试所选测试集中的全部prompt。'}
              </div>
            </div>
          </section>
        )}

        {error ? (
          <section className="card" style={{ gridColumn: 'span 12' }}>
            <div className="muted">{error}</div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
