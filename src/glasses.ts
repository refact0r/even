import {
  EvenAppBridge,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  List_ItemEvent,
  Sys_ItemEvent,
  TextContainerProperty,
  TextContainerUpgrade,
  Text_ItemEvent,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import type { Item } from './types'

const W = 576
const H = 288

const HOME_LIST_ID = 1
const OVW_NAV_ID = 2
const OVW_PREVIEW_ID = 3
const READ_TEXT_ID = 4

const ITEM_NAME_MAX = 62
const OVERVIEW_WINDOW_SIZE = 7
const PREVIEW_CHARS = 380
const READING_CHARS = 2000
const STARTUP_TEXT_BYTES = 999
const STARTUP_READING_BYTES = 999

export type Screen = 'home' | 'overview' | 'reading'

export interface AppState {
  screen: Screen
  items: Item[]
  itemIndex: number
  sectionIndex: number
  lastCall?: string
  onChange?: () => void
}

function trunc(s: string, n: number): string {
  if (!s) return ''
  return s.length <= n ? s : s.slice(0, Math.max(0, n - 1)) + '…'
}

function truncBytes(s: string, maxBytes: number): string {
  if (!s) return ''
  const enc = new TextEncoder()
  if (enc.encode(s).length <= maxBytes) return s
  let lo = 0
  let hi = s.length
  let best = '…'
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const candidate = `${s.slice(0, mid)}…`
    if (enc.encode(candidate).length <= maxBytes) {
      best = candidate
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}

function homeListLabels(items: Item[]) {
  return items
    .slice(0, 20)
    .map((it, i) => trunc(`${i + 1}. ${it.title}`, ITEM_NAME_MAX))
}

function homeList(items: Item[]): ListContainerProperty {
  const names = homeListLabels(items)
  return new ListContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: W,
    height: H,
    borderWidth: 0,
    borderColor: 5,
    borderRadius: 0,
    paddingLength: 4,
    containerID: HOME_LIST_ID,
    containerName: 'home',
    isEventCapture: 1,
    itemContainer: new ListItemContainerProperty({
      itemCount: names.length || 1,
      itemWidth: W - 8,
      isItemSelectBorderEn: 1,
      itemName: names.length ? names : ['(no items yet)'],
    }),
  })
}

function overviewSectionLabels(item: Item) {
  return item.sections.slice(0, 20).map((s) => trunc(s.heading, ITEM_NAME_MAX))
}

function overviewNavText(item: Item, activeSection: number): string {
  const names = overviewSectionLabels(item)
  if (!names.length) return '(no sections)'
  const halfWindow = Math.floor(OVERVIEW_WINDOW_SIZE / 2)
  const start = Math.max(0, Math.min(activeSection - halfWindow, names.length - OVERVIEW_WINDOW_SIZE))
  const end = Math.min(names.length, start + OVERVIEW_WINDOW_SIZE)
  const lines: string[] = []
  if (start > 0) lines.push('...')
  for (let i = start; i < end; i += 1) {
    lines.push(`${i === activeSection ? '> ' : '  '}${names[i]}`)
  }
  if (end < names.length) lines.push('...')
  return lines.join('\n')
}

function overviewNav(item: Item, idx: number): TextContainerProperty {
  const names = overviewSectionLabels(item)
  return new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: 240,
    height: H,
    borderWidth: 1,
    borderColor: 8,
    borderRadius: 0,
    paddingLength: 4,
    containerID: OVW_NAV_ID,
    containerName: 'sections',
    isEventCapture: 1,
    content: truncBytes(names.length ? overviewNavText(item, idx) : '(no sections)', STARTUP_TEXT_BYTES),
  })
}

function previewText(item: Item, idx: number, maxChars = PREVIEW_CHARS): string {
  const section = item.sections[idx]
  if (!section) return ''
  const header = `${section.heading}\n\n`
  return header + trunc(section.content, Math.max(40, maxChars - header.length))
}

function overviewPreview(item: Item, idx: number): TextContainerProperty {
  return new TextContainerProperty({
    xPosition: 240,
    yPosition: 0,
    width: W - 240,
    height: H,
    borderWidth: 0,
    borderColor: 5,
    borderRadius: 0,
    paddingLength: 4,
    containerID: OVW_PREVIEW_ID,
    containerName: 'preview',
    isEventCapture: 0,
    content: truncBytes(previewText(item, idx, PREVIEW_CHARS), STARTUP_TEXT_BYTES),
  })
}

