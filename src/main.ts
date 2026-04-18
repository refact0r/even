import './style.css'
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { addItem, consumeRecent, loadItems, resetStorage } from './store'
import { GlassesApp, type AppState, type Screen } from './glasses'
import type { Item } from './types'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main>
    <header>
      <h1>Universal Reader</h1>
      <p class="sub">Phone-side control pane. Glasses show the real UI.</p>
    </header>

    <section class="status">
      <div><span class="label">Bridge</span><span id="bridge-status">connecting…</span></div>
      <div><span class="label">Screen</span><span id="screen-status">—</span></div>
      <div><span class="label">Item</span><span id="item-status">—</span></div>
      <div><span class="label">Section</span><span id="section-status">—</span></div>
      <div><span class="label">Last call</span><span id="call-status">—</span></div>
    </section>

    <section class="actions">
      <button id="add-btn">Add dummy item (skip home on next boot)</button>
      <button id="reset-btn" class="ghost">Reset storage &amp; reload</button>
    </section>

    <section class="items">
      <h2>Items</h2>
      <ol id="item-list"></ol>
    </section>
  </main>
`

const bridgeStatus = document.querySelector<HTMLSpanElement>('#bridge-status')!
const screenStatus = document.querySelector<HTMLSpanElement>('#screen-status')!
const itemStatus = document.querySelector<HTMLSpanElement>('#item-status')!
const sectionStatus = document.querySelector<HTMLSpanElement>('#section-status')!
const callStatus = document.querySelector<HTMLSpanElement>('#call-status')!
const itemList = document.querySelector<HTMLOListElement>('#item-list')!

document.querySelector<HTMLButtonElement>('#reset-btn')!.addEventListener('click', () => {
  resetStorage()
  location.reload()
})

document.querySelector<HTMLButtonElement>('#add-btn')!.addEventListener('click', () => {
  const now = Date.now()
  const fresh: Item = {
    id: `item-${now}`,
    title: `Captured ${new Date(now).toLocaleTimeString()}`,
    type: 'short',
    createdAt: now,
    sections: [
      {
        heading: 'Summary',
        content:
          'This is a freshly captured item. It was added from the phone web view. Because it was captured just now, the glasses should jump straight into its overview on next launch instead of the home list.',
      },
      {
        heading: 'Details',
        content:
          'Real ingestion (URL, image OCR, shared text, browser-extension push) will write items into the same localStorage shape the glasses UI already consumes. The skip-to-overview behavior is driven by a short-lived recent-id flag.',
      },
    ],
  }
  addItem(fresh)
  location.reload()
})

function renderItemList(items: Item[], state: AppState) {
  itemList.innerHTML = items
    .map((it, i) => {
      const active = i === state.itemIndex && state.screen !== 'home' ? ' class="active"' : ''
      const sections = it.sections.map((s) => `<li>${escapeHtml(s.heading)}</li>`).join('')
      return `
        <li${active}>
          <div class="title">${escapeHtml(it.title)} <span class="type">(${it.type})</span></div>
          <ul class="sections">${sections}</ul>
        </li>
      `
    })
    .join('')
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      default: return '&#39;'
    }
  })
}

function screenLabel(s: Screen): string {
  if (s === 'home') return 'home (list)'
  if (s === 'overview') return 'overview (sections + preview)'
  return 'reading (full text)'
}

async function main() {
  const items = loadItems()
  const recentId = consumeRecent()
  const recentIdx = recentId ? items.findIndex((it) => it.id === recentId) : -1

  const state: AppState = {
    screen: recentIdx >= 0 ? 'overview' : 'home',
    items,
    itemIndex: recentIdx >= 0 ? recentIdx : 0,
    sectionIndex: 0,
  }

  state.onChange = () => {
    screenStatus.textContent = screenLabel(state.screen)
    const item = state.items[state.itemIndex]
    itemStatus.textContent = item ? `${state.itemIndex + 1}/${state.items.length} — ${item.title}` : '—'
    sectionStatus.textContent =
      state.screen !== 'home' && item?.sections[state.sectionIndex]
        ? `${state.sectionIndex + 1}/${item.sections.length} — ${item.sections[state.sectionIndex].heading}`
        : '—'
    callStatus.textContent = state.lastCall ?? '—'
    renderItemList(state.items, state)
  }

  renderItemList(state.items, state)
  state.onChange()

  const bridge = await waitForEvenAppBridge()
  bridgeStatus.textContent = 'ready'

  const app = new GlassesApp(bridge, state)
  await app.start()
}

main().catch((err) => {
  bridgeStatus.textContent = `error: ${err?.message ?? err}`
  console.error(err)
})
