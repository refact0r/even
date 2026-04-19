import { getApiKey } from './client'

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const ASK_MODEL = 'openai/gpt-4o-audio-preview'
const SAMPLE_RATE = 16000
const CHANNELS = 1
const BITS_PER_SAMPLE = 16

const SYSTEM_PROMPT =
	"You answer the user's spoken question about the document below. " +
	'Be concise: 2-4 short sentences, no preamble. ' +
	"If the document doesn't contain the answer, say so plainly."

export async function askAboutDocument(
	pcm: Uint8Array,
	documentTitle: string,
	documentText: string,
): Promise<string> {
	const apiKey = getApiKey()
	if (!apiKey) throw new Error('OpenRouter API key is not set')
	if (!pcm || pcm.length === 0) throw new Error('No audio captured')

	const wav = pcmToWav(pcm, SAMPLE_RATE, CHANNELS, BITS_PER_SAMPLE)
	const audioB64 = base64FromBytes(wav)

	const userText =
		`Document title: ${documentTitle}\n\n` +
		`Document content:\n${documentText}\n\n` +
		'The user just asked a spoken question about this document. Answer it.'

	const body = {
		model: ASK_MODEL,
		modalities: ['text'],
		messages: [
			{ role: 'system', content: SYSTEM_PROMPT },
			{
				role: 'user',
				content: [
					{ type: 'text', text: userText },
					{
						type: 'input_audio',
						input_audio: { data: audioB64, format: 'wav' },
					},
				],
			},
		],
	}

	const res = await fetch(OPENROUTER_ENDPOINT, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': location.origin,
			'X-Title': 'Universal Reader',
		},
		body: JSON.stringify(body),
	})

	if (!res.ok) {
		const detail = await res.text().catch(() => '')
		throw new Error(`OpenRouter ${res.status}: ${detail || res.statusText}`)
	}

	const payload = await res.json()
	const content: unknown = payload?.choices?.[0]?.message?.content
	if (typeof content !== 'string') {
		throw new Error('OpenRouter response missing message content')
	}
	return content.trim()
}

export function concatPcm(chunks: Uint8Array[]): Uint8Array {
	let total = 0
	for (const c of chunks) total += c.length
	const out = new Uint8Array(total)
	let offset = 0
	for (const c of chunks) {
		out.set(c, offset)
		offset += c.length
	}
	return out
}

// Normalize whatever the bridge hands us (Uint8Array, number[], or base64 string) into Uint8Array.
export function normalizePcmChunk(raw: unknown): Uint8Array | null {
	if (!raw) return null
	if (raw instanceof Uint8Array) return raw
	if (Array.isArray(raw)) return new Uint8Array(raw as number[])
	if (typeof raw === 'string') {
		try {
			const bin = atob(raw)
			const out = new Uint8Array(bin.length)
			for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
			return out
		} catch {
			return null
		}
	}
	return null
}

function pcmToWav(
	pcm: Uint8Array,
	sampleRate: number,
	channels: number,
	bitsPerSample: number,
): Uint8Array {
	const dataSize = pcm.length
	const byteRate = (sampleRate * channels * bitsPerSample) / 8
	const blockAlign = (channels * bitsPerSample) / 8
	const buffer = new ArrayBuffer(44 + dataSize)
	const view = new DataView(buffer)
	writeAscii(view, 0, 'RIFF')
	view.setUint32(4, 36 + dataSize, true)
	writeAscii(view, 8, 'WAVE')
	writeAscii(view, 12, 'fmt ')
	view.setUint32(16, 16, true)
	view.setUint16(20, 1, true)
	view.setUint16(22, channels, true)
	view.setUint32(24, sampleRate, true)
	view.setUint32(28, byteRate, true)
	view.setUint16(32, blockAlign, true)
	view.setUint16(34, bitsPerSample, true)
	writeAscii(view, 36, 'data')
	view.setUint32(40, dataSize, true)
	new Uint8Array(buffer, 44).set(pcm)
	return new Uint8Array(buffer)
}

function writeAscii(view: DataView, offset: number, str: string) {
	for (let i = 0; i < str.length; i += 1) {
		view.setUint8(offset + i, str.charCodeAt(i))
	}
}

function base64FromBytes(bytes: Uint8Array): string {
	let s = ''
	const chunk = 0x8000
	for (let i = 0; i < bytes.length; i += chunk) {
		s += String.fromCharCode.apply(
			null,
			Array.from(bytes.subarray(i, i + chunk)),
		)
	}
	return btoa(s)
}
