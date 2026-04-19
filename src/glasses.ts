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
import { askAboutDocument, concatPcm, normalizePcmChunk } from './client/ask'

const W = 576
const H = 288

const HOME_LIST_ID = 1
const HOME_TITLE_ID = 5
const OVW_NAV_ID = 2
const OVW_PREVIEW_ID = 3
const READ_TEXT_ID = 4
const ASK_TEXT_ID = 6
const ASK_ANSWER_BYTES = 900

const ITEM_NAME_MAX = 62
const OVW_NAV_HEADING_MAX = 22
const OVW_SPLIT = 240
const OVW_GAP = 4
const OVERVIEW_WINDOW_SIZE = 8
const PREVIEW_CHARS = 260
const READING_CHARS = 2000
const STARTUP_TEXT_BYTES = 999
const STARTUP_READING_BYTES = 999
const READING_PAGE_BYTES = 999

export type Screen = 'home' | 'overview' | 'reading' | 'ask'

export type AskPhase = 'recording' | 'thinking' | 'answer' | 'error'

export interface AppState {
	screen: Screen
	items: Item[]
	itemIndex: number
	sectionIndex: number
	readingPageIndex: number
	askPhase?: AskPhase
	askAnswer?: string
	askError?: string
	lastCall?: string
	onChange?: () => void
}

