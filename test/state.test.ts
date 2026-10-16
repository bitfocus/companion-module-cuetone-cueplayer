import { describe, expect, it } from 'vitest'
import { previousTrack, type Library } from '../src/library.js'
import { Checks, formatTime, statusToVariables, toggleCommand } from '../src/state.js'
import type { CuePlayerStatus } from '../src/types.js'

const pads = (playing: number[] = []) =>
	['박수', '팡파르', '', '', '', '', '', '', '웃음'].map((name, i) => ({
		slot: i + 1,
		name,
		empty: name === '',
		playing: playing.includes(i + 1),
	}))

const playing: CuePlayerStatus = {
	apiVersion: 1,
	instanceId: 'x',
	revision: 7,
	state: 'playing',
	current: { id: 't1', title: '신랑 입장', duration: 182, playlistId: 'p1', playlist: '입장' },
	cued: null,
	next: { id: 't2', title: '축가' },
	position: 61.4,
	remaining: 120.6,
	background: true,
	stopAfter: false,
	locked: false,
	pads: pads([2]),
	announcing: false,
	output: { name: 'Built-in', problem: null },
}

describe('formatTime', () => {
	it('formats m:ss and h:mm:ss', () => {
		expect(formatTime(0)).toBe('0:00')
		expect(formatTime(61.9)).toBe('1:01')
		expect(formatTime(3725)).toBe('1:02:05')
		expect(formatTime(undefined)).toBe('--:--')
		expect(formatTime(NaN)).toBe('--:--')
	})
	it('counts down with ceil so 0:00 means over', () => {
		expect(formatTime(9.2, 'ceil')).toBe('0:10')
		expect(formatTime(0.05, 'ceil')).toBe('0:01')
		expect(formatTime(0, 'ceil')).toBe('0:00')
		expect(formatTime(120, 'ceil')).toBe('2:00')
	})
})

describe('status → variables', () => {
	it('maps a playing status', () => {
		const v = statusToVariables(playing)
		expect(v).toMatchObject({
			state: 'playing',
			state_label: '재생 중',
			current_title: '신랑 입장',
			current_playlist: '입장',
			remaining: '2:01',
			remaining_seconds: 121,
			elapsed: '1:01',
			next_title: '축가',
			cued_title: '',
			pad_1_name: '박수',
			pad_2_name: '팡파르',
			pad_3_name: '',
			pad_9_name: '웃음',
		})
	})

	it('crossfade: shows the ending song until it is over (3·2·1)', () => {
		const v = statusToVariables({
			...playing,
			current: { id: 't2', title: '축가', duration: 200 },
			remaining: 198,
			ending: { id: 't1', title: '신랑 입장', remaining: 2.3 },
		})
		expect(v.current_title).toBe('신랑 입장')
		expect(v.remaining).toBe('0:03')
		expect(v.remaining_seconds).toBe(3)
		expect(Checks.remainingBelow({ ...playing, ending: { title: '신랑 입장', remaining: 2.3 } }, 5)).toBe(true)
		const after = statusToVariables({
			...playing,
			current: { id: 't2', title: '축가', duration: 200 },
			remaining: 198,
			ending: null,
		})
		expect(after.current_title).toBe('축가')
	})

	it('stopped with a cued song', () => {
		const v = statusToVariables({
			...playing,
			state: 'stopped',
			current: null,
			next: null,
			cued: { id: 't3', title: '오프닝' },
			remaining: 0,
			position: 0,
		})
		expect(v).toMatchObject({ state: 'stopped', state_label: '멈춤', current_title: '', remaining: '0:00' })
		expect(v.remaining_seconds).toBe(0)
		expect(v.cued_title).toBe('오프닝')
	})

	it('disconnected → unknown values, but pad names stay', () => {
		const before = statusToVariables(playing)
		const v = statusToVariables(null, before)
		expect(v).toMatchObject({
			state: 'disconnected',
			state_label: '연결 끊김',
			current_title: '',
			remaining: '--:--',
			remaining_seconds: '',
			elapsed: '--:--',
			next_title: '',
			pad_1_name: '박수',
		})
	})
})

