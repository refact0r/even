import { generateItem, type Mode } from '../client/client'
import { addItem } from '../store'
import type { Item } from '../types'

export async function ingestLink(url: string, mode: Mode): Promise<Item> {
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

  const item = await generateItem({
    mode,
    messages: [
      {
        role: 'user',
        content: `Fetch the contents of this URL and summarize it: ${parsed.toString()}`,
      },
    ],
  })

  addItem(item)
  return item
}
