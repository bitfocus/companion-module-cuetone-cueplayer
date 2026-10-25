import { afterEach, describe, expect, it } from 'vitest'
import { Commands } from '../src/api.js'
import { CuePlayerConnection, type ConnectionHost, type FeedbackGroup, type LinkState } from '../src/connection.js'
import type { Library } from '../src/library.js'
import { Checks } from '../src/state.js'
import type { VariablesSchema } from '../src/variables.js'
import { startMockCuePlayer } from './mock-cueplayer.mjs'

class FakeHost implements ConnectionHost {
	vars: Partial<VariablesSchema> = {}
	links: { state: LinkState; message: string | null }[] = []
	checks: FeedbackGroup[][] = []
	logs: string[] = []
	libraries: Library[] = []
	setVariableValues(values: Partial<VariablesSchema>) {
		Object.assign(this.vars, values)
	}
	checkFeedbacks(ids: FeedbackGroup[]) {
		this.checks.push(ids)
	}
	setLinkState(state: LinkState, message: string | null) {
		this.links.push({ state, message })
	}
	log(level: string, message: string) {
		this.logs.push(`${level}: ${message}`)
	}
	libraryChanged(lib: Library) {
		this.libraries.push(lib)
	}
	get link() {
		return this.links.at(-1)?.state
	}
}

async function until(cond: () => boolean, ms = 3000): Promise<void> {
	const start = Date.now()
	while (!cond()) {
		if (Date.now() - start > ms) throw new Error('timed out waiting')
		await new Promise((r) => setTimeout(r, 10))
	}
}

const cleanups: (() => Promise<void> | void)[] = []
afterEach(async () => {
	while (cleanups.length) await cleanups.pop()!()
})

async function setup(opts: { token?: string; serverToken?: string; pollMs?: number } = {}) {
	const m = await startMockCuePlayer({ token: opts.serverToken ?? '' })
	cleanups.push(m.close)
	const host = new FakeHost()
	const conn = new CuePlayerConnection(host, {
		host: '127.0.0.1',
		port: m.port,
		token: opts.token ?? '',
		pollMs: opts.pollMs ?? 20,
		libraryRefreshMs: 60_000,
	})
	cleanups.push(() => conn.stop())
	conn.start()
	return { m, host, conn }
}