function sanitize(s: string): string {
	return s
		.replace(/`/g, "'")
		.replace(/[\u2018\u2019\u02BC]/g, "'")
		.replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
		.replace(/[\u2013\u2014\u2015]/g, '-')
		.replace(/\u2026/g, '...')
		.replace(/[\u2022\u2023\u25E6\u2043]/g, '-')
		.replace(/[^\x20-\x7E\n\u2500-\u257F]/g, '')
}

function trunc(s: string, n: number): string {
	if (!s) return ''
	return s.length <= n ? s : s.slice(0, Math.max(0, n - 3)) + '...'
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

function byteLength(s: string): number {
	return new TextEncoder().encode(s).length
}

function sliceWithinBytes(s: string, maxBytes: number): string {
	if (!s || maxBytes <= 0) return ''
	const enc = new TextEncoder()
	if (enc.encode(s).length <= maxBytes) return s
	let lo = 0
	let hi = s.length
	let best = ''
	while (lo <= hi) {
		const mid = Math.floor((lo + hi) / 2)
		const candidate = s.slice(0, mid)
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
		.map((it, i) => trunc(`${i + 1}. ${sanitize(it.title)}`, ITEM_NAME_MAX))
}

const HOME_TITLE_H = 40

function homeTitle(): TextContainerProperty {
	return new TextContainerProperty({
		xPosition: 0,
		yPosition: 0,
		width: W,
		height: HOME_TITLE_H,
		borderWidth: 0,
		borderColor: 0,
		borderRadius: 0,
		paddingLength: 6,
		containerID: HOME_TITLE_ID,
		containerName: 'title',
		isEventCapture: 0,
		content: 'nutshell',
	})
}

function homeList(items: Item[]): ListContainerProperty {
	const names = homeListLabels(items)
	return new ListContainerProperty({
		xPosition: 0,
		yPosition: HOME_TITLE_H,
		width: W,
		height: H - HOME_TITLE_H,
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
	return item.sections
		.slice(0, 20)
		.map((s) => trunc(sanitize(s.heading), OVW_NAV_HEADING_MAX))
}

function overviewNavText(item: Item, activeSection: number): string {
	const names = overviewSectionLabels(item)
	if (!names.length) return '(no sections)'
	const halfWindow = Math.floor(OVERVIEW_WINDOW_SIZE / 2)
	const start = Math.max(
		0,
		Math.min(
			activeSection - halfWindow,
			names.length - OVERVIEW_WINDOW_SIZE,
		),
	)
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
		width: OVW_SPLIT - OVW_GAP,
		height: H,
		borderWidth: 1,
		borderColor: 8,
		borderRadius: 12,
		paddingLength: 4,
		containerID: OVW_NAV_ID,
		containerName: 'sections',
		isEventCapture: 0,
		content: truncBytes(
			names.length ? overviewNavText(item, idx) : '(no sections)',
			STARTUP_TEXT_BYTES,
		),
	})
}

function sectionHeader(item: Item, idx: number): string {
	const section = item.sections[idx]
	if (!section) return sanitize(item.title)
	const heading = sanitize(section.heading)
	return item.sections.length > 1
		? `[${idx + 1}/${item.sections.length}] - ${heading}`
		: heading
}

function previewText(
	item: Item,
	idx: number,
	maxChars = PREVIEW_CHARS,
): string {
	const section = item.sections[idx]
	if (!section) return ''
	const header = `${sectionHeader(item, idx)}\n\n`
	return (
		header +
		trunc(sanitize(section.content), Math.max(40, maxChars - header.length))
	)
}

function overviewPreview(item: Item, idx: number): TextContainerProperty {
	return new TextContainerProperty({
		xPosition: OVW_SPLIT + OVW_GAP,
		yPosition: 0,
		width: W - OVW_SPLIT - OVW_GAP,
		height: H,
		borderWidth: 0,
		borderColor: 5,
		borderRadius: 0,
		paddingLength: 4,
		containerID: OVW_PREVIEW_ID,
		containerName: 'preview',
		isEventCapture: 1,
		content: truncBytes(
			previewText(item, idx, PREVIEW_CHARS),
			STARTUP_TEXT_BYTES,
		),
	})
}

function readingSectionHeader(item: Item, idx: number) {
	return sectionHeader(item, idx)
}

function splitReadingSection(
	item: Item,
	idx: number,
	maxChars = READING_CHARS,
) {
	const section = item.sections[idx]
	const header = readingSectionHeader(item, idx)
	if (!section)
		return [truncBytes(trunc(header, maxChars), READING_PAGE_BYTES)]

	const prefix = `${header}\n\n`
	const prefixBytes = byteLength(prefix)
	if (prefixBytes >= READING_PAGE_BYTES)
		return [truncBytes(trunc(header, maxChars), READING_PAGE_BYTES)]

	const content = sanitize(section.content).trim()
	if (!content) return [header]

	const room = Math.min(
		maxChars - prefix.length,
		READING_PAGE_BYTES - prefixBytes,
	)
	const pages: string[] = []
	let cursor = 0

	while (cursor < content.length) {
		const remaining = content.slice(cursor)
		if (byteLength(remaining) <= room) {
			pages.push(`${header}\n\n${remaining}`)
			break
		}

		const raw = sliceWithinBytes(remaining, room)
		const paragraphBreak = raw.lastIndexOf('\n\n')
		const lineBreak = raw.lastIndexOf('\n')
		const wordBreak = raw.lastIndexOf(' ')
		let splitAt = Math.max(
			paragraphBreak >= 0 ? paragraphBreak + 2 : -1,
			lineBreak + 1,
			wordBreak + 1,
		)

		// Avoid tiny tail pages by falling back to the hard limit when no decent break exists.
		if (splitAt < Math.floor(raw.length * 0.6)) splitAt = raw.length

		const chunk = remaining.slice(0, splitAt).trimEnd()
		pages.push(`${header}\n\n${chunk || raw}`)
		cursor += splitAt
		while (cursor < content.length && /\s/.test(content[cursor] ?? ''))
			cursor += 1
	}

	return pages.length ? pages : [header]
}

function buildForwardReadingPages(item: Item, startSectionIndex: number) {
	const start = Math.min(
		Math.max(startSectionIndex, 0),
		Math.max(0, item.sections.length - 1),
	)
	const pages: string[] = []
	let current = ''

	for (let idx = start; idx < item.sections.length; idx += 1) {
		const chunks = splitReadingSection(item, idx)
		for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
			const chunk = chunks[chunkIndex]
			if (!current) {
				current = chunk
				continue
			}
			const combined = `${current}\n\n${chunk}`
			if (
				chunkIndex === 0 &&
				byteLength(combined) <= READING_PAGE_BYTES
			) {
				current = combined
				continue
			}
			pages.push(current)
			current = chunk
		}
	}

	if (current) pages.push(current)
	return pages.length ? pages : [truncBytes(item.title, READING_PAGE_BYTES)]
}

function buildBackwardReadingPages(item: Item, startSectionIndex: number) {
	const start = Math.min(
		Math.max(startSectionIndex, 0),
		Math.max(0, item.sections.length),
	)
	const pages: string[] = []
	let current = ''

	for (let idx = start - 1; idx >= 0; idx -= 1) {
		const chunks = splitReadingSection(item, idx)
		for (
			let chunkIndex = chunks.length - 1;
			chunkIndex >= 0;
			chunkIndex -= 1
		) {
			const chunk = chunks[chunkIndex]
			if (!current) {
				current = chunk
				continue
			}
			const combined = `${chunk}\n\n${current}`
			if (
				chunkIndex === chunks.length - 1 &&
				byteLength(combined) <= READING_PAGE_BYTES
			) {
				current = combined
				continue
			}
			pages.push(current)
			current = chunk
		}
	}

	if (current) pages.push(current)
	return pages
}

function readingWindow(item: Item, startSectionIndex: number) {
	const backwardPages = buildBackwardReadingPages(item, startSectionIndex)
	const forwardPages = buildForwardReadingPages(item, startSectionIndex)
	return {
		backwardPages,
		forwardPages,
		minPageIndex: -backwardPages.length,
		maxPageIndex: forwardPages.length - 1,
	}
}

function readingPage(item: Item, startSectionIndex: number, pageIndex: number) {
	const window = readingWindow(item, startSectionIndex)
	const clamped = Math.min(
		Math.max(pageIndex, window.minPageIndex),
		window.maxPageIndex,
	)
	if (clamped >= 0) {
		return {
			content: window.forwardPages[clamped],
			pageIndex: clamped,
			minPageIndex: window.minPageIndex,
			maxPageIndex: window.maxPageIndex,
		}
	}
	return {
		content: window.backwardPages[Math.abs(clamped) - 1],
		pageIndex: clamped,
		minPageIndex: window.minPageIndex,
		maxPageIndex: window.maxPageIndex,
	}
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

function askText(state: AppState): string {
	const item = state.items[state.itemIndex]
	const titleLine = item
		? `[ask] - ${trunc(sanitize(item.title), 56)}\n\n`
		: '[ask]\n\n'
	switch (state.askPhase) {
		case 'recording':
			return `${titleLine}Listening...\n\n(tap to send · double-tap to cancel)`
		case 'thinking':
			return `${titleLine}Thinking...`
		case 'answer':
			return `${titleLine}${sanitize(state.askAnswer ?? '')}`
		case 'error':
			return `${titleLine}Error: ${sanitize(state.askError ?? 'unknown')}\n\n(double-tap to go back)`
		default:
			return `${titleLine}Ask about this document...`
	}
}

function askContainer(text: string): TextContainerProperty {
	return new TextContainerProperty({
		xPosition: 0,
		yPosition: 0,
		width: W,
		height: H,
		borderWidth: 0,
		borderColor: 5,
		borderRadius: 0,
		paddingLength: 6,
		containerID: ASK_TEXT_ID,
		containerName: 'ask',
		isEventCapture: 1,
		content: text,
	})
}

function fullDocumentText(item: Item): string {
	return item.sections
		.map((s) => `## ${s.heading}\n\n${s.content}`)
		.join('\n\n')
}

export class GlassesApp {
	private bridge: EvenAppBridge
	private state: AppState
	private started = false
	private rendering = false
	private activeContainerName:
		| 'home'
		| 'sections'
		| 'reading'
		| 'preview'
		| 'ask'
		| null = null
	private audioBuffer: Uint8Array[] = []
	private askInFlight = false
	private micActive = false

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
				this.handleText(
					this.normalizeTextEventType(evt.textEvent),
					evt.textEvent.containerName,
				)
			} else if (evt.sysEvent) {
				this.logEvent('sys', evt.sysEvent)
				this.handleSystem(evt.sysEvent)
			} else if (evt.audioEvent) {
				this.handleAudio(evt.audioEvent.audioPcm)
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
		else if (this.state.screen === 'ask') await this.pushAsk()
		else await this.pushReading()
		this.notify()
	}

	private async pushHome(resetFocus = false) {
		if (this.rendering) return false
		this.rendering = true
		if (resetFocus) this.state.itemIndex = 0
		const title = homeTitle()
		const list = homeList(this.state.items)
		try {
			const ok = await this.renderPage('home', {
				containerTotalNum: 2,
				textObject: [title],
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
		// Keep the event-capturing preview container last so overview scroll/click reaches it reliably.
		const nav = overviewNav(item, this.state.sectionIndex)
		const preview = overviewPreview(item, this.state.sectionIndex)
		try {
			const ok = await this.renderPage('overview', {
				containerTotalNum: 2,
				textObject: [nav, preview],
			})
			if (!ok) return false
			this.state.screen = 'overview'
			this.activeContainerName = 'preview'
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
		const page = readingPage(
			item,
			this.state.sectionIndex,
			this.state.readingPageIndex,
		)
		this.state.readingPageIndex = page.pageIndex
		const startupText = truncBytes(page.content, STARTUP_READING_BYTES)
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
			const upgraded = await this.updateReadingSelection(
				item,
				this.state.readingPageIndex,
				false,
			)
			if (!upgraded) {
				this.notify()
				return false
			}
			return true
		} finally {
			this.rendering = false
		}
	}

	private async pushAsk() {
		const item = this.state.items[this.state.itemIndex]
		if (!item) return this.pushHome()
		if (this.rendering) return false
		this.rendering = true
		const text = truncBytes(askText(this.state), ASK_ANSWER_BYTES)
		const container = askContainer(text)
		try {
			const ok = await this.renderPage('ask', {
				containerTotalNum: 1,
				textObject: [container],
			})
			if (!ok) return false
			this.state.screen = 'ask'
			this.activeContainerName = 'ask'
			return true
		} finally {
			this.rendering = false
		}
	}

	private async updateAskText() {
		const text = truncBytes(askText(this.state), ASK_ANSWER_BYTES)
		const ok = await this.bridge.textContainerUpgrade(
			new TextContainerUpgrade({
				containerID: ASK_TEXT_ID,
				containerName: 'ask',
				contentOffset: 0,
				contentLength: byteLength(text),
				content: text,
			}),
		)
		this.state.lastCall = `textContainerUpgrade(ask) → ${ok}`
		if (!ok && !this.rendering) {
			await this.pushAsk()
		} else {
			this.notify()
		}
		return ok
	}

	private async enterAsk() {
		if (this.state.screen === 'ask') return
		this.audioBuffer = []
		this.state.askPhase = 'recording'
		this.state.askAnswer = undefined
		this.state.askError = undefined
		const ok = await this.pushAsk()
		if (!ok) return
		this.notify()
		try {
			const started = await this.bridge.audioControl(true)
			this.micActive = !!started
			this.state.lastCall = `audioControl(true) → ${started}`
			if (!started) {
				this.state.askPhase = 'error'
				this.state.askError = 'mic failed to start'
				await this.updateAskText()
			}
		} catch (err) {
			this.micActive = false
			this.state.askPhase = 'error'
			this.state.askError =
				err instanceof Error ? err.message : String(err)
			await this.updateAskText()
		}
	}

	private handleAskInput(et: OsEventTypeList) {
		if (et === OsEventTypeList.DOUBLE_CLICK_EVENT) {
			void this.exitAsk()
			return
		}
		if (et === OsEventTypeList.CLICK_EVENT) {
			if (this.state.askPhase === 'recording') {
				void this.stopAndSendAsk()
			}
			return
		}
	}

	private async stopMic() {
		if (!this.micActive) return
		try {
			await this.bridge.audioControl(false)
		} catch {}
		this.micActive = false
	}

	private async stopAndSendAsk() {
		if (this.askInFlight) return
		const item = this.state.items[this.state.itemIndex]
		if (!item) return
		this.askInFlight = true
		this.state.askPhase = 'thinking'
		await this.updateAskText()
		await this.stopMic()
		const pcm = concatPcm(this.audioBuffer)
		this.audioBuffer = []
		try {
			const answer = await askAboutDocument(
				pcm,
				item.title,
				fullDocumentText(item),
			)
			this.state.askPhase = 'answer'
			this.state.askAnswer = answer
		} catch (err) {
			this.state.askPhase = 'error'
			this.state.askError =
				err instanceof Error ? err.message : String(err)
		} finally {
			this.askInFlight = false
			await this.updateAskText()
		}
	}

	private async exitAsk() {
		await this.stopMic()
		this.audioBuffer = []
		this.state.askPhase = undefined
		this.state.askAnswer = undefined
		this.state.askError = undefined
		await this.pushReading()
		this.notify()
	}

	private handleAudio(raw: unknown) {
		if (this.state.screen !== 'ask') return
		if (this.state.askPhase !== 'recording') return
		const chunk = normalizePcmChunk(raw)
		if (!chunk || chunk.length === 0) return
		this.audioBuffer.push(chunk)
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
		const result = await this.bridge.rebuildPageContainer(
			new RebuildPageContainer(container),
		)
		this.state.lastCall = `rebuildPageContainer(${label}) → ${result}`
		console.log('[glasses]', this.state.lastCall)
		return result
	}

	private resolveIndex(
		next: number | undefined,
		current: number,
		count: number,
	) {
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
			evt.containerName ||
			evt.containerID !== undefined ||
			evt.currentSelectItemName !== undefined ||
			evt.currentSelectItemIndex !== undefined
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
			const matched = this.listLabelsForScreen().findIndex(
				(name) => name === label,
			)
			if (matched >= 0) return matched
		}
		const idx = evt.currentSelectItemIndex
		if (typeof idx !== 'number' || !Number.isFinite(idx)) {
			if (evt.eventType === undefined) {
				return this.state.screen === 'overview'
					? this.state.sectionIndex
					: this.state.itemIndex
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
		if (
			containerName &&
			this.activeContainerName &&
			containerName !== this.activeContainerName
		) {
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
		const nextIndex = this.resolveTargetIndex(
			et,
			idx,
			this.state.itemIndex,
			this.state.items.length,
		)
		if (
			et === OsEventTypeList.SCROLL_TOP_EVENT ||
			et === OsEventTypeList.SCROLL_BOTTOM_EVENT
		) {
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
			this.state.readingPageIndex = 0
			console.debug('[nav:home-click]', {
				nextIndex,
				itemTitle: this.state.items[nextIndex]?.title,
			})
			void this.pushOverview().then((ok) => {
				console.debug('[nav:home-click-result]', {
					ok,
					screen: this.state.screen,
				})
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

	private async updateReadingSelection(
		item: Item,
		pageIndex: number,
		fallbackToRebuild = true,
	) {
		const page = readingPage(item, this.state.sectionIndex, pageIndex)
		this.state.readingPageIndex = page.pageIndex
		const ok = await this.bridge.textContainerUpgrade(
			new TextContainerUpgrade({
				containerID: READ_TEXT_ID,
				containerName: 'reading',
				contentOffset: 0,
				contentLength: byteLength(page.content),
				content: page.content,
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
		if (et === OsEventTypeList.CLICK_EVENT) {
			const nextIndex = this.resolveTargetIndex(
				et,
				undefined,
				this.state.sectionIndex,
				item.sections.length,
			)
			if (nextIndex < 0 || !item.sections[nextIndex]) return
			this.setSelectedSection(item, nextIndex)
			void this.pushReading().then(() => this.notify())
			return
		}
		if (et === OsEventTypeList.DOUBLE_CLICK_EVENT) {
			void this.pushHome(true).then(() => this.notify())
			return
		}
		if (
			et !== OsEventTypeList.SCROLL_TOP_EVENT &&
			et !== OsEventTypeList.SCROLL_BOTTOM_EVENT
		) {
			return
		}
		const nextIndex = this.resolveOverviewScrollIndex(item, et)
		if (nextIndex < 0) return
		void this.syncOverviewSelection(item, nextIndex, 'text')
	}

	private resolveOverviewScrollIndex(item: Item, et: OsEventTypeList) {
		const count = item.sections.length
		if (count <= 0) return -1
		const delta = et === OsEventTypeList.SCROLL_BOTTOM_EVENT ? 1 : -1
		return ((this.state.sectionIndex + delta) % count + count) % count
	}

	private setSelectedSection(item: Item, idx: number) {
		if (!item.sections[idx]) return false
		const changed =
			this.state.sectionIndex !== idx || this.state.readingPageIndex !== 0
		this.state.sectionIndex = idx
		this.state.readingPageIndex = 0
		console.debug('[nav:section-select]', {
			itemIndex: this.state.itemIndex,
			sectionIndex: idx,
			readingPageIndex: 0,
			sectionHeading: item.sections[idx]?.heading,
			changed,
		})
		return changed
	}

	private async syncOverviewSelection(
		item: Item,
		idx: number,
		source: 'text' | 'sys',
	) {
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
		if (et === OsEventTypeList.CLICK_EVENT) {
			void this.enterAsk()
			return
		}
		if (
			et !== OsEventTypeList.SCROLL_TOP_EVENT &&
			et !== OsEventTypeList.SCROLL_BOTTOM_EVENT
		) {
			return
		}
		const targetPageIndex = this.resolveReadingPageIndex(item, et)
		if (
			targetPageIndex === null ||
			targetPageIndex === this.state.readingPageIndex
		)
			return
		void this.syncReadingSelection(item, targetPageIndex, source)
	}

	private resolveReadingPageIndex(item: Item, et: OsEventTypeList) {
		const current = readingPage(
			item,
			this.state.sectionIndex,
			this.state.readingPageIndex,
		)
		if (et === OsEventTypeList.SCROLL_TOP_EVENT) {
			return current.pageIndex > current.minPageIndex
				? current.pageIndex - 1
				: null
		}
		if (et === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
			return current.pageIndex < current.maxPageIndex
				? current.pageIndex + 1
				: null
		}
		return null
	}

	private async syncReadingSelection(
		item: Item,
		pageIndex: number,
		source: 'text' | 'sys',
	) {
		const changed = this.state.readingPageIndex !== pageIndex
		this.state.readingPageIndex = pageIndex
		if (!changed) {
			this.notify()
			return
		}
		console.debug('[nav:reading-sync]', {
			source,
			sectionIndex: this.state.sectionIndex,
			readingPageIndex: pageIndex,
		})
		await this.updateReadingSelection(item, pageIndex)
	}

	private handleText(
		et: OsEventTypeList | undefined,
		containerName: string | undefined,
	) {
		if (et === undefined) return
		if (this.state.screen === 'overview') {
			if (containerName && containerName !== 'preview') return
			this.handleOverviewInput(et)
			return
		}
		if (this.state.screen === 'ask') {
			if (containerName && containerName !== 'ask') return
			this.handleAskInput(et)
			return
		}
		if (this.state.screen !== 'reading') return
		if (
			containerName &&
			this.activeContainerName &&
			containerName !== this.activeContainerName
		) {
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
			this.state.screen === 'overview' &&
			(et === OsEventTypeList.SCROLL_TOP_EVENT ||
				et === OsEventTypeList.SCROLL_BOTTOM_EVENT)
		) {
			const item = this.state.items[this.state.itemIndex]
			if (!item) return
			const nextIndex = this.resolveOverviewScrollIndex(item, et)
			if (nextIndex < 0) return
			void this.syncOverviewSelection(item, nextIndex, 'sys')
			return
		}

		if (
			this.state.screen === 'reading' &&
			(et === OsEventTypeList.SCROLL_TOP_EVENT ||
				et === OsEventTypeList.SCROLL_BOTTOM_EVENT ||
				et === OsEventTypeList.DOUBLE_CLICK_EVENT ||
				et === OsEventTypeList.CLICK_EVENT)
		) {
			this.handleReadingInput(et, 'sys')
			return
		}

		if (
			this.state.screen === 'ask' &&
			(et === OsEventTypeList.CLICK_EVENT ||
				et === OsEventTypeList.DOUBLE_CLICK_EVENT)
		) {
			this.handleAskInput(et)
			return
		}

		if (
			this.state.screen === 'overview' &&
			et === OsEventTypeList.CLICK_EVENT
		) {
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

	async refreshItems(items: Item[]) {
		this.state.items = items
		if (this.state.screen === 'home') {
			await this.pushHome()
		}
		this.notify()
	}

	private logEvent(kind: 'list' | 'text' | 'sys', payload: object) {
		console.debug(`[event:${kind}]`, payload)
	}
}
