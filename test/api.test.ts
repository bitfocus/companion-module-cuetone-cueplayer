import { afterEach, describe, expect, it } from 'vitest'
import { ApiError, Commands, CuePlayerClient, buildHeaders, signature, withRequestId } from '../src/api.js'
import { startMockCuePlayer } from './mock-cueplayer.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

let close: (() => Promise<void>) | undefined
afterEach(async () => {
	await close?.()
	close = undefined
})

describe('request building', () => {
	it('sends Bearer only when a token is set, never Origin / Sec-Fetch-*', () => {
		const h = buildHeaders(' abc ', '{"a":1}')
		expect(h['Authorization']).toBe('Bearer abc')
		expect(h['Content-Type']).toMatch(/application\/json/)
		expect(h['Content-Length']).toBe('7')
		expect(Object.keys(h).map((k) => k.toLowerCase())).not.toContain('origin')
		expect(Object.keys(h).some((k) => k.toLowerCase().startsWith('sec-fetch'))).toBe(false)

		const g = buildHeaders('', undefined)
		expect(g['Authorization']).toBeUndefined()
		expect(g['Content-Type']).toBeUndefined()
	})

	it('signs with the token and never sends the token itself to another computer', () => {
		const lan = buildHeaders('tok', '{"a":1}', {
			method: 'post',
			target: '/api/v1/transport/play',
			loopback: false,
			time: 1700000000,
			nonce: 'n'.repeat(16),
		})
		expect(lan['Authorization']).toBeUndefined()
		expect(lan['X-Cue-Time']).toBe('1700000000')
		expect(lan['X-Cue-Nonce']).toBe('nnnnnnnnnnnnnnnn')
		// 맥 · 윈도우 앱과 같은 값 (고정 입력) — 앱 smoke 의 같은 검사와 짝
		expect(lan['X-Cue-Signature']).toBe(
			signature('tok', 'POST', '/api/v1/transport/play', '1700000000', 'nnnnnnnnnnnnnnnn', '{"a":1}'),
		)
		expect(lan['X-Cue-Signature']).toMatch(/^v1=[0-9a-f]{64}$/)
		const local = buildHeaders('tok', undefined, { method: 'GET', target: '/api/v1/status', loopback: true })
		expect(local['Authorization']).toBe('Bearer tok')
		expect(local['X-Cue-Signature']).toMatch(/^v1=/)
		expect(buildHeaders('tok', undefined, { method: 'GET', target: '/x', loopback: false })['X-Cue-Nonce']).not.toBe(
			buildHeaders('tok', undefined, { method: 'GET', target: '/x', loopback: false })['X-Cue-Nonce'],
		)
	})

	it('adds a fresh uuid requestId to every command body', () => {
		const a = withRequestId({ position: 3 })
		const b = withRequestId({ position: 3 })
		expect(a.position).toBe(3)
		expect(a.requestId).toMatch(UUID)
		expect(a.requestId).not.toBe(b.requestId)
		expect(withRequestId(undefined, () => 'x')).toEqual({ requestId: 'x' })
	})

	it('maps every command to the v1 route', () => {
		expect(Commands.go()).toEqual({ method: 'POST', path: '/transport/go', body: {} })
		expect(Commands.go('p1', 't2')).toEqual({
			method: 'POST',
			path: '/transport/go',
			body: { playlistId: 'p1', trackId: 't2' },
		})
		expect(Commands.go(undefined, 't2').body).toEqual({ trackId: 't2' })
		expect(Commands.pause().path).toBe('/transport/pause')
		expect(Commands.resume().path).toBe('/transport/resume')
		expect(Commands.stop().path).toBe('/transport/stop')
		expect(Commands.restart().path).toBe('/transport/restart')
		expect(Commands.fadeout().path).toBe('/transport/fadeout')
		expect(Commands.next().path).toBe('/transport/next')
		expect(Commands.previous().path).toBe('/transport/previous')
		expect(Commands.seek(-4).body).toEqual({ position: 0 })
		expect(Commands.skip(-10)).toEqual({ method: 'POST', path: '/transport/skip', body: { by: -10 } })
		expect(Commands.background(true)).toEqual({ method: 'PUT', path: '/background', body: { enabled: true } })
		expect(Commands.stopAfter(false)).toEqual({ method: 'PUT', path: '/stop-after', body: { enabled: false } })
		expect(Commands.padTrigger(3)).toEqual({ method: 'POST', path: '/pads/3/trigger', body: {} })
		expect(Commands.padStop(9).path).toBe('/pads/9/stop')
		expect(Commands.padsStop().path).toBe('/pads/stop')
	})
})