describe('feedback checks', () => {
	it('reflect the status', () => {
		expect(Checks.playing(playing)).toBe(true)
		expect(Checks.paused(playing)).toBe(false)
		expect(Checks.background(playing)).toBe(true)
		expect(Checks.stopAfter(playing)).toBe(false)
		expect(Checks.padPlaying(playing, 2)).toBe(true)
		expect(Checks.padPlaying(playing, 1)).toBe(false)
		expect(Checks.connected(playing)).toBe(true)
		expect(Checks.outputProblem(playing)).toBe(false)
		expect(Checks.outputProblem({ ...playing, output: { name: 'x', problem: '장치가 빠졌어요' } })).toBe(true)
		expect(Checks.announcing({ ...playing, announcing: true })).toBe(true)
		expect(Checks.fading({ ...playing, state: 'fading' })).toBe(true)
	})

	it('remaining < N only while sound runs', () => {
		const end = { ...playing, remaining: 8.5 }
		expect(Checks.remainingBelow(end, 10)).toBe(true)
		expect(Checks.remainingBelow(end, 8)).toBe(false)
		expect(Checks.remainingBelow({ ...end, state: 'fading' }, 10)).toBe(true)
		expect(Checks.remainingBelow({ ...end, state: 'paused' }, 10)).toBe(false)
		expect(Checks.remainingBelow({ ...end, current: null }, 10)).toBe(false)
	})

	it('everything is off while disconnected (never a stale green)', () => {
		for (const [name, check] of Object.entries(Checks)) {
			if (name === 'disconnected') continue
			expect((check as (s: null, n: number) => boolean)(null, 1), name).toBe(false)
		}
		expect(Checks.disconnected(null)).toBe(true)
	})
})

describe('play/pause toggle', () => {
	it('pause if playing or fading, else resume, go when nothing is loaded', () => {
		expect(toggleCommand(playing)).toBe('pause')
		expect(toggleCommand({ ...playing, state: 'fading' })).toBe('pause')
		expect(toggleCommand({ ...playing, state: 'paused' })).toBe('resume')
		expect(toggleCommand({ ...playing, state: 'stopped', current: null })).toBe('go')
		expect(toggleCommand(null)).toBe('resume')
	})
})

describe('previous song (⏮)', () => {
	const lib: Library = {
		playlists: [
			{
				id: 'p1',
				name: '입장',
				tracks: [
					{ id: 't0', title: '오프닝' },
					{ id: 'tx', title: '없는 파일', missing: true },
					{ id: 't1', title: '신랑 입장' },
					{ id: 't2', title: '축가' },
				],
			},
			{
				id: 'p2',
				name: '시상식',
				tracks: [
					{ id: 't9', title: '수상자 등장' },
					{ id: 't1', title: '신랑 입장' },
				],
			},
		],
	}
	const at = (id: string, playlistId = 'p1'): CuePlayerStatus => ({
		...playing,
		current: { id, title: id, playlistId, playlist: playlistId },
	})

	it('middle of the list → the song before, skipping missing files', () => {
		expect(previousTrack(at('t2'), lib)?.track.title).toBe('신랑 입장')
		expect(previousTrack(at('t1'), lib)?.track.title).toBe('오프닝')
		expect(previousTrack(at('t1'), lib)?.playlist.name).toBe('입장')
	})

	it('first song, nothing loaded, unknown list or song → none', () => {
		expect(previousTrack(at('t0'), lib)).toBeNull()
		expect(previousTrack({ ...playing, current: null }, lib)).toBeNull()
		expect(previousTrack(null, lib)).toBeNull()
		expect(previousTrack(at('t1'), undefined)).toBeNull()
		expect(previousTrack(at('t1', 'gone'), lib)).toBeNull()
		expect(previousTrack(at('nope'), lib)).toBeNull()
		expect(previousTrack({ ...playing, current: { id: 't1', title: '신랑 입장' } }, lib)).toBeNull()
	})

	it('the current playlist decides (one song in two lists)', () => {
		expect(previousTrack(at('t1', 'p2'), lib)?.track.title).toBe('수상자 등장')
	})

	it('fills previous_title / previous_playlist, empty when disconnected', () => {
		const v = statusToVariables(at('t2'), undefined, lib)
		expect(v.previous_title).toBe('신랑 입장')
		expect(v.previous_playlist).toBe('입장')
		expect(statusToVariables(at('t0'), undefined, lib)).toMatchObject({ previous_title: '', previous_playlist: '' })
		expect(statusToVariables(at('t2'))).toMatchObject({ previous_title: '', previous_playlist: '' })
		expect(statusToVariables(null, v, lib)).toMatchObject({ previous_title: '', previous_playlist: '' })
	})
})
