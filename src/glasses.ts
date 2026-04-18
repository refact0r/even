import {
  EvenAppBridge,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  List_ItemEvent,
  TextContainerProperty,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import type { Item } from './types'

const W = 576
const H = 288

const HOME_LIST_ID = 1
const OVW_LIST_ID = 2
const OVW_PREVIEW_ID = 3
const READ_TEXT_ID = 4

const ITEM_NAME_MAX = 62
const PREVIEW_CHARS = 380
const READING_CHARS = 1800
const STARTUP_TEXT_CHARS = 900

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

function homeList(items: Item[]): ListContainerProperty {
  const names = items.slice(0, 20).map((it, i) =>
    trunc(`${i + 1}. ${it.title}`, ITEM_NAME_MAX),
  )
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

function overviewList(item: Item, activeSection: number): ListContainerProperty {
  const names = item.sections.slice(0, 20).map((s, i) => {
    const mark = i === activeSection ? '> ' : '  '
    return trunc(`${mark}${s.heading}`, ITEM_NAME_MAX)
  })
  return new ListContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: 240,
    height: H,
    borderWidth: 1,
    borderColor: 8,
    borderRadius: 0,
    paddingLength: 4,
    containerID: OVW_LIST_ID,
    containerName: 'sections',
    isEventCapture: 1,
    itemContainer: new ListItemContainerProperty({
      itemCount: names.length || 1,
      itemWidth: 232,
      isItemSelectBorderEn: 1,
      itemName: names.length ? names : ['(no sections)'],
    }),
  })
}

function overviewPreview(item: Item, idx: number, maxChars: number): TextContainerProperty {
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
    content: previewText(item, idx, maxChars),
  })
}

function previewText(item: Item, idx: number, maxChars = PREVIEW_CHARS): string {
  const s = item.sections[idx]
  if (!s) return ''
  const header = `${s.heading}\n\n`
  return header + trunc(s.content, Math.max(40, maxChars - header.length))
}