describe('client against the mock CuePlayer', () => {
	it('reads status and sends the token as Authorization: Bearer', async () => {
		const m = await startMockCuePlayer({ token: 'secret-token' })
		close = m.close
		const c = new CuePlayerClient({ host: '127.0.0.1', port: m.port, token: 'secret-token' })
		const s = await c.getStatus()
		expect(s.apiVersion).toBe(1)
		expect(s.state).toBe('stopped')
		const req = m.mock.requests.at(-1)
		expect(req.headers['authorization']).toBe('Bearer secret-token')
		expect(req.headers['origin']).toBeUndefined()
		expect(Object.keys(req.headers).some((k: string) => k.startsWith('sec-fetch'))).toBe(false)
	})

	it('wrong or missing token → ApiError kind auth (401 unauthorized)', async () => {
		const m = await startMockCuePlayer({ token: 'right' })
		close = m.close
		for (const token of ['wrong', '']) {
			const c = new CuePlayerClient({ host: '127.0.0.1', port: m.port, token })
			const e = await c.getStatus().catch((x: unknown) => x)
			expect(e).toBeInstanceOf(ApiError)
			expect((e as ApiError).kind).toBe('auth')
			expect((e as ApiError).statusCode).toBe(401)
			expect((e as ApiError).code).toBe('unauthorized')
			expect((e as ApiError).message).toBe('토큰이 없거나 틀려요')
		}
	})

	it('app errors keep CuePlayer code and message', async () => {
		const m = await startMockCuePlayer()
		close = m.close
		const c = new CuePlayerClient({ host: 'localhost', port: m.port })
		const e = (await c.command(Commands.restart()).catch((x: unknown) => x)) as ApiError
		expect(e.kind).toBe('http')
		expect(e.statusCode).toBe(409)
		expect(e.code).toBe('no_track')
		const nf = (await c.getPlaylist('pnope').catch((x: unknown) => x)) as ApiError
		expect(nf.statusCode).toBe(404)
		expect(nf.code).toBe('not_found')
	})

	it('commands carry a requestId and return the new status', async () => {
		const m = await startMockCuePlayer()
		close = m.close
		const c = new CuePlayerClient({ host: '127.0.0.1', port: m.port })
		const s = await c.command(Commands.go('p1a2b3c4d5e6f', 't000000000002'))
		expect(s?.state).toBe('playing')
		expect(s?.current?.title).toBe('신랑 입장')
		const req = m.mock.requests.at(-1)
		expect(req.method).toBe('POST')
		expect(req.path).toBe('/api/v1/transport/go')
		expect(req.body.playlistId).toBe('p1a2b3c4d5e6f')
		expect(req.body.trackId).toBe('t000000000002')
		expect(req.body.requestId).toMatch(UUID)

		await c.command(Commands.background(true))
		const put = m.mock.requests.at(-1)
		expect(put.method).toBe('PUT')
		expect(put.body.enabled).toBe(true)
		expect(put.body.requestId).toMatch(UUID)
	})

	it('reads playlists and tracks', async () => {
		const m = await startMockCuePlayer()
		close = m.close
		const c = new CuePlayerClient({ host: '127.0.0.1', port: m.port })
		const lists = await c.getPlaylists()
		expect(lists.map((p) => p.name)).toEqual(['입장', '시상식'])
		const p = await c.getPlaylist(lists[0].id)
		expect(p.tracks[2]).toMatchObject({ title: '없는 파일', missing: true })
	})

	it('no app → network error; slow app → timeout', async () => {
		const m = await startMockCuePlayer()
		const port = m.port
		await m.close()
		const c = new CuePlayerClient({ host: '127.0.0.1', port })
		const e = (await c.getStatus().catch((x: unknown) => x)) as ApiError
		expect(e.kind).toBe('network')
		expect(e.message).toContain('연결이 거부')

		const slow = await startMockCuePlayer()
		close = slow.close
		slow.mock.delayMs = 400
		const c2 = new CuePlayerClient({ host: '127.0.0.1', port: slow.port, timeoutMs: 100 })
		const t = (await c2.getStatus().catch((x: unknown) => x)) as ApiError
		expect(t.kind).toBe('network')
		expect(t.message).toContain('시간 초과')
	})

	it('CuePlayer turned remote off → 503 disabled is a connection problem, not auth', async () => {
		const m = await startMockCuePlayer({ enabled: false })
		close = m.close
		const c = new CuePlayerClient({ host: '127.0.0.1', port: m.port })
		const e = (await c.getStatus().catch((x: unknown) => x)) as ApiError
		expect(e.kind).toBe('http')
		expect(e.code).toBe('disabled')
	})
})
