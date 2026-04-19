import { generateItem } from '../client/client'
import { addItem } from '../store'
import type { Item } from '../types'
import { pickTextMode } from './mode'

const MAX_TEXT_CHARS = 60_000

export async function ingestLink(url: string): Promise<Item> {
  const clean = url.trim()
  let parsed: URL
  try {
    parsed = new URL(clean)
  } catch {
    throw new Error('URL is not well-formed')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL must be http or https')
  }

  const readerUrl = `https://r.jina.ai/${parsed.toString()}`
  const res = await fetch(readerUrl, { headers: { Accept: 'text/plain' } })
  if (!res.ok) throw new Error(`Failed to fetch URL content: ${res.status} ${res.statusText}`)

  const text = (await res.text()).trim()
  if (!text) throw new Error('Page returned no readable content')

  const truncated = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text
  const mode = pickTextMode(truncated)

  const item = await generateItem({
    mode,
    messages: [
      {
        role: 'user',
        content: `Structure the following article into sections with original text:\n\n${truncated}`,
      },
    ],
  })

  addItem(item)
  return item
}
