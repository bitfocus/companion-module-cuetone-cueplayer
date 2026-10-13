import { ApiError, Commands, CuePlayerClient, type ApiRequest } from './api.js'
import { loadLibrary, libraryKey, type Library } from './library.js'
import { statusToVariables, toggleCommand } from './state.js'
import type { CuePlayerStatus } from './types.js'
import type { VariablesSchema } from './variables.js'

export type LinkState = 'connecting' | 'ok' | 'connection_failure' | 'auth_failure'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** What the connection needs from Companion (the module instance), so it can be tested without Companion. */
export interface ConnectionHost {
	setVariableValues(values: Partial<VariablesSchema>): void
	/** ids of feedbacks to re-check; empty = all */
	checkFeedbacks(ids: FeedbackGroup[]): void
	setLinkState(state: LinkState, message: string | null): void
	log(level: LogLevel, message: string): void
	libraryChanged(lib: Library): void
}

/** Feedbacks that depend on the position (re-checked every poll while it moves) */
export type FeedbackGroup = 'state' | 'time'

export interface ConnectionOptions {
	host: string
	port: number
	token?: string
	pollMs: number
	libraryRefreshMs?: number
	timeoutMs?: number
}

/**
 * Polls GET /status (never two at once), keeps the playlist library for the dropdowns
 * and sends commands. Disconnected = status null = every feedback false.
 */
export class CuePlayerConnection {
	readonly client: CuePlayerClient
	status: CuePlayerStatus | null = null
	library: Library | undefined
	link: LinkState = 'connecting'

	private readonly host: ConnectionHost
	private readonly opts: Required<ConnectionOptions>
	private running = false
	private pollTimer: NodeJS.Timeout | undefined
	private libraryTimer: NodeJS.Timeout | undefined
	private linkMessage: string | null = null
	private vars: Partial<VariablesSchema> = {}
	private stableKey = ''
	private timeKey = ''
	private lastInstanceId: string | undefined
	private lastRevision: number | undefined
	private lastPlaylistId: string | undefined
	private libraryLoading = false
	private libraryKeyValue = ''
	private lastStatusReloadAt = 0
	/** requests are numbered when sent; an older answer never overwrites a newer one */
	private seq = 0
	private appliedSeq = 0

	constructor(host: ConnectionHost, opts: ConnectionOptions) {
		this.host = host
		this.opts = { libraryRefreshMs: 30_000, timeoutMs: 2500, token: '', ...opts }
		this.client = new CuePlayerClient({
			host: opts.host,
			port: opts.port,
			token: opts.token,
			timeoutMs: this.opts.timeoutMs,
		})
	}

	start(): void {
		if (this.running) return
		this.running = true
		this.link = 'connecting'
		this.linkMessage = null
		this.host.setLinkState('connecting', null)
		this.applyStatus(null)
		void this.pollOnce()
		this.libraryTimer = setInterval(() => {
			if (this.link === 'ok') void this.reloadLibrary('30초 주기')
		}, this.opts.libraryRefreshMs)
	}

	stop(): void {
		this.running = false
		if (this.pollTimer) clearTimeout(this.pollTimer)
		if (this.libraryTimer) clearInterval(this.libraryTimer)
		this.pollTimer = undefined
		this.libraryTimer = undefined
	}

	/** One poll, then schedule the next one only after this one finished (no overlapping requests). */
	private async pollOnce(): Promise<void> {
		if (!this.running) return
		const my = ++this.seq
		try {
			const s = await this.client.getStatus()
			if (!this.running) return
			this.setLink('ok', null)
			this.acceptStatus(my, s)
		} catch (e) {
			if (!this.running) return
			this.failed(e)
		}
		if (!this.running) return
		// while failing, don't hammer: at most once a second
		const delay = this.link === 'ok' ? this.opts.pollMs : Math.max(this.opts.pollMs, 1000)
		this.pollTimer = setTimeout(() => void this.pollOnce(), delay)
	}

	private acceptStatus(my: number, s: CuePlayerStatus): void {
		if (my < this.appliedSeq) return
		this.appliedSeq = my
		this.applyStatus(s)
		this.maybeReloadLibrary(s)
	}

	private failed(e: unknown): void {
		const err = e instanceof ApiError ? e : new ApiError('network', String((e as Error)?.message ?? e))
		const state: LinkState = err.kind === 'auth' ? 'auth_failure' : 'connection_failure'
		let message = err.message
		if (err.kind === 'auth' && err.code === 'local_only')
			message = `${message} — 큐플레이어 설정 → 원격 조작 → 받을 곳을 '같은 네트워크'로 바꾸고 토큰을 넣어 주세요`
		this.setLink(state, message)
		this.appliedSeq = ++this.seq
		this.applyStatus(null)
	}

