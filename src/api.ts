import http from 'node:http'
import net from 'node:net'
import dns from 'node:dns/promises'
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import type { CuePlayerStatus, PlaylistDetail, PlaylistSummary } from './types.js'

export const API_PREFIX = '/api/v1'

/** Why a request failed: no answer at all, the app said "not you", or the app answered with another error. */
export type ApiErrorKind = 'network' | 'auth' | 'http' | 'parse'

export class ApiError extends Error {
	readonly kind: ApiErrorKind
	/** HTTP status code (0 when there was no response) */
	readonly statusCode: number
	/** CuePlayer error code from the body (`unauthorized`, `not_found`, `no_track`, `disabled`, …) */
	readonly code: string | undefined

	constructor(kind: ApiErrorKind, message: string, statusCode = 0, code?: string) {
		super(message)
		this.name = 'ApiError'
		this.kind = kind
		this.statusCode = statusCode
		this.code = code
	}
}

/** One HTTP call to CuePlayer: method, path below /api/v1 and an optional JSON body */
export interface ApiRequest {
	method: 'GET' | 'POST' | 'PUT'
	path: string
	body?: Record<string, unknown>
}

export interface ClientOptions {
	host: string
	port: number
	token?: string
	timeoutMs?: number
}

/** 401/403/429 from CuePlayer mean "wrong token / not allowed from here", not "app is gone". */
const AUTH_CODES = new Set([401, 403, 429])
const MAX_RESPONSE = 4 * 1024 * 1024

/**
 * Request signature (CuePlayer 1.1.43 / 1.0.49+, same text as the app's RemoteControl):
 * HMAC-SHA256(token, "v1\n" + METHOD + "\n" + target + "\n" + time + "\n" + nonce + "\n" + hex(SHA-256(body))) as "v1=<hex>".
 * Another computer never sends the token itself — plain http on a shared network would let anyone watching reuse it.
 */
export function signature(
	token: string,
	method: string,
	target: string,
	time: string,
	nonce: string,
	body: string,
): string {
	const bodyHash = createHash('sha256').update(body, 'utf8').digest('hex')
	const text = `v1\n${method.toUpperCase()}\n${target}\n${time}\n${nonce}\n${bodyHash}`
	return 'v1=' + createHmac('sha256', token).update(text, 'utf8').digest('hex')
}

/** Where the request goes (for signing). loopback = CuePlayer on this computer */
export interface SignTarget {
	method: string
	target: string
	loopback: boolean
	/** test hooks */
	time?: number
	nonce?: string
}

/**
 * Build the headers CuePlayer expects. Never Origin / Sec-Fetch-* (the app refuses browser requests).
 * With a token: always signed (X-Cue-Time · X-Cue-Nonce · X-Cue-Signature). The plain Bearer token is added only
 * for CuePlayer on this computer (older apps that don't know signatures), never over the network.
 */
export function buildHeaders(
	token: string | undefined,
	body: string | undefined,
	sign?: SignTarget,
): Record<string, string> {
	const headers: Record<string, string> = { Accept: 'application/json' }
	if (body !== undefined) {
		headers['Content-Type'] = 'application/json; charset=utf-8'
		headers['Content-Length'] = String(Buffer.byteLength(body))
	}
	const t = token?.trim()
	if (!t) return headers
	if (!sign) {
		headers['Authorization'] = `Bearer ${t}`
		return headers
	}
	const time = String(sign.time ?? Math.floor(Date.now() / 1000))
	const nonce = sign.nonce ?? randomBytes(16).toString('hex')
	headers['X-Cue-Time'] = time
	headers['X-Cue-Nonce'] = nonce
	headers['X-Cue-Signature'] = signature(t, sign.method, sign.target, time, nonce, body ?? '')
	if (sign.loopback) headers['Authorization'] = `Bearer ${t}`
	return headers
}

const isLoopback = (address: string): boolean =>
	address === '127.0.0.1' || address === '::1' || address.startsWith('127.')

/** Add a fresh requestId so CuePlayer can drop duplicates (retries) within 30 s. */
export function withRequestId(
	body: Record<string, unknown> | undefined,
	makeId: () => string = randomUUID,
): Record<string, unknown> {
	return { ...(body ?? {}), requestId: makeId() }
}

