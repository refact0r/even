import type { Item } from '../types'

export function itemToMarkdown(item: Item): string {
  const iso = new Date(item.createdAt).toISOString()
  const lines: string[] = [`# ${item.title}`, '', `> Captured ${iso} · type: ${item.type}`, '']
  for (const section of item.sections) {
    lines.push(`## ${section.heading}`, '', section.content, '')
  }
  return lines.join('\n').trimEnd() + '\n'
}

export function downloadItem(item: Item): void {
  const markdown = itemToMarkdown(item)
  const filename = `${sanitizeFilename(item.title)}-${dateStamp(item.createdAt)}.md`
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadAll(items: Item[]): number {
  let count = 0
  for (const item of items) {
    downloadItem(item)
    count++
  }
  return count
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return cleaned || 'untitled'
}

function dateStamp(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
