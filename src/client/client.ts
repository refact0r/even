import shortFormPrompt from './prompts/short-form.txt?raw'
import longFormPrompt from './prompts/long-form.txt?raw'
import type { Item, ItemType, Section } from '../types'

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'openai/gpt-4o-mini'
const API_KEY_STORAGE = 'universal-reader:openrouter-key'

export type Mode = 'short' | 'long'

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } }

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
}

export interface OpenRouterPlugin {
  id: string
  pdf?: { engine: 'pdf-text' | 'mistral-ocr' | 'native' }
}

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE)
}

export function setApiKey(key: string): void {
  const trimmed = key.trim()
  if (trimmed) localStorage.setItem(API_KEY_STORAGE, trimmed)
  else localStorage.removeItem(API_KEY_STORAGE)
}

export async function generateItem(args: {
  mode: Mode
  messages: ChatMessage[]
  plugins?: OpenRouterPlugin[]
}): Promise<Item> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('OpenRouter API key is not set')

  const body: Record<string, unknown> = {
    model: DEFAULT_MODEL,
    response_format: { type: 'json_object' as const },
    messages: [
      { role: 'system' as const, content: loadPrompt(args.mode) },
      ...args.messages,
    ],
  }
  if (args.plugins && args.plugins.length > 0) body.plugins = args.plugins

  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin,
      'X-Title': 'Universal Reader',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${detail || res.statusText}`)
  }

  const payload = await res.json()
  const content: unknown = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('OpenRouter response missing message content')
  }

  const parsed = parseJsonPayload(content)
  const item = validateItem(parsed, args.mode)
  if (!item) throw new Error('LLM output failed schema validation')

  return stampItem(item)
}

function loadPrompt(mode: Mode): string {
  return mode === 'short' ? shortFormPrompt : longFormPrompt
}

function parseJsonPayload(raw: string): unknown {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const first = trimmed.indexOf('{')
    const last = trimmed.lastIndexOf('}')
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(trimmed.slice(first, last + 1))
      } catch {}
    }
    throw new Error('LLM output was not valid JSON')
  }
}

function validateItem(raw: unknown, mode: Mode): Omit<Item, 'id' | 'createdAt'> | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  const type = obj.type
  if (type !== 'short' && type !== 'long') return null
  if (type !== mode) return null

  const title = obj.title
  if (typeof title !== 'string' || !title.trim()) return null

  const sections = obj.sections
  if (!Array.isArray(sections) || sections.length === 0) return null
  if (mode === 'short' && sections.length !== 1) return null
  if (mode === 'long' && sections.length > 7) return null

  const cleanSections: Section[] = []
  for (const s of sections) {
    if (!s || typeof s !== 'object') return null
    const sec = s as Record<string, unknown>
    if (typeof sec.heading !== 'string' || !sec.heading.trim()) return null
    if (typeof sec.content !== 'string' || !sec.content.trim()) return null
    cleanSections.push({ heading: sec.heading.trim(), content: sec.content.trim() })
  }

  if (cleanSections[0].heading.toLowerCase() !== 'summary') return null
  cleanSections[0] = { ...cleanSections[0], heading: 'Summary' }

  return {
    type: type as ItemType,
    title: title.trim(),
    sections: cleanSections,
  }
}

function stampItem(partial: Omit<Item, 'id' | 'createdAt'>): Item {
  const now = Date.now()
  return {
    id: `item-${now}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    ...partial,
  }
}