/**
 * Tiny HTTP client for the CuePlayer remote API v1.
 * Uses node:http directly (not fetch): fetch adds `Sec-Fetch-Mode` and the app treats Sec-Fetch-* as a browser.
 */
export class CuePlayerClient {
	private readonly opts: Required<ClientOptions>
	private resolved: { address: string; at: number } | undefined

	constructor(opts: ClientOptions) {
		this.opts = { timeoutMs: 2500, token: '', ...opts, host: opts.host.trim() || '127.0.0.1' }
	}

	get host(): string {
		return this.opts.host
	}
	get port(): number {
		return this.opts.port
	}

	/**
	 * CuePlayer only accepts an IP (or localhost) in the Host header, to block DNS rebinding from web pages.
	 * So a host name from the config is resolved here and the request goes to the IP.
	 */
	private async address(): Promise<string> {
		const h = this.opts.host.replace(/^\[(.*)\]$/, '$1')
		// '이 컴퓨터만' listens on 127.0.0.1 only, so never let localhost become ::1
		if (h.toLowerCase() === 'localhost') return '127.0.0.1'
		if (net.isIP(h)) return h
		if (this.resolved && Date.now() - this.resolved.at < 60_000) return this.resolved.address
		try {
			const r = await dns.lookup(h, { family: 4 })
			this.resolved = { address: r.address, at: Date.now() }
			return r.address
		} catch (e) {
			throw new ApiError('network', `주소 ${h} 를 찾지 못했어요 (${(e as Error).message})`)
		}
	}

	async request<T = unknown>(req: ApiRequest): Promise<T> {
		const address = await this.address()
		const payload = req.body === undefined ? undefined : JSON.stringify(req.body)
		const headers = buildHeaders(this.opts.token, payload, {
			method: req.method,
			target: API_PREFIX + req.path,
			loopback: isLoopback(address),
		})
		return new Promise<T>((resolve, reject) => {
			const r = http.request(
				{
					host: address,
					port: this.opts.port,
					method: req.method,
					path: API_PREFIX + req.path,
					headers,
					agent: false,
					timeout: this.opts.timeoutMs,
				},
				(res) => {
					const chunks: Buffer[] = []
					let size = 0
					res.on('data', (c: Buffer) => {
						size += c.length
						if (size > MAX_RESPONSE) {
							res.destroy(new Error('response too large'))
							return
						}
						chunks.push(c)
					})
					res.on('error', (e) => reject(new ApiError('network', e.message)))
					res.on('end', () => {
						const status = res.statusCode ?? 0
						const text = Buffer.concat(chunks).toString('utf8')
						let json: any
						try {
							json = text ? JSON.parse(text) : {}
						} catch {
							reject(new ApiError('parse', `CuePlayer 응답을 읽지 못했어요 (HTTP ${status})`, status))
							return
						}
						if (status === 200 && json && json.ok !== false) {
							resolve(json as T)
							return
						}
						const code = typeof json?.error === 'string' ? json.error : undefined
						const message = typeof json?.message === 'string' ? json.message : `HTTP ${status}`
						reject(new ApiError(AUTH_CODES.has(status) ? 'auth' : 'http', message, status, code))
					})
				},
			)
			r.on('timeout', () => r.destroy(new ApiError('network', '응답이 없어요 (시간 초과)')))
			r.on('error', (e) => reject(e instanceof ApiError ? e : new ApiError('network', describeNetworkError(e))))
			if (payload !== undefined) r.write(payload)
			r.end()
		})
	}

	async getStatus(): Promise<CuePlayerStatus> {
		const r = await this.request<{ ok: boolean; status: CuePlayerStatus }>({ method: 'GET', path: '/status' })
		if (!r || typeof r.status !== 'object' || r.status === null)
			throw new ApiError('parse', 'status 가 없는 응답이에요', 200)
		return r.status
	}

	async getPlaylists(): Promise<PlaylistSummary[]> {
		const r = await this.request<{ playlists?: PlaylistSummary[] }>({ method: 'GET', path: '/playlists' })
		return Array.isArray(r.playlists) ? r.playlists : []
	}

