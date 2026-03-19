import { z } from 'zod'

export type Provider = 'ollama' | 'openai'

export type ModelConfig = {
  provider: Provider
  baseUrl: string
  apiKey?: string
  model?: string
  timeoutMs?: number
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function chatCompletion(config: ModelConfig, messages: ChatMessage[]) {
  if (config.provider === 'ollama') {
    return ollamaChat(config, messages)
  }
  return openaiChat(config, messages)
}

async function ollamaChat(config: ModelConfig, messages: ChatMessage[]) {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/api/chat`
  const res = await fetchWithTimeout(
    url,
    {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model ?? 'llama3',
      messages,
      stream: false,
    }),
    },
    config.timeoutMs,
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ollama请求失败: ${res.status} ${text}`.slice(0, 500))
  }
  const json = await res.json()
  const parsed = z
    .object({
      message: z.object({ content: z.string() }),
    })
    .safeParse(json)
  if (!parsed.success) {
    throw new Error('Ollama响应解析失败')
  }
  return parsed.data.message.content
}

async function openaiChat(config: ModelConfig, messages: ChatMessage[]) {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const url = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`
  const res = await fetchWithTimeout(
    url,
    {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model ?? 'gpt-4o-mini',
      messages,
      temperature: 0,
    }),
    },
    config.timeoutMs,
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI请求失败: ${res.status} ${text}`.slice(0, 500))
  }
  const json = await res.json()
  const parsed = z
    .object({
      choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
    })
    .safeParse(json)
  if (!parsed.success) {
    throw new Error('OpenAI响应解析失败')
  }
  return parsed.data.choices[0].message.content ?? ''
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs?: number) {
  const ms = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 30_000
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isAbort =
      e instanceof Error &&
      (e.name === 'AbortError' || /aborted/i.test(e.message) || /被中止/.test(e.message) || /中止/.test(e.message))
    const head = isAbort ? `请求超时(${ms}ms)` : '请求失败'
    throw new Error(`${head}: ${msg} (${url})`.slice(0, 300))
  } finally {
    clearTimeout(t)
  }
}
