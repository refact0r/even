import {
  EvenAppBridge,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
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

  constructor(bridge: EvenAppBridge, state: AppState) {
    this.bridge = bridge
    this.state = state
  }

  async start() {
    this.bridge.onEvenHubEvent((evt) => {
      if (evt.listEvent) this.handleList(evt.listEvent.eventType, evt.listEvent.currentSelectItemIndex ?? 0)
      else if (evt.textEvent) this.handleText(evt.textEvent.eventType)
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
    const list = homeList(this.state.items)
    if (!this.started) {
      const r = await this.bridge.createStartUpPageContainer(
        new CreateStartUpPageContainer({ containerTotalNum: 1, listObject: [list] }),
      )
      this.state.lastCall = `createStartUpPageContainer(home) → ${r}`
      console.log('[glasses]', this.state.lastCall)
      this.started = true
    } else {
      const r = await this.bridge.rebuildPageContainer(
        new RebuildPageContainer({ containerTotalNum: 1, listObject: [list] }),
      )
      this.state.lastCall = `rebuildPageContainer(home) → ${r}`
      console.log('[glasses]', this.state.lastCall)
    }
    this.state.screen = 'home'
  }

  private async pushOverview() {
    const item = this.state.items[this.state.itemIndex]
    const list = overviewList(item, this.state.sectionIndex)
    const preview = overviewPreview(
      item,
      this.state.sectionIndex,
      this.started ? PREVIEW_CHARS : STARTUP_TEXT_CHARS,
    )
    if (!this.started) {
      const r = await this.bridge.createStartUpPageContainer(
        new CreateStartUpPageContainer({
          containerTotalNum: 2,
          listObject: [list],
          textObject: [preview],
        }),
      )
      this.state.lastCall = `createStartUpPageContainer(overview) → ${r}`
      console.log('[glasses]', this.state.lastCall)
      this.started = true
    } else {
      const r = await this.bridge.rebuildPageContainer(
        new RebuildPageContainer({
          containerTotalNum: 2,
          listObject: [list],
          textObject: [preview],
        }),
      )
      this.state.lastCall = `rebuildPageContainer(overview) → ${r}`
      console.log('[glasses]', this.state.lastCall)
    }
    this.state.screen = 'overview'
  }

  private async pushReading() {
    const item = this.state.items[this.state.itemIndex]
    const text = readingContainer(item, this.state.sectionIndex, READING_CHARS)
    const r = await this.bridge.rebuildPageContainer(
      new RebuildPageContainer({ containerTotalNum: 1, textObject: [text] }),
    )
    this.state.lastCall = `rebuildPageContainer(reading) → ${r}`
    console.log('[glasses]', this.state.lastCall)
    this.state.screen = 'reading'
  }

  private handleList(et: OsEventTypeList | undefined, idx: number) {
    if (et === undefined) return
    if (this.state.screen === 'home') this.handleHomeList(et, idx)
    else if (this.state.screen === 'overview') this.handleOverviewList(et, idx)
  }

  private handleHomeList(et: OsEventTypeList, idx: number) {
    if (et === OsEventTypeList.CLICK_EVENT) {
      if (!this.state.items[idx]) return
      this.state.itemIndex = idx
      this.state.sectionIndex = 0
      void this.pushOverview().then(() => this.notify())
    } else if (et === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      void this.bridge.shutDownPageContainer(1)
    }
  }

  private handleOverviewList(et: OsEventTypeList, idx: number) {
    const item = this.state.items[this.state.itemIndex]
    if (!item) return
    if (et === OsEventTypeList.CLICK_EVENT) {
      this.state.sectionIndex = Math.min(idx, item.sections.length - 1)
      void this.pushReading().then(() => this.notify())
    } else if (et === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      void this.pushHome().then(() => this.notify())
    } else if (
      et === OsEventTypeList.SCROLL_TOP_EVENT ||
      et === OsEventTypeList.SCROLL_BOTTOM_EVENT
    ) {
      const clamped = Math.min(Math.max(idx, 0), item.sections.length - 1)
      this.state.sectionIndex = clamped
      void this.bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: OVW_PREVIEW_ID,
          containerName: 'preview',
          content: previewText(item, clamped, PREVIEW_CHARS),
        }),
      )
      this.notify()
    }
  }

  private handleText(et: OsEventTypeList | undefined) {
    if (this.state.screen !== 'reading') return
    if (et === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      void this.pushOverview().then(() => this.notify())
    }
  }
}
