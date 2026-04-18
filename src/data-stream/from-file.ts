import { generateItem, type Mode } from '../client/client'
import { addItem } from '../store'
import type { Item } from '../types'

const MAX_CHARS = 60_000

export async function ingestFile(file: File, mode: Mode): Promise<Item> {
  const name = file.name || 'untitled'
  const isTxt = /\.txt$/i.test(name) || file.type === 'text/plain'
  if (!isTxt) throw new Error(`Unsupported file type: ${file.type || name}`)

  const raw = await file.text()
  const text = raw.trim()
  if (!text) throw new Error('File is empty')

  const truncated = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text

  const item = await generateItem({
    mode,
    messages: [
      {
        role: 'user',
        content: `Summarize the following document titled "${name}":\n\n${truncated}`,
      },
    ],
  })

  addItem(item)
  return item
}
