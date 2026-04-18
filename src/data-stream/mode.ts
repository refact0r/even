import type { Mode } from '../client/client'

const SHORT_WORD_THRESHOLD = 250

export function pickTextMode(text: string): Mode {
  return countWords(text) < SHORT_WORD_THRESHOLD ? 'short' : 'long'
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
