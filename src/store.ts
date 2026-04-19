import type { Item } from './types'

const ITEMS_KEY = 'universal-reader:items'
const RECENT_KEY = 'universal-reader:recent-id'
const RECENT_WINDOW_MS = 60_000

const DUMMY_ITEMS: Item[] = [
  {
    id: 'item-welcome',
    title: 'Welcome to Universal Reader',
    type: 'short',
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    sections: [
      {
        heading: 'What this is',
        content:
          'Universal Reader turns anything you capture — an article URL, a photo of a page, a quick memo — into a readable HUD view on your G2 glasses. The phone does the heavy lifting; the glasses just display.',
      },
      {
        heading: 'How to navigate',
        content:
          'One tap selects. Double tap goes back. Swipe up or down on the temple to scroll through the list. From the overview, tap a section heading to start reading that section in full.',
      },
      {
        heading: 'What comes next',
        content:
          'Your teammate is wiring up real ingestion (URLs, images, shared text, browser-extension pushes). For now, this app ships with three dummy items so you can feel the flow. Add a fresh one from the phone web view and it will skip the home screen.',
      },
    ],
  },
  {
    id: 'item-climate',
    title: 'Ocean currents are slowing — what we know',
    type: 'long',
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
    sections: [
      {
        heading: 'The headline',
        content:
          'New measurements suggest the Atlantic Meridional Overturning Circulation, the system of currents that carries warm water north and cold water south, has weakened to its slowest rate in over a millennium. Researchers caution that the trend is clear but the endpoint is not.',
      },
      {
        heading: 'Why it matters',
        content:
          'AMOC regulates temperature on both sides of the Atlantic. A meaningful slowdown could shift European winters colder, tropical monsoons off schedule, and sea levels along the US eastern seaboard higher. The changes would play out over decades, not seasons.',
      },
      {
        heading: 'What the evidence looks like',
        content:
          'Scientists triangulate from three sources: direct mooring measurements in the deep Atlantic, sea-surface temperature records going back to the 1800s, and proxies pulled from deep-sea sediments. No single record is definitive; together they tell a consistent story of gradual decline since the mid-twentieth century.',
      },
      {
        heading: 'What is still uncertain',
        content:
          'The big open question is whether AMOC will continue drifting toward a weaker but stable state, or whether it will cross a threshold and collapse. Climate models disagree on the odds. Most researchers treat a full collapse this century as unlikely but not impossible.',
      },
      {
        heading: 'What to watch',
        content:
          'Keep an eye on three signals: freshwater flux from Greenland melt, the size of the cold blob south of Iceland, and the next round of CMIP model runs. Any of those shifting sharply would update the picture.',
      },
    ],
  },
  {
    id: 'item-memo',
    title: 'Memo: Q2 reading-app priorities',
    type: 'short',
    createdAt: Date.now() - 1000 * 60 * 45,
    sections: [
      {
        heading: 'Top priority',
        content:
          'Ship the ingestion pipeline end-to-end. That means URL capture, image OCR, and the browser-extension push path all land in the same item store the glasses UI already reads from.',
      },
      {
        heading: 'Nice to have',
        content:
          'Offline cache of the last ten items so the glasses work without a live connection. Minimal per-section bookmarks so users can resume long reads across sessions.',
      },
      {
        heading: 'Not this quarter',
        content:
          'Annotation, highlighting, sharing back out. These are worth doing eventually but they stretch scope past the core reading loop. Revisit in Q3.',
      },
    ],
  },
]

export function loadItems(): Item[] {
  const raw = localStorage.getItem(ITEMS_KEY)
  if (!raw) {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(DUMMY_ITEMS))
    return DUMMY_ITEMS
  }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  localStorage.setItem(ITEMS_KEY, JSON.stringify(DUMMY_ITEMS))
  return DUMMY_ITEMS
}

export function saveItems(items: Item[]) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items))
}

export function addItem(item: Item) {
  const items = loadItems()
  items.unshift(item)
  saveItems(items)
  markRecent(item.id)
}

export function removeItem(id: string): Item[] {
  const items = loadItems().filter((it) => it.id !== id)
  saveItems(items)
  return items
}

export function markRecent(id: string) {
  localStorage.setItem(RECENT_KEY, JSON.stringify({ id, t: Date.now() }))
}

export function consumeRecent(): string | null {
  const raw = localStorage.getItem(RECENT_KEY)
  if (!raw) return null
  localStorage.removeItem(RECENT_KEY)
  try {
    const { id, t } = JSON.parse(raw)
    if (typeof id === 'string' && Date.now() - t < RECENT_WINDOW_MS) return id
  } catch {}
  return null
}

export function resetStorage() {
  localStorage.removeItem(ITEMS_KEY)
  localStorage.removeItem(RECENT_KEY)
}
