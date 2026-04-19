import { generateItem, type ChatMessage, type Mode, type OpenRouterPlugin } from '../client/client'
import { addItem } from '../store'
import type { Item } from '../types'
import { pickTextMode } from './mode'

const MAX_TEXT_CHARS = 60_000
const MAX_BINARY_BYTES = 20 * 1024 * 1024

type Kind = 'text' | 'image' | 'pdf'

export async function ingestFile(file: File): Promise<Item> {
  const name = file.name || 'untitled'
  const kind = detectKind(file, name)
  if (!kind) throw new Error(`Unsupported file type: ${file.type || name}`)

  let messages: ChatMessage[]
  let plugins: OpenRouterPlugin[] | undefined
  let mode: Mode = 'long'

  if (kind === 'text') {
    const text = (await file.text()).trim()
    if (!text) throw new Error('File is empty')
    mode = pickTextMode(text)
    const truncated = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text
    messages = [
      {
        role: 'user',
        content: `Structure the following document titled "${name}" into sections with original text:\n\n${truncated}`,
      },
    ]
  } else if (kind === 'image') {
    if (file.size > MAX_BINARY_BYTES) throw new Error('Image is larger than 20 MB')
    const dataUrl = await readAsDataUrl(file)
    messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Summarize the content visible in this image titled "${name}".` },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ]
  } else {
    if (file.size > MAX_BINARY_BYTES) throw new Error('PDF is larger than 20 MB')
    const dataUrl = await readAsDataUrl(file)
    messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Summarize the following PDF titled "${name}".` },
          { type: 'file', file: { filename: name, file_data: dataUrl } },
        ],
      },
    ]
    plugins = [{ id: 'file-parser', pdf: { engine: 'pdf-text' } }]
  }

  const item = await generateItem({ mode, messages, plugins })
  addItem(item)
  return item
}

function detectKind(file: File, name: string): Kind | null {
  const type = file.type.toLowerCase()
  const lower = name.toLowerCase()
  if (type === 'text/plain' || lower.endsWith('.txt')) return 'text'
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(lower)) return 'image'
  if (type === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf'
  return null
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') reject(new Error('Could not read file'))
      else resolve(result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(file)
  })
}