function readingSectionText(item: Item, idx: number, maxChars = READING_CHARS) {
  const section = item.sections[idx]
  if (!section) return trunc(item.title, maxChars)
  const heading =
    item.sections.length > 1 ? `${section.heading} (${idx + 1}/${item.sections.length})` : section.heading
  return trunc(`${item.title}\n\n${heading}\n\n${section.content}`, maxChars)
}

function readingContainer(text: string): TextContainerProperty {
  return new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: W,
    height: H,
    borderWidth: 0,
    borderColor: 5,
    borderRadius: 0,
    paddingLength: 6,
    containerID: READ_TEXT_ID,
    containerName: 'reading',
    isEventCapture: 1,
    content: text,
  })
}

export class GlassesApp {
  private bridge: EvenAppBridge
  private state: AppState
  private started = false
  private rendering = false
  private activeContainerName: 'home' | 'sections' | 'reading' | null = null

  constructor(bridge: EvenAppBridge, state: AppState) {
    this.bridge = bridge
    this.state = state
  }

  async start() {
    this.bridge.onEvenHubEvent((evt) => {
      if (evt.listEvent) {
        this.logEvent('list', evt.listEvent)
        const idx = this.normalizeListIndex(evt.listEvent)
        this.handleList(
          this.normalizeListEventType(evt.listEvent),
          idx,
          evt.listEvent.containerName,
        )
      } else if (evt.textEvent) {
        this.logEvent('text', evt.textEvent)
        this.handleText(this.normalizeTextEventType(evt.textEvent), evt.textEvent.containerName)
      } else if (evt.sysEvent) {
        this.logEvent('sys', evt.sysEvent)
        this.handleSystem(evt.sysEvent)
      }
    })
    await this.renderCurrent()
  }

  private notify() {
    this.state.onChange?.()
  }

  private async renderCurrent() {
    if (this.state.screen === 'home') await this.pushHome()
    else if (this.state.screen === 'overview') await this.pushOverview()
    else await this.pushReading()
    this.notify()
  }

  private async pushHome(resetFocus = false) {
    if (this.rendering) return false
    this.rendering = true
    if (resetFocus) this.state.itemIndex = 0
    const list = homeList(this.state.items)
    try {
      const ok = await this.renderPage('home', {
        containerTotalNum: 1,
        listObject: [list],
      })
      if (!ok) return false
      this.state.screen = 'home'
      this.activeContainerName = 'home'
      return true
    } finally {
      this.rendering = false
    }
  }

  private async pushOverview() {
    const item = this.state.items[this.state.itemIndex]
    if (!item) return this.pushHome()
    if (this.rendering) return false
    this.rendering = true
    // Keep the event-capturing nav container last so overview scroll/click reaches it reliably.
    const preview = overviewPreview(item, this.state.sectionIndex)
    const nav = overviewNav(item, this.state.sectionIndex)
    try {
      const ok = await this.renderPage('overview', {
        containerTotalNum: 2,
        textObject: [preview, nav],
      })
      if (!ok) return false
      this.state.screen = 'overview'
      this.activeContainerName = 'sections'
      return true
    } finally {
      this.rendering = false
    }
  }

  private async pushReading() {
    const item = this.state.items[this.state.itemIndex]
    if (!item) return this.pushHome()
    if (this.rendering) {
      this.state.lastCall = 'pushReading blocked: render in progress'
      this.notify()
      return false
    }
    this.rendering = true
    const content = readingSectionText(item, this.state.sectionIndex)
    const startupText = truncBytes(content, STARTUP_READING_BYTES)
    const text = readingContainer(startupText)
    try {
      const ok = await this.renderPage('reading', {
        containerTotalNum: 1,
        textObject: [text],
      })
      if (!ok) {
        this.state.lastCall = 'pushReading failed: renderPage(reading)'
        this.notify()
        return false
      }
      this.state.screen = 'reading'
      this.activeContainerName = 'reading'
      const upgraded = await this.updateReadingSelection(item, this.state.sectionIndex, false)
      if (!upgraded) {
        this.notify()
        return false
      }
      return true
    } finally {
      this.rendering = false
    }
  }

