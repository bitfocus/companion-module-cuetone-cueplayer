// Mock CuePlayer remote API v1 — same routes, checks and JSON shapes as CuePlayer (Sources/RemoteControl.swift).
// Tests import startMockCuePlayer(); run it by hand for a real Companion:
//   node test/mock-cueplayer.mjs [--port 53100] [--token secret]
import http from 'node:http'
import net from 'node:net'
import { pathToFileURL } from 'node:url'

const PREFIX = '/api/v1'

function defaultLibrary() {
	return [
		{
			id: 'p1a2b3c4d5e6f',
			name: '입장',
			user: true,
			tracks: [
				{ id: 't000000000001', title: '오프닝 팡파르', duration: 95.4 },
				{ id: 't000000000002', title: '신랑 입장', duration: 182.0 },
				{ id: 't000000000003', title: '없는 파일', duration: 60, missing: true },
			],
		},
		{
			id: 'p6f5e4d3c2b1a',
			name: '시상식',
			user: true,
			tracks: [
				{ id: 't000000000004', title: '수상자 등장', duration: 40.2 },
				{ id: 't000000000001', title: '오프닝 팡파르', duration: 95.4 },
			],
		},
	]
}

function defaultPads() {
	const names = ['박수', '팡파르', '두구두구', '딩동댕', '', '', '', '', '웃음']
	return names.map((name, i) => ({ id: `pad${i + 1}`, name, empty: name === '', playing: false }))
}

export class MockCuePlayer {
	constructor({ token = '', localOnly = false, enabled = true } = {}) {
		this.token = token
		this.localOnly = localOnly
		this.enabled = enabled
		this.playlists = defaultLibrary()
		this.pads = defaultPads()
		this.requests = []
		this.statusInFlight = 0
		this.maxStatusInFlight = 0
		/** answer every request this much later (ms) */
		this.delayMs = 0
		this.instanceId = 'mock-' + Math.random().toString(16).slice(2, 10)
		this.revision = 0
		this.lastSnap = ''
		this.recent = new Map()
		/** e.g. { output: 'Built-in Output 가 사라졌어요' } to fake problems */
		this.outputProblem = null
		this.announcing = false
		this.reset()
	}

	reset() {
		this.state = 'stopped'
		this.current = null // { track, playlist }
		this.queue = null
		this.position = 0
		this.cued = null
		this.background = false
		this.stopAfter = false
	}

	track(t) {
		if (!t) return null
		const d = { id: t.id, title: t.title }
		if (t.duration !== undefined) d.duration = t.duration
		return d
	}

	upcoming() {
		if (!this.current) return null
		const list = this.current.playlist.tracks.filter((t) => !t.missing)
		const i = list.findIndex((t) => t.id === this.current.track.id)
		return list[i + 1] ?? null
	}

	status() {
		let current = null
		if (this.current) {
			current = {
				id: this.current.track.id,
				title: this.current.track.title,
				duration: this.current.track.duration,
				playlistId: this.current.playlist.id,
				playlist: this.current.playlist.name,
			}
		}
		const stable = {
			state: this.state,
			current,
			cued: this.track(this.cued),
			next: this.track(this.upcoming()),
			background: this.background,
			stopAfter: this.stopAfter,
			locked: false,
			pads: this.pads.map((p, i) => ({ slot: i + 1, name: p.name, playing: p.playing, empty: p.empty })),
			announcing: this.announcing,
			output: { name: 'Built-in Output', problem: this.outputProblem },
		}
		const snap = JSON.stringify(stable)
		if (snap !== this.lastSnap) {
			this.revision += 1
			this.lastSnap = snap
		}
		const duration = this.current?.track.duration ?? 0
		return {
			...stable,
			position: this.current ? Math.round(this.position * 10) / 10 : 0,
			remaining: this.current ? Math.round(Math.max(duration - this.position, 0) * 10) / 10 : 0,
			apiVersion: 1,
			appVersion: 'mock',
			instanceId: this.instanceId,
			revision: this.revision,
		}
	}

	play(playlist, track) {
		this.current = { playlist, track }
		this.position = 0
		this.state = 'playing'
		this.cued = null
	}