describe('CuePlayerConnection', () => {
	it('connects, fills variables and loads the playlist library', async () => {
		const { host, conn } = await setup()
		await until(() => host.link === 'ok' && host.libraries.length > 0)
		expect(host.links[0].state).toBe('connecting')
		expect(host.vars.state).toBe('stopped')
		expect(host.vars.pad_1_name).toBe('박수')
		expect(host.vars.pad_5_name).toBe('')
		const lib = host.libraries.at(-1)!
		expect(lib.playlists.map((p) => p.name)).toEqual(['입장', '시상식'])
		expect(lib.playlists[0].tracks).toHaveLength(3)
		expect(conn.library).toBe(lib)
	})

	it('commands update state at once and feedbacks follow', async () => {
		const { m, host, conn } = await setup()
		await until(() => host.link === 'ok')
		expect(await conn.send(Commands.go('p1a2b3c4d5e6f', 't000000000001'), '재생')).toBe(true)
		expect(host.vars.state).toBe('playing')
		expect(host.vars.current_title).toBe('오프닝 팡파르')
		expect(host.vars.current_playlist).toBe('입장')
		expect(host.vars.next_title).toBe('신랑 입장')
		expect(Checks.playing(conn.status)).toBe(true)
		expect(host.checks.flat()).toContain('state')

		m.mock.tick(90)
		await until(() => host.vars.remaining === '0:06')
		expect(host.vars.remaining_seconds).toBe(6)
		expect(Checks.remainingBelow(conn.status, 10)).toBe(true)

		await conn.togglePlayPause()
		expect(host.vars.state).toBe('paused')
		await conn.togglePlayPause()
		expect(host.vars.state).toBe('playing')

		expect(await conn.send(Commands.padTrigger(2), '효과음 2')).toBe(true)
		expect(Checks.padPlaying(conn.status, 2)).toBe(true)
		expect(await conn.send(Commands.padTrigger(5), '효과음 5')).toBe(false)
		expect(host.logs.some((l) => l.includes('5번 효과음 칸이 비어 있어요') && l.includes('not_found'))).toBe(true)
	})

	it('flips pad pages and explains 404 from an older CuePlayer', async () => {
		const { m, host, conn } = await setup()
		await until(() => host.link === 'ok')
		await until(() => host.vars.pad_page_name === '기본')
		expect(host.vars.pad_page_count).toBe(3)
		expect(await conn.send(Commands.padPageNext(), '효과음 다음 판')).toBe(true)
		expect(host.vars.pad_page_name).toBe('2부 레크리에이션')
		expect(Checks.padPageIs(conn.status, 2)).toBe(true)
		expect(await conn.send(Commands.padPagePrevious(), '효과음 앞 판')).toBe(true)
		expect(await conn.send(Commands.padPagePrevious(), '효과음 앞 판')).toBe(true)
		expect(host.vars.pad_page_index).toBe(3)
		expect(await conn.send(Commands.padPage(1), '효과음 1번째 판')).toBe(true)
		expect(host.vars.pad_page_name).toBe('기본')
		expect(await conn.send(Commands.padPage(9), '효과음 9번째 판')).toBe(false)
		m.mock.supportsPages = false
		expect(await conn.send(Commands.padPageNext(), '효과음 다음 판')).toBe(false)
		expect(host.logs.some((l) => l.includes('효과음 판은 큐플레이어 맥 1.1.53'))).toBe(true)
	})

	it('play/pause toggle on an empty player sends go (plays the cued song)', async () => {
		const { m, host, conn } = await setup()
		await until(() => host.link === 'ok')
		m.mock.cued = m.mock.playlists[1].tracks[0]
		m.mock.cued.playlist = m.mock.playlists[1]
		await until(() => host.vars.cued_title === '수상자 등장')
		await conn.togglePlayPause()
		const last = m.mock.requests.filter((r: { method: string }) => r.method === 'POST').at(-1)
		expect(last.path).toBe('/api/v1/transport/go')
		expect(host.vars.state).toBe('playing')
	})

	it('never runs two status polls at once', async () => {
		const { m, host } = await setup({ pollMs: 1 })
		m.mock.delayMs = 50
		await until(() => host.link === 'ok')
		await new Promise((r) => setTimeout(r, 400))
		expect(m.mock.maxStatusInFlight).toBe(1)
	})

	it('wrong token → authentication failure, everything unknown', async () => {
		const { host, conn } = await setup({ serverToken: 'right', token: 'wrong' })
		await until(() => host.link === 'auth_failure')
		expect(host.links.at(-1)?.message).toBe('토큰이 없거나 틀려요')
		expect(conn.status).toBeNull()
		expect(host.vars.state).toBe('disconnected')
	})

	it('the right token connects', async () => {
		const { host } = await setup({ serverToken: 'right', token: 'right' })
		await until(() => host.link === 'ok')
	})

	it('losing the app turns feedbacks to unknown (not the last green) and reconnects', async () => {
		const { m, host, conn } = await setup()
		await until(() => host.link === 'ok')
		await conn.send(Commands.go('p1a2b3c4d5e6f', 't000000000002'), '재생')
		await conn.send(Commands.background(true), '배경')
		expect(Checks.playing(conn.status)).toBe(true)
		expect(Checks.background(conn.status)).toBe(true)

		const port = m.port
		await m.close()
		await until(() => host.link === 'connection_failure')
		expect(conn.status).toBeNull()
		expect(Checks.playing(conn.status)).toBe(false)
		expect(Checks.background(conn.status)).toBe(false)
		expect(Checks.disconnected(conn.status)).toBe(true)
		expect(host.vars).toMatchObject({ state: 'disconnected', remaining: '--:--', current_title: '' })
		expect(host.vars.pad_1_name).toBe('박수')
		expect(host.checks.at(-1)).toContain('state')

		const again = await startMockCuePlayer({ port })
		cleanups.push(again.close)
		await until(() => host.link === 'ok', 5000)
		expect(host.vars.state).toBe('stopped')
	})

	it('previous song = the one ⏮ goes to: before the current one in its list, missing files skipped', async () => {
		const { m, host, conn } = await setup()
		const entrance = m.mock.playlists[0]
		entrance.tracks = [
			{ id: 'ta', title: 'A 오프닝', duration: 100 },
			{ id: 'tb', title: 'B 신랑 입장', duration: 100 },
			{ id: 'tm', title: '없는 파일', duration: 100, missing: true },
			{ id: 'tc', title: 'C 신부 입장', duration: 100 },
			{ id: 'td', title: 'D 축가', duration: 100 },
		]
		await until(() => host.link === 'ok' && conn.library !== undefined)
		expect(host.vars.previous_title).toBe('')

		// middle of the list (the missing file before it is skipped, as CuePlayer's queue skips it)
		await conn.send(Commands.go(entrance.id, 'tc'), '재생')
		expect(host.vars.current_title).toBe('C 신부 입장')
		expect(host.vars.previous_title).toBe('B 신랑 입장')
		expect(host.vars.previous_playlist).toBe('입장')

		// first song: nothing before it
		await conn.send(Commands.go(entrance.id, 'ta'), '재생')
		expect(host.vars.previous_title).toBe('')
		expect(host.vars.previous_playlist).toBe('')

		// next / previous move it along
		await conn.send(Commands.next(), '다음 곡')
		expect(host.vars.current_title).toBe('B 신랑 입장')
		expect(host.vars.previous_title).toBe('A 오프닝')
		await conn.send(Commands.next(), '다음 곡')
		expect(host.vars.current_title).toBe('C 신부 입장')
		expect(host.vars.previous_title).toBe('B 신랑 입장')
		await conn.send(Commands.next(), '다음 곡')
		expect(host.vars.previous_title).toBe('C 신부 입장')
		await conn.send(Commands.previous(), '이전 곡')
		expect(host.vars.current_title).toBe('C 신부 입장')
		expect(host.vars.previous_title).toBe('B 신랑 입장')
		await conn.send(Commands.previous(), '이전 곡')
		expect(host.vars.previous_title).toBe('A 오프닝')

		// another playlist: the same song (t…01) is 1st in 입장 but 2nd in 시상식 — the current list decides
		const awards = m.mock.playlists[1]
		await conn.send(Commands.go(awards.id, 't000000000001'), '재생')
		expect(host.vars.current_playlist).toBe('시상식')
		expect(host.vars.previous_title).toBe('수상자 등장')
		expect(host.vars.previous_playlist).toBe('시상식')

		// the list is edited in the app: the next song change re-reads it
		awards.tracks.splice(1, 0, { id: 'tnew', title: '새로 넣은 곡', duration: 30 })
		await conn.send(Commands.go(awards.id, 'tnew'), '재생')
		await until(() => host.vars.previous_title === '수상자 등장')
		await conn.send(Commands.next(), '다음 곡')
		expect(host.vars.current_title).toBe('오프닝 팡파르')
		expect(host.vars.previous_title).toBe('새로 넣은 곡')

		// connection lost → empty
		await m.close()
		await until(() => host.link === 'connection_failure')
		expect(host.vars.previous_title).toBe('')
	})

	it('reloads the library when the app restarts (new instanceId)', async () => {
		const { m, host } = await setup()
		await until(() => host.libraries.length === 1)
		m.mock.playlists.push({
			id: 'pnewlist00001',
			name: '새 목록',
			user: true,
			tracks: [{ id: 'tnew', title: '새 곡', duration: 10 }],
		})
		m.mock.instanceId = 'restarted'
		await until(() => host.libraries.length === 2)
		expect(host.libraries[1].playlists.map((p) => p.name)).toContain('새 목록')
	})
})