  private async renderPage(
    label: Screen,
    container: {
      containerTotalNum: number
      listObject?: ListContainerProperty[]
      textObject?: TextContainerProperty[]
    },
  ) {
    if (!this.started) {
      const result = await this.bridge.createStartUpPageContainer(
        new CreateStartUpPageContainer(container),
      )
      this.state.lastCall = `createStartUpPageContainer(${label}) → ${result}`
      console.log('[glasses]', this.state.lastCall)
      if (result === 0) {
        this.started = true
        return true
      }
      return false
    }
    const result = await this.bridge.rebuildPageContainer(new RebuildPageContainer(container))
    this.state.lastCall = `rebuildPageContainer(${label}) → ${result}`
    console.log('[glasses]', this.state.lastCall)
    return result
  }

  private resolveIndex(next: number | undefined, current: number, count: number) {
    if (count <= 0) return -1
    if (typeof next === 'number' && Number.isFinite(next)) {
      return Math.min(Math.max(next, 0), count - 1)
    }
    return Math.min(Math.max(current, 0), count - 1)
  }

  private resolveTargetIndex(
    et: OsEventTypeList,
    next: number | undefined,
    current: number,
    count: number,
  ) {
    if (count <= 0) return -1
    if (typeof next === 'number' && Number.isFinite(next)) {
      return this.resolveIndex(next, current, count)
    }
    if (et === OsEventTypeList.SCROLL_TOP_EVENT) {
      return this.resolveIndex(current - 1, current, count)
    }
    if (et === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      return this.resolveIndex(current + 1, current, count)
    }
    return this.resolveIndex(undefined, current, count)
  }

  private listCountForScreen() {
    if (this.state.screen === 'overview') {
      return this.state.items[this.state.itemIndex]?.sections.length ?? 0
    }
    return this.state.items.length
  }

  private listLabelsForScreen() {
    if (this.state.screen === 'overview') {
      const item = this.state.items[this.state.itemIndex]
      return item ? overviewSectionLabels(item) : []
    }
    return homeListLabels(this.state.items)
  }

  private normalizeListEventType(evt: List_ItemEvent) {
    if (evt.eventType !== undefined) return evt.eventType
    if (
      evt.containerName
      || evt.containerID !== undefined
      || evt.currentSelectItemName !== undefined
      || evt.currentSelectItemIndex !== undefined
    ) {
      console.debug('[nav:list-infer-click]', {
        containerName: evt.containerName,
        containerID: evt.containerID,
        currentSelectItemName: evt.currentSelectItemName,
        currentSelectItemIndex: evt.currentSelectItemIndex,
      })
      return OsEventTypeList.CLICK_EVENT
    }
    return undefined
  }

  private normalizeTextEventType(evt: Text_ItemEvent) {
    if (evt.eventType !== undefined) return evt.eventType
    console.debug('[nav:text-infer-click]', {
      containerName: evt.containerName,
      containerID: evt.containerID,
    })
    return OsEventTypeList.CLICK_EVENT
  }

  private normalizeSystemEventType(evt: Sys_ItemEvent) {
    if (evt.eventType !== undefined) return evt.eventType
    if (evt.eventSource !== undefined) {
      console.debug('[nav:sys-infer-click]', {
        screen: this.state.screen,
        activeContainerName: this.activeContainerName,
        eventSource: evt.eventSource,
      })
      return OsEventTypeList.CLICK_EVENT
    }
    return undefined
  }

  private normalizeListIndex(evt: List_ItemEvent) {
    const label = evt.currentSelectItemName
    if (label) {
      const matched = this.listLabelsForScreen().findIndex((name) => name === label)
      if (matched >= 0) return matched
    }
    const idx = evt.currentSelectItemIndex
    if (typeof idx !== 'number' || !Number.isFinite(idx)) {
      if (evt.eventType === undefined) {
        return this.state.screen === 'overview' ? this.state.sectionIndex : this.state.itemIndex
      }
      return undefined
    }
    if (idx >= 0 && idx < this.listCountForScreen()) return idx
    const oneBased = idx - 1
    if (oneBased >= 0 && oneBased < this.listCountForScreen()) {
      console.debug('[nav:list-normalize-one-based]', {
        containerName: evt.containerName,
        rawIndex: idx,
        normalizedIndex: oneBased,
      })
      return oneBased
    }
    return idx
  }