	/** returns [code, body] exactly like RemoteControl.handle */
	handle(method, rawPath, headers, rawBody, peer) {
		const err = (code, error, message) => [code, { ok: false, error, message }]
		if (!this.enabled) return err(503, 'disabled', '원격 조작이 꺼져 있어요')
		if (headers['origin'] !== undefined || headers['sec-fetch-site'] !== undefined)
			return err(403, 'browser', '웹 브라우저 요청은 받지 않아요')
		let host = String(headers['host'] ?? '').toLowerCase()
		if (host.startsWith('[')) host = host.slice(1, host.indexOf(']'))
		else if (host.includes(':')) host = host.slice(0, host.lastIndexOf(':'))
		if (!(host === 'localhost' || net.isIP(host))) return err(403, 'bad_host', '주소는 IP 로 보내 주세요')
		const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer)
		if (this.localOnly && !loopback) return err(403, 'local_only', '이 컴퓨터에서만 받도록 되어 있어요')
		if (this.token) {
			const auth = String(headers['authorization'] ?? '')
			if (!auth.startsWith('Bearer ') || auth.slice(7) !== this.token)
				return err(401, 'unauthorized', '토큰이 없거나 틀려요')
		}
		let body = {}
		if (rawBody.length) {
			try {
				body = JSON.parse(rawBody)
			} catch {
				body = null
			}
			if (!body || typeof body !== 'object' || Array.isArray(body))
				return err(400, 'bad_request', '본문은 JSON 객체여야 해요')
		}
		const path = rawPath.split('?')[0]
		if (!path.startsWith(PREFIX + '/')) return err(404, 'not_found', '없는 주소예요')
		const parts = path
			.slice(PREFIX.length + 1)
			.split('/')
			.filter(Boolean)
		const m = method.toUpperCase()
		const route = parts.join('/')
		const need = (want) => (m === want ? null : err(405, 'method_not_allowed', '메서드가 달라요'))

		const isRead = m === 'GET'
		const requestId = typeof body.requestId === 'string' ? body.requestId : headers['x-request-id']
		const now = Date.now()
		for (const [k, v] of this.recent) if (now - v.at > 30_000) this.recent.delete(k)
		if (requestId && !isRead && this.recent.has(requestId)) return this.recent.get(requestId).result

		const result = this.route(m, parts, route, body, need, err)
		if (requestId && !isRead) this.recent.set(requestId, { at: now, result })
		return result
	}

	route(m, parts, route, body, need, err) {
		const ok = (extra = {}) => [200, { ok: true, status: this.status(), ...extra }]
		const bad = (msg) => err(400, 'bad_request', msg)
		const noTrack = (msg = '지금 곡이 없어요') => err(409, 'no_track', msg)
		let r
		if (route === 'status') return need('GET') ?? ok()
		if (route === 'playlists')
			return (
				need('GET') ?? [
					200,
					{
						ok: true,
						playlists: this.playlists.map((p) => ({
							id: p.id,
							name: p.name,
							trackCount: p.tracks.length,
							user: p.user,
						})),
					},
				]
			)
		if (parts.length === 2 && parts[0] === 'playlists') {
			if ((r = need('GET'))) return r
			const p = this.playlists.find((x) => x.id === parts[1])
			if (!p) return err(404, 'not_found', '그런 목록이 없어요')
			return [
				200,
				{
					ok: true,
					playlist: {
						id: p.id,
						name: p.name,
						tracks: p.tracks.map((t) => ({ id: t.id, title: t.title, missing: !!t.missing, duration: t.duration })),
					},
				},
			]
		}
		switch (route) {
			case 'transport/go': {
				if ((r = need('POST'))) return r
				const trackId = typeof body.trackId === 'string' && body.trackId ? body.trackId : null
				const playlistId = typeof body.playlistId === 'string' && body.playlistId ? body.playlistId : null
				if (trackId) {
					const lists = this.playlists.filter((p) => !playlistId || p.id === playlistId)
					const p = lists.find((x) => x.tracks.some((t) => t.id === trackId))
					if (!p) return err(404, 'not_found', '그런 곡이 없어요')
					const t = p.tracks.find((x) => x.id === trackId)
					if (t.missing) return err(409, 'missing_file', '곡 파일을 찾지 못했어요')
					this.play(p, t)
				} else if (this.cued) {
					this.play(this.cued.playlist ?? this.playlists[0], this.cued)
				} else {
					return noTrack('고른 곡이 없어요 (trackId 를 주거나 앱에서 곡을 골라 주세요)')
				}
				return ok()
			}
			case 'transport/pause':
				if ((r = need('POST'))) return r
				if (this.state === 'playing' || this.state === 'fading') this.state = 'paused'
				return ok()
			case 'transport/resume':
				if ((r = need('POST'))) return r
				if (!this.current && !this.cued) return noTrack('이어서 틀 곡이 없어요')
				if (!this.current) this.play(this.playlists[0], this.cued)
				else if (this.state === 'paused') this.state = 'playing'
				return ok()
			case 'transport/stop':
				if ((r = need('POST'))) return r
				if (this.current) {
					this.state = 'paused'
					this.position = 0
				}
				return ok()
			case 'transport/restart':
				if ((r = need('POST'))) return r
				if (!this.current) return noTrack()
				this.position = 0
				this.state = 'playing'
				return ok()
			case 'transport/fadeout':
				if ((r = need('POST'))) return r
				if (this.state === 'playing') this.state = 'fading'
				return ok()
			case 'transport/next':
			case 'transport/previous': {
				if ((r = need('POST'))) return r
				if (!this.current) return ok()
				const list = this.current.playlist.tracks.filter((t) => !t.missing)
				const i = list.findIndex((t) => t.id === this.current.track.id)
				const t = list[route.endsWith('next') ? i + 1 : Math.max(i - 1, 0)]
				if (t) this.play(this.current.playlist, t)
				return ok()
			}
			case 'transport/seek':
				if (typeof body.position !== 'number' || body.position < 0) return bad('position(초)이 필요해요')
				if ((r = need('POST'))) return r
				if (!this.current) return noTrack()
				this.position = Math.min(body.position, this.current.track.duration - 0.5)
				return ok()
			case 'transport/skip':
				if (typeof body.by !== 'number' || !Number.isFinite(body.by)) return bad('by(초, ±)가 필요해요')
				if ((r = need('POST'))) return r
				if (!this.current) return noTrack()
				this.position = Math.min(Math.max(this.position + body.by, 0), this.current.track.duration)
				return ok()
			case 'background':
			case 'stop-after':
				if (m !== 'PUT') return err(405, 'method_not_allowed', '메서드가 달라요')
				if (typeof body.enabled !== 'boolean') return bad('enabled (true/false) 가 필요해요')
				if (route === 'background') this.background = body.enabled
				else {
					if (!this.current) return noTrack()
					this.stopAfter = body.enabled
				}
				return ok()
			case 'pads/stop':
				if ((r = need('POST'))) return r
				for (const p of this.pads) p.playing = false
				return ok()
		}
		if (parts.length === 3 && parts[0] === 'pads') {
			const slot = Number(parts[1])
			if (!Number.isInteger(slot) || slot < 1) return bad('자리 번호는 1부터예요')
			if (parts[2] !== 'trigger' && parts[2] !== 'stop') return err(404, 'not_found', '없는 주소예요')
			if ((r = need('POST'))) return r
			const pad = this.pads[slot - 1]
			if (parts[2] === 'trigger') {
				if (!pad || pad.empty) return err(404, 'not_found', `${slot}번 효과음 칸이 비어 있어요`)
				pad.playing = true
			} else {
				if (!pad) return err(404, 'not_found', `${slot}번 효과음 칸이 없어요`)
				pad.playing = false
			}
			return ok()
		}
		return err(404, 'not_found', '없는 주소예요')
	}

	/** advance the fake clock (seconds) — tests call this instead of waiting */
	tick(seconds) {
		if (!this.current || (this.state !== 'playing' && this.state !== 'fading')) return
		this.position += seconds
		if (this.position >= this.current.track.duration) {
			this.state = 'stopped'
			this.current = null
			this.position = 0
		}
	}
}

