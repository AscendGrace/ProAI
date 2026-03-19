import { chatCompletion, type ModelConfig } from '../../modelClients.js'
import type { ScanOptions } from '../types.js'

export async function callLlm(input: {
  roleSystem: string
  user: string
  modelHint: 'default' | 'thinking' | 'coding' | 'fast'
  temperature: number
  options?: ScanOptions
}): Promise<string> {
  const { roleSystem, user, options } = input

  const modelConfig: ModelConfig = {
    provider: options?.baseUrl?.includes('ollama') ? 'ollama' : 'openai',
    baseUrl: options?.baseUrl || 'https://api.openai.com/v1',
    apiKey: options?.apiKey,
    model: options?.model || 'gpt-4o',
    timeoutMs: 60000
  }

  const response = await chatCompletion(modelConfig, [
    { role: 'system', content: roleSystem },
    { role: 'user', content: user }
  ])

  return response
}