	async getPlaylist(id: string): Promise<PlaylistDetail> {
		const r = await this.request<{ playlist?: PlaylistDetail }>({
			method: 'GET',
			path: `/playlists/${encodeURIComponent(id)}`,
		})
		if (!r.playlist) throw new ApiError('parse', 'playlist 가 없는 응답이에요', 200)
		return r.playlist
	}

	/** Mutating call (POST/PUT) with a fresh requestId. Returns the status CuePlayer sends back, if any. */
	async command(req: ApiRequest): Promise<CuePlayerStatus | undefined> {
		const r = await this.request<{ status?: CuePlayerStatus }>({ ...req, body: withRequestId(req.body) })
		return r && typeof r.status === 'object' && r.status !== null ? r.status : undefined
	}
}

function describeNetworkError(e: NodeJS.ErrnoException): string {
	switch (e.code) {
		case 'ECONNREFUSED':
			return '연결이 거부됐어요 — 큐플레이어가 꺼져 있거나 설정 → 원격 조작이 꺼져 있어요'
		case 'EHOSTUNREACH':
		case 'ENETUNREACH':
			return '그 주소에 닿지 못했어요 (같은 네트워크인지 확인)'
		case 'ECONNRESET':
			return '연결이 끊겼어요'
		default:
			return e.message || String(e)
	}
}

/** The commands of API v1 (see CuePlayer docs/REMOTE_PLAN.md 1A). Pure: easy to test. */
export const Commands = {
	go: (playlistId?: string, trackId?: string): ApiRequest => {
		const body: Record<string, unknown> = {}
		if (playlistId) body.playlistId = playlistId
		if (trackId) body.trackId = trackId
		return { method: 'POST', path: '/transport/go', body }
	},
	pause: (): ApiRequest => ({ method: 'POST', path: '/transport/pause', body: {} }),
	resume: (): ApiRequest => ({ method: 'POST', path: '/transport/resume', body: {} }),
	stop: (): ApiRequest => ({ method: 'POST', path: '/transport/stop', body: {} }),
	restart: (): ApiRequest => ({ method: 'POST', path: '/transport/restart', body: {} }),
	fadeout: (): ApiRequest => ({ method: 'POST', path: '/transport/fadeout', body: {} }),
	next: (): ApiRequest => ({ method: 'POST', path: '/transport/next', body: {} }),
	previous: (): ApiRequest => ({ method: 'POST', path: '/transport/previous', body: {} }),
	seek: (position: number): ApiRequest => ({
		method: 'POST',
		path: '/transport/seek',
		body: { position: Math.max(0, position) },
	}),
	skip: (by: number): ApiRequest => ({ method: 'POST', path: '/transport/skip', body: { by } }),
	background: (enabled: boolean): ApiRequest => ({ method: 'PUT', path: '/background', body: { enabled } }),
	stopAfter: (enabled: boolean): ApiRequest => ({ method: 'PUT', path: '/stop-after', body: { enabled } }),
	/** 한 곡 반복 = 재생 방식 '한 곡 반복' 켜고 끄기 (끄면 켜기 전 방식으로) */
	repeatOne: (enabled: boolean): ApiRequest => ({ method: 'PUT', path: '/repeat', body: { enabled } }),
	padTrigger: (slot: number): ApiRequest => ({ method: 'POST', path: `/pads/${slot}/trigger`, body: {} }),
	padStop: (slot: number): ApiRequest => ({ method: 'POST', path: `/pads/${slot}/stop`, body: {} }),
	padsStop: (): ApiRequest => ({ method: 'POST', path: '/pads/stop', body: {} }),
	/** 효과음 뱅크 넘기기 (끝에서 넘기면 처음으로, CuePlayer 맥 1.1.53 · 윈도우 1.0.63~). API 경로는 예전 이름 page 그대로 */
	padPageNext: (): ApiRequest => ({ method: 'POST', path: '/pads/page/next', body: {} }),
	padPagePrevious: (): ApiRequest => ({ method: 'POST', path: '/pads/page/previous', body: {} }),
	/** n번째 뱅크 (1부터, 없으면 404) */
	padPage: (page: number): ApiRequest => ({ method: 'PUT', path: '/pads/page', body: { page } }),
}