function readingContainer(item: Item, idx: number, maxChars: number): TextContainerProperty {
  const s = item.sections[idx]
  const header = s ? `${s.heading}\n\n` : ''
  const body = s ? s.content : '(empty)'
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
    content: trunc(header + body, maxChars),
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
        this.handleText(evt.textEvent.eventType, evt.textEvent.containerName)
        this.handleGenericInput(evt.textEvent.eventType, evt.textEvent.containerName)
      } else if (evt.sysEvent) {
        this.logEvent('sys', evt.sysEvent)
        this.handleSystem(evt.sysEvent.eventType)
        this.handleGenericInput(evt.sysEvent.eventType)
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

  private async pushHome() {
    if (this.rendering) return false
    this.rendering = true
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
    const list = overviewList(item, this.state.sectionIndex)
    const preview = overviewPreview(
      item,
      this.state.sectionIndex,
      this.started ? PREVIEW_CHARS : STARTUP_TEXT_CHARS,
    )
    try {
      const ok = await this.renderPage('overview', {
        containerTotalNum: 2,
        listObject: [list],
        textObject: [preview],
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
    if (this.rendering) return false
    this.rendering = true
    const text = readingContainer(item, this.state.sectionIndex, READING_CHARS)
    try {
      const ok = await this.renderPage('reading', {
        containerTotalNum: 1,
        textObject: [text],
      })
      if (!ok) return false
      this.state.screen = 'reading'
      this.activeContainerName = 'reading'
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
      const r = await this.bridge.createStartUpPageContainer(new CreateStartUpPageContainer(container))
      this.state.lastCall = `createStartUpPageContainer(${label}) → ${r}`
      console.log('[glasses]', this.state.lastCall)
      if (r === 0) {
        this.started = true
        return true
      }
      return false
    }
    const r = await this.bridge.rebuildPageContainer(new RebuildPageContainer(container))
    this.state.lastCall = `rebuildPageContainer(${label}) → ${r}`
    console.log('[glasses]', this.state.lastCall)
    return r
  }

  private resolveIndex(next: number | undefined, current: number, count: number) {
    if (count <= 0) return -1
    if (typeof next === 'number' && Number.isFinite(next)) {
      return Math.min(Math.max(next, 0), count - 1)
    }
    return Math.min(Math.max(current, 0), count - 1)
  }

  private isNavigationEvent(et: OsEventTypeList | undefined) {
    return (
      et === OsEventTypeList.CLICK_EVENT ||
      et === OsEventTypeList.DOUBLE_CLICK_EVENT ||
      et === OsEventTypeList.SCROLL_TOP_EVENT ||
      et === OsEventTypeList.SCROLL_BOTTOM_EVENT
    )
  }

  private normalizeListEventType(evt: List_ItemEvent) {
    if (evt.eventType !== undefined) return evt.eventType
    if (evt.containerName) {
      console.debug('[nav:list-infer-click]', {
        containerName: evt.containerName,
        idx: evt.currentSelectItemIndex,
      })
      return OsEventTypeList.CLICK_EVENT
    }
    return undefined
  }

  private normalizeListIndex(evt: List_ItemEvent) {
    const idx = evt.currentSelectItemIndex
    if (typeof idx !== 'number' || !Number.isFinite(idx)) {
      if (evt.eventType === undefined) {
        console.debug('[nav:list-infer-current-index]', {
          containerName: evt.containerName,
          currentItemIndex: this.state.itemIndex,
          currentSectionIndex: this.state.sectionIndex,
          screen: this.state.screen,
        })
        return this.state.screen === 'overview' ? this.state.sectionIndex : this.state.itemIndex
      }
      return undefined
    }
    if (evt.eventType === undefined && idx >= 1) {
      const normalized = idx - 1
      console.debug('[nav:list-infer-index]', {
        containerName: evt.containerName,
        rawIndex: idx,
        normalizedIndex: normalized,
      })
      return normalized
    }
    return idx
  }

  private handleGenericInput(et: OsEventTypeList | undefined, containerName?: string) {
    if (!this.isNavigationEvent(et)) return
    if (this.state.screen === 'reading') {
      this.handleText(et, containerName)
      return
    }
    this.handleList(et, undefined, containerName)
  }

  private handleList(et: OsEventTypeList | undefined, idx: number | undefined, containerName: string | undefined) {
    if (et === undefined) return
    console.debug('[nav:list]', {
      screen: this.state.screen,
      activeContainerName: this.activeContainerName,
      eventContainerName: containerName,
      idx,
      et,
    })
    if (this.state.screen === 'home') this.handleHomeList(et, idx)
    else if (this.state.screen === 'overview') this.handleOverviewList(et, idx)
  }

  private handleHomeList(et: OsEventTypeList, idx: number | undefined) {
    const nextIndex = this.resolveIndex(idx, this.state.itemIndex, this.state.items.length)
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
    } else if (et === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      void this.bridge.shutDownPageContainer(1)
    }
  }

  private handleOverviewList(et: OsEventTypeList, idx: number | undefined) {
    const item = this.state.items[this.state.itemIndex]
    if (!item) return
    const nextIndex = this.resolveIndex(idx, this.state.sectionIndex, item.sections.length)
    if (et === OsEventTypeList.CLICK_EVENT) {
      if (nextIndex < 0) return
      this.state.sectionIndex = nextIndex
      void this.pushReading().then(() => this.notify())
    } else if (et === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      void this.pushHome().then(() => this.notify())
    } else if (
      et === OsEventTypeList.SCROLL_TOP_EVENT ||
      et === OsEventTypeList.SCROLL_BOTTOM_EVENT
    ) {
      if (nextIndex < 0) return
      this.state.sectionIndex = nextIndex
      void this.updateOverviewPreview(item, nextIndex)
    }
  }

  private async updateOverviewPreview(item: Item, idx: number) {
    const ok = await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: OVW_PREVIEW_ID,
        containerName: 'preview',
        content: previewText(item, idx, PREVIEW_CHARS),
      }),
    )
    this.state.lastCall = `textContainerUpgrade(preview) → ${ok}`
    console.log('[glasses]', this.state.lastCall)
    this.notify()
  }

  private handleText(et: OsEventTypeList | undefined, containerName: string | undefined) {
    if (this.state.screen !== 'reading') return
    console.debug('[nav:text]', {
      screen: this.state.screen,
      activeContainerName: this.activeContainerName,
      eventContainerName: containerName,
      et,
    })
    if (et === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      void this.pushOverview().then(() => this.notify())
    }
  }

  private handleSystem(et: OsEventTypeList | undefined) {
    if (et === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
      void this.renderCurrent()
    }
  }

  private logEvent(kind: 'list' | 'text' | 'sys', payload: object) {
    console.debug(`[event:${kind}]`, payload)
  }
}