/** Start a mock on 127.0.0.1 (port 0 = any free port). */
export async function startMockCuePlayer(opts = {}) {
	const mock = new MockCuePlayer(opts)
	const server = http.createServer((req, res) => {
		const chunks = []
		req.on('data', (c) => chunks.push(c))
		req.on('end', () => {
			const raw = Buffer.concat(chunks).toString('utf8')
			let parsed
			try {
				parsed = raw ? JSON.parse(raw) : undefined
			} catch {
				parsed = raw
			}
			mock.requests.push({ method: req.method, path: req.url, headers: { ...req.headers }, body: parsed })
			const isStatus = req.method === 'GET' && (req.url ?? '').startsWith(PREFIX + '/status')
			if (isStatus) {
				mock.statusInFlight += 1
				mock.maxStatusInFlight = Math.max(mock.maxStatusInFlight, mock.statusInFlight)
			}
			const peer = (req.socket.remoteAddress ?? '').replace(/%.*$/, '')
			const delay = mock.delayMs
			const send = () => {
				const [code, body] = mock.handle(req.method ?? 'GET', req.url ?? '/', req.headers, raw, peer)
				const data = Buffer.from(JSON.stringify(body))
				res.writeHead(code, {
					'Content-Type': 'application/json; charset=utf-8',
					'Content-Length': data.length,
					'Cache-Control': 'no-store',
					Connection: 'close',
				})
				res.end(data)
				if (isStatus) mock.statusInFlight -= 1
			}
			if (delay) setTimeout(send, delay)
			else send()
		})
	})
	await new Promise((resolve) => server.listen(opts.port ?? 0, opts.host ?? '127.0.0.1', resolve))
	const port = server.address().port
	return {
		mock,
		port,
		close: () =>
			new Promise((resolve) => {
				server.closeAllConnections?.()
				server.close(() => resolve())
			}),
	}
}

// run by hand
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const arg = (name, fallback) => {
		const i = process.argv.indexOf(`--${name}`)
		return i > 0 ? process.argv[i + 1] : fallback
	}
	const port = Number(arg('port', '53100'))
	const token = arg('token', '')
	const { mock } = await startMockCuePlayer({ port, token, host: arg('host', '127.0.0.1') })
	setInterval(() => mock.tick(0.5), 500)
	console.log(`mock CuePlayer on http://127.0.0.1:${port}/api/v1/status${token ? ' (token required)' : ''}`)
}