	private setLink(state: LinkState, message: string | null): void {
		if (state === this.link && message === this.linkMessage) return
		const was = this.link
		this.link = state
		this.linkMessage = message
		this.host.setLinkState(state, message)
		if (state === 'ok' && was !== 'ok') {
			this.host.log('info', `큐플레이어에 연결됐어요 (${this.client.host}:${this.client.port})`)
			void this.reloadLibrary('연결됨')
		} else if (state !== 'ok' && state !== 'connecting') {
			this.host.log('warn', `큐플레이어 연결 실패: ${message ?? state}`)
		}
	}

	/** Push status into variables / feedbacks. Only what changed is sent to Companion. */
	applyStatus(s: CuePlayerStatus | null): void {
		this.status = s
		const vars = statusToVariables(s, this.vars)
		const changed: Partial<VariablesSchema> = {}
		let any = false
		for (const [k, v] of Object.entries(vars) as [keyof VariablesSchema, VariablesSchema[keyof VariablesSchema]][]) {
			if (this.vars[k] !== v) {
				;(changed as Record<string, unknown>)[k] = v
				any = true
			}
		}
		if (any) this.host.setVariableValues(changed)
		this.vars = vars

		const { position: _p, remaining, revision: _r, ...stable } = s ?? ({} as Partial<CuePlayerStatus>)
		const stableKey = s ? JSON.stringify(stable) : 'null'
		const timeKey = s ? `${s.state}|${remaining}` : 'null'
		const groups: FeedbackGroup[] = []
		if (stableKey !== this.stableKey) groups.push('state')
		if (timeKey !== this.timeKey) groups.push('time')
		this.stableKey = stableKey
		this.timeKey = timeKey
		if (groups.length) this.host.checkFeedbacks(groups)
	}

	/** Reload the dropdown library when the app restarted or the current playlist changed. */
	private maybeReloadLibrary(s: CuePlayerStatus): void {
		const playlistId = s.current?.playlistId
		let reason: string | undefined
		if (s.instanceId !== this.lastInstanceId && this.lastInstanceId !== undefined) reason = '앱 다시 켜짐'
		else if (s.revision !== this.lastRevision && playlistId && playlistId !== this.lastPlaylistId) {
			const known = this.library?.playlists.some((p) => p.id === playlistId)
			if (!known || this.lastPlaylistId !== undefined) reason = '지금 목록 바뀜'
		}
		this.lastInstanceId = s.instanceId
		this.lastRevision = s.revision
		if (playlistId) this.lastPlaylistId = playlistId
		if (reason && Date.now() - this.lastStatusReloadAt > 3000) {
			this.lastStatusReloadAt = Date.now()
			void this.reloadLibrary(reason)
		}
	}

	async reloadLibrary(reason: string): Promise<void> {
		if (this.libraryLoading) return
		this.libraryLoading = true
		try {
			const lib = await loadLibrary(this.client)
			if (!this.running) return
			this.library = lib
			const key = libraryKey(lib)
			if (key !== this.libraryKeyValue) {
				this.libraryKeyValue = key
				const tracks = lib.playlists.reduce((n, p) => n + p.tracks.length, 0)
				this.host.log('debug', `목록 ${lib.playlists.length}개 · 곡 ${tracks}개 불러옴 (${reason})`)
				this.host.libraryChanged(lib)
			}
		} catch (e) {
			this.host.log('debug', `목록을 불러오지 못했어요: ${(e as Error).message}`)
		} finally {
			this.libraryLoading = false
		}
	}

	/** Send one command; apply the status that comes back. Returns false (and logs) on failure. */
	async send(req: ApiRequest, label: string): Promise<boolean> {
		const my = ++this.seq
		try {
			const s = await this.client.command(req)
			if (s && this.running) this.acceptStatus(my, s)
			return true
		} catch (e) {
			const err = e as ApiError
			this.host.log('warn', `${label} 실패: ${err.message}${err.code ? ` (${err.code})` : ''}`)
			return false
		}
	}

	/** 재생/일시정지: pause while playing, otherwise resume (or go when nothing is loaded). */
	async togglePlayPause(): Promise<boolean> {
		let s = this.status
		if (!s) {
			try {
				s = await this.client.getStatus()
			} catch {
				s = null
			}
		}
		const what = toggleCommand(s)
		if (what === 'pause') return this.send(Commands.pause(), '일시정지')
		if (what === 'go') return this.send(Commands.go(), '재생')
		return this.send(Commands.resume(), '이어서 재생')
	}
}