  private handleList(
    et: OsEventTypeList | undefined,
    idx: number | undefined,
    containerName: string | undefined,
  ) {
    if (et === undefined) return
    if (containerName && this.activeContainerName && containerName !== this.activeContainerName) {
      console.debug('[nav:list-ignore-stale]', {
        expected: this.activeContainerName,
        actual: containerName,
        et,
      })
      return
    }
    console.debug('[nav:list]', {
      screen: this.state.screen,
      activeContainerName: this.activeContainerName,
      eventContainerName: containerName,
      idx,
      et,
    })
    if (this.state.screen === 'home') this.handleHomeList(et, idx)
  }

  private handleHomeList(et: OsEventTypeList, idx: number | undefined) {
    const nextIndex = this.resolveTargetIndex(et, idx, this.state.itemIndex, this.state.items.length)
    if (et === OsEventTypeList.SCROLL_TOP_EVENT || et === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      if (nextIndex >= 0) {
        this.state.itemIndex = nextIndex
        this.notify()
      }
      return
    }
    if (et === OsEventTypeList.CLICK_EVENT) {
      if (nextIndex < 0 || !this.state.items[nextIndex]) return
      this.state.itemIndex = nextIndex
      this.state.sectionIndex = 0
      console.debug('[nav:home-click]', {
        nextIndex,
        itemTitle: this.state.items[nextIndex]?.title,
      })
      void this.pushOverview().then((ok) => {
        console.debug('[nav:home-click-result]', { ok, screen: this.state.screen })
        this.notify()
      })
      return
    }
    if (et === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      void this.bridge.shutDownPageContainer(1)
    }
  }

