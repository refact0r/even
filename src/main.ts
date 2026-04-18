import './style.css'
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { addItem, consumeRecent, loadItems, resetStorage } from './store'
import { GlassesApp, type AppState, type Screen } from './glasses'
import { installDebugConsole } from './debug-console'
import { getApiKey, setApiKey, type Mode } from './client/client'
import { ingestFile } from './data-stream/from-file'
import { ingestLink } from './data-stream/from-link'
import type { Item } from './types'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main>
    <header>
      <h1>Universal Reader</h1>
      <p class="sub">Seed local items here. The glasses are the actual reader UI.</p>
    </header>

    <section class="card status">
      <div><span class="label">Bridge</span><span id="bridge-status">connecting…</span></div>
      <div><span class="label">Screen</span><span id="screen-status">—</span></div>
      <div><span class="label">Item</span><span id="item-status">—</span></div>
      <div><span class="label">Section</span><span id="section-status">—</span></div>
      <div><span class="label">Last call</span><span id="call-status">—</span></div>
    </section>

    <section class="card ingest">
      <div class="section-head">
        <h2>OpenRouter Ingest</h2>
        <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer noopener" class="key-link">Get a key ↗</a>
      </div>
      <div class="ingest-row">
        <input id="api-key-input" type="password" placeholder="sk-or-…" autocomplete="off" />
        <button id="api-key-save" class="slim">Save key</button>
        <span id="api-key-status" class="meta">—</span>
      </div>
      <div class="ingest-row">
        <label class="mode-label" for="mode-select">Mode</label>
        <select id="mode-select">
          <option value="short">short</option>
          <option value="long">long</option>
        </select>
      </div>
      <div class="ingest-row">
        <input id="file-input" type="file" accept=".txt,.pdf,.png,.jpg,.jpeg,.webp,.gif,text/plain,application/pdf,image/*" />
        <button id="file-btn">Summarize file</button>
      </div>
      <div class="ingest-row">
        <input id="url-input" type="url" placeholder="https://example.com/article" />
        <button id="url-btn">Summarize URL</button>
      </div>
      <div id="ingest-status" class="meta">Ready.</div>
    </section>

    <section class="card actions">
      <button id="add-btn">Add dummy item (skip home on next boot)</button>
      <button id="reset-btn" class="ghost">Reset storage &amp; reload</button>
    </section>

    <section class="card debug">
      <div class="section-head">
        <h2>Debug Console</h2>
        <button id="clear-log-btn" class="ghost slim" type="button">Clear</button>
      </div>
      <div id="debug-log" class="debug-log" role="log" aria-live="polite"></div>
    </section>

    <section class="card items">
      <div class="section-head">
        <h2>Stored Items</h2>
        <span id="item-count">0</span>
      </div>
      <ol id="item-list"></ol>
    </section>
  </main>
`

const bridgeStatus = document.querySelector<HTMLSpanElement>('#bridge-status')!
const screenStatus = document.querySelector<HTMLSpanElement>('#screen-status')!
const itemStatus = document.querySelector<HTMLSpanElement>('#item-status')!
const sectionStatus = document.querySelector<HTMLSpanElement>('#section-status')!
const callStatus = document.querySelector<HTMLSpanElement>('#call-status')!
const debugLog = document.querySelector<HTMLDivElement>('#debug-log')!
const clearLogButton = document.querySelector<HTMLButtonElement>('#clear-log-btn')!
const itemCount = document.querySelector<HTMLSpanElement>('#item-count')!
const itemList = document.querySelector<HTMLOListElement>('#item-list')!

installDebugConsole(debugLog, clearLogButton)

const apiKeyInput = document.querySelector<HTMLInputElement>('#api-key-input')!
const apiKeySave = document.querySelector<HTMLButtonElement>('#api-key-save')!
const apiKeyStatus = document.querySelector<HTMLSpanElement>('#api-key-status')!
const modeSelect = document.querySelector<HTMLSelectElement>('#mode-select')!
const fileInput = document.querySelector<HTMLInputElement>('#file-input')!
const fileBtn = document.querySelector<HTMLButtonElement>('#file-btn')!
const urlInput = document.querySelector<HTMLInputElement>('#url-input')!
const urlBtn = document.querySelector<HTMLButtonElement>('#url-btn')!
const ingestStatus = document.querySelector<HTMLDivElement>('#ingest-status')!

function refreshKeyStatus() {
  const key = getApiKey()
  apiKeyStatus.textContent = key ? `saved · …${key.slice(-4)}` : 'no key'
}
refreshKeyStatus()

apiKeySave.addEventListener('click', () => {
  setApiKey(apiKeyInput.value)
  apiKeyInput.value = ''
  refreshKeyStatus()
})

function currentMode(): Mode {
  return modeSelect.value === 'long' ? 'long' : 'short'
}

function setIngestBusy(busy: boolean, message: string) {
  ingestStatus.textContent = message
  fileBtn.disabled = busy
  urlBtn.disabled = busy
}

fileBtn.addEventListener('click', async () => {
  const file = fileInput.files?.[0]
  if (!file) {
    setIngestBusy(false, 'Pick a .txt file first.')
    return
  }
  setIngestBusy(true, `Summarizing ${file.name}…`)
  try {
    const item = await ingestFile(file, currentMode())
    console.info(`ingestFile: ${item.title}`)
    location.reload()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`ingestFile failed: ${msg}`)
    setIngestBusy(false, `Error: ${msg}`)
  }
})

urlBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim()
  if (!url) {
    setIngestBusy(false, 'Paste a URL first.')
    return
  }
  setIngestBusy(true, `Summarizing ${url}…`)
  try {
    const item = await ingestLink(url, currentMode())
    console.info(`ingestLink: ${item.title}`)
    location.reload()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`ingestLink failed: ${msg}`)
    setIngestBusy(false, `Error: ${msg}`)
  }
})

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
  itemCount.textContent = `${items.length} total`
  itemList.innerHTML = items
    .map((it, i) => {
      const active = i === state.itemIndex ? ' class="active"' : ''
      return `
        <li${active}>
          <div class="title-row">
            <span class="title">${escapeHtml(it.title)}</span>
            <span class="type">${it.type}</span>
          </div>
          <div class="meta">${it.sections.length} sections · ${formatTimestamp(it.createdAt)}</div>
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
  if (s === 'home') return 'Home'
  if (s === 'overview') return 'Overview'
  return 'Reading'
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
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