  private async updateOverviewSelection(item: Item, idx: number) {
    const nav = overviewNavText(item, idx)
    const preview = previewText(item, idx, PREVIEW_CHARS)
    const [navOk, previewOk] = await Promise.all([
      this.bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: OVW_NAV_ID,
          containerName: 'sections',
          contentOffset: 0,
          contentLength: nav.length,
          content: nav,
        }),
      ),
      this.bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: OVW_PREVIEW_ID,
          containerName: 'preview',
          contentOffset: 0,
          contentLength: preview.length,
          content: preview,
        }),
      ),
    ])
    const ok = navOk && previewOk
    this.state.lastCall = `textContainerUpgrade(overview) → ${ok}`
    console.log('[glasses]', this.state.lastCall)
    if (!ok) {
      await this.pushOverview()
    } else {
      this.notify()
    }
    return ok
  }

  private async updateReadingSelection(item: Item, idx: number, fallbackToRebuild = true) {
    const content = readingSectionText(item, idx)
    const ok = await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: READ_TEXT_ID,
        containerName: 'reading',
        contentOffset: 0,
        contentLength: content.length,
        content,
      }),
    )
    this.state.lastCall = `textContainerUpgrade(reading) → ${ok}`
    console.log('[glasses]', this.state.lastCall)
    if (!ok) {
      if (fallbackToRebuild && !this.rendering) {
        await this.pushReading()
      }
    } else {
      this.notify()
    }
    return ok
  }

  private handleOverviewInput(et: OsEventTypeList) {
    const item = this.state.items[this.state.itemIndex]
    if (!item) return
    const nextIndex = this.resolveTargetIndex(et, undefined, this.state.sectionIndex, item.sections.length)
    if (et === OsEventTypeList.CLICK_EVENT) {
      if (nextIndex < 0 || !item.sections[nextIndex]) return
      this.setSelectedSection(item, nextIndex)
      void this.pushReading().then(() => this.notify())
      return
    }
    if (et === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      void this.pushHome(true).then(() => this.notify())
      return
    }
    if (et !== OsEventTypeList.SCROLL_TOP_EVENT && et !== OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      return
    }
    if (nextIndex < 0) return
    void this.syncOverviewSelection(item, nextIndex, 'text')
  }

  private setSelectedSection(item: Item, idx: number) {
    if (!item.sections[idx]) return false
    const changed = this.state.sectionIndex !== idx
    this.state.sectionIndex = idx
    console.debug('[nav:section-select]', {
      itemIndex: this.state.itemIndex,
      sectionIndex: idx,
      sectionHeading: item.sections[idx]?.heading,
      changed,
    })
    return changed
  }

  private async syncOverviewSelection(item: Item, idx: number, source: 'text' | 'sys') {
    const changed = this.setSelectedSection(item, idx)
    if (!changed) {
      this.notify()
      return
    }
    console.debug('[nav:overview-sync]', { source, sectionIndex: idx })
    await this.updateOverviewSelection(item, idx)
  }

  private handleReadingInput(et: OsEventTypeList, source: 'text' | 'sys') {
    const item = this.state.items[this.state.itemIndex]
    if (!item) return
    if (et === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      void this.pushOverview().then(() => this.notify())
      return
    }
    if (et !== OsEventTypeList.SCROLL_TOP_EVENT && et !== OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      return
    }
    const nextIndex = this.resolveTargetIndex(et, undefined, this.state.sectionIndex, item.sections.length)
    if (nextIndex < 0 || nextIndex === this.state.sectionIndex || !item.sections[nextIndex]) return
    void this.syncReadingSelection(item, nextIndex, source)
  }

  private async syncReadingSelection(item: Item, idx: number, source: 'text' | 'sys') {
    const changed = this.setSelectedSection(item, idx)
    if (!changed) {
      this.notify()
      return
    }
    console.debug('[nav:reading-sync]', { source, sectionIndex: idx })
    await this.updateReadingSelection(item, idx)
  }

  private handleText(et: OsEventTypeList | undefined, containerName: string | undefined) {
    if (et === undefined) return
    if (this.state.screen === 'overview') {
      if (containerName && containerName !== 'sections') return
      this.handleOverviewInput(et)
      return
    }
    if (this.state.screen !== 'reading') return
    if (containerName && this.activeContainerName && containerName !== this.activeContainerName) {
      console.debug('[nav:text-ignore-stale]', {
        expected: this.activeContainerName,
        actual: containerName,
        et,
      })
      return
    }
    console.debug('[nav:text]', {
      screen: this.state.screen,
      activeContainerName: this.activeContainerName,
      eventContainerName: containerName,
      et,
    })
    this.handleReadingInput(et, 'text')
  }

  private handleSystem(evt: Sys_ItemEvent) {
    const et = this.normalizeSystemEventType(evt)

    if (et === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
      void this.renderCurrent()
      return
    }

    if (
      this.state.screen === 'overview'
      && (et === OsEventTypeList.SCROLL_TOP_EVENT
        || et === OsEventTypeList.SCROLL_BOTTOM_EVENT)
    ) {
      const item = this.state.items[this.state.itemIndex]
      if (!item) return
      const nextIndex = this.resolveTargetIndex(
        et,
        undefined,
        this.state.sectionIndex,
        item.sections.length,
      )
      if (nextIndex < 0) return
      void this.syncOverviewSelection(item, nextIndex, 'sys')
      return
    }

    if (
      this.state.screen === 'reading'
      && (et === OsEventTypeList.SCROLL_TOP_EVENT
        || et === OsEventTypeList.SCROLL_BOTTOM_EVENT
        || et === OsEventTypeList.DOUBLE_CLICK_EVENT)
    ) {
      this.handleReadingInput(et, 'sys')
      return
    }

    if (this.state.screen === 'overview' && et === OsEventTypeList.CLICK_EVENT) {
      this.handleOverviewInput(OsEventTypeList.CLICK_EVENT)
      return
    }

    if (et !== OsEventTypeList.DOUBLE_CLICK_EVENT) return

    console.debug('[nav:sys-double-click]', {
      screen: this.state.screen,
      activeContainerName: this.activeContainerName,
      eventSource: evt.eventSource,
    })

    if (this.state.screen === 'home') {
      void this.bridge.shutDownPageContainer(1)
      return
    }
    if (this.state.screen === 'overview') {
      void this.pushHome(true).then(() => this.notify())
      return
    }
    if (this.state.screen === 'reading') {
      void this.pushOverview().then(() => this.notify())
    }
  }

  private logEvent(kind: 'list' | 'text' | 'sys', payload: object) {
    console.debug(`[event:${kind}]`, payload)
  }
}
