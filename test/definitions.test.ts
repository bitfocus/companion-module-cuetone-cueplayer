import { describe, expect, it, vi } from 'vitest'
import { actionDefinitions, goRequest, resolveMode, type ActionHost } from '../src/actions.js'
import type { ApiRequest } from '../src/api.js'
import { feedbackDefinitions } from '../src/feedbacks.js'
import { decodeTrackChoice, encodeTrackChoice, playlistChoices, trackChoices, TRACK_CUSTOM } from '../src/library.js'
import { presetDefinitions } from '../src/presets.js'
import type { CuePlayerStatus } from '../src/types.js'
import { variableDefinitions } from '../src/variables.js'

const lib = {
	playlists: [
		{
			id: 'pA',
			name: '입장',
			tracks: [
				{ id: 't1', title: '팡파르' },
				{ id: 't2', title: '사라진 곡', missing: true },
			],
		},
		{ id: 'pB', name: '시상식', tracks: [{ id: 't1', title: '팡파르' }] },
	],
}

function fakeHost(status: CuePlayerStatus | null = null) {
	const sent: ApiRequest[] = []
	const host: ActionHost = {
		library: () => lib,
		status: () => status,
		send: vi.fn(async (req: ApiRequest) => {
			sent.push(req)
			return true
		}),
		togglePlayPause: vi.fn(async () => true),
		log: vi.fn(),
	}
	return { host, sent }
}

const run = async (defs: ReturnType<typeof actionDefinitions>, id: string, options: Record<string, unknown> = {}) => {
	const def = (defs as any)[id]
	await def.callback({ id: 'a', controlId: 'c', actionId: id, options, surfaceId: undefined }, {})
}

describe('track dropdown', () => {
	it('keeps the playlist with the track and skips missing files', () => {
		const choices = trackChoices(lib)
		expect(choices[0]).toEqual({ id: '', label: '앱에서 고른 곡 · 올려 둔 곡' })
		expect(choices.map((c) => c.id)).toEqual(['', TRACK_CUSTOM, 'pA:t1', 'pB:t1'])
		expect(choices[2].label).toBe('입장 › 팡파르')
		expect(playlistChoices(lib).map((c) => c.id)).toEqual(['', 'pA', 'pB'])
		expect(decodeTrackChoice(encodeTrackChoice('pB', 't1'))).toEqual({ playlistId: 'pB', trackId: 't1' })
		expect(decodeTrackChoice('t9')).toEqual({ trackId: 't9' })
		expect(decodeTrackChoice('')).toEqual({})
	})

	it('builds the go body from the dropdown or the custom ids', () => {
		expect(goRequest({ track: '' }).body).toEqual({})
		expect(goRequest({ track: 'pB:t1' }).body).toEqual({ playlistId: 'pB', trackId: 't1' })
		expect(goRequest({ track: TRACK_CUSTOM, playlistId: ' ', trackId: 't7' }).body).toEqual({ trackId: 't7' })
	})
})

describe('actions', () => {
	it('on/off/toggle', () => {
		expect(resolveMode('on', false)).toBe(true)
		expect(resolveMode('off', true)).toBe(false)
		expect(resolveMode('toggle', true)).toBe(false)
		expect(resolveMode('toggle', false)).toBe(true)
		expect(resolveMode('toggle', undefined)).toBeUndefined()
	})

	it('callbacks send the right requests', async () => {
		const status = { apiVersion: 1, state: 'playing', background: true, stopAfter: false } as CuePlayerStatus
		const { host, sent } = fakeHost(status)
		const defs = actionDefinitions(host)
		await run(defs, 'go', { track: 'pA:t1', playlistId: '', trackId: '' })
		await run(defs, 'fadeout')
		await run(defs, 'seek', { position: 42 })
		await run(defs, 'skip', { by: -10 })
		await run(defs, 'background', { mode: 'toggle' })
		await run(defs, 'stop_after', { mode: 'toggle' })
		await run(defs, 'pad_trigger', { slot: 4 })
		await run(defs, 'pad_stop', { slot: 4 })
		await run(defs, 'pads_stop')
		expect(sent.map((r) => `${r.method} ${r.path} ${JSON.stringify(r.body)}`)).toEqual([
			'POST /transport/go {"playlistId":"pA","trackId":"t1"}',
			'POST /transport/fadeout {}',
			'POST /transport/seek {"position":42}',
			'POST /transport/skip {"by":-10}',
			'PUT /background {"enabled":false}',
			'PUT /stop-after {"enabled":true}',
			'POST /pads/4/trigger {}',
			'POST /pads/4/stop {}',
			'POST /pads/stop {}',
		])
		await run(defs, 'play_pause')
		expect(host.togglePlayPause).toHaveBeenCalledOnce()
	})

	it('toggle without a known state does nothing and says why', async () => {
		const { host, sent } = fakeHost(null)
		await run(actionDefinitions(host), 'background', { mode: 'toggle' })
		expect(sent).toHaveLength(0)
		expect(host.log).toHaveBeenCalledWith('warn', expect.stringContaining('상태를 몰라서'))
	})

	it('has every API v1 command', () => {
		const ids = Object.keys(actionDefinitions(fakeHost().host))
		expect(ids.sort()).toEqual(
			[
				'go',
				'play_pause',
				'pause',
				'resume',
				'stop',
				'restart',
				'fadeout',
				'next',
				'previous',
				'seek',
				'skip',
				'background',
				'stop_after',
				'pad_trigger',
				'pad_stop',
				'pads_stop',
			].sort(),
		)
	})
})

describe('presets', () => {
	const { structure, presets } = presetDefinitions()
	const actions = actionDefinitions(fakeHost().host)
	const feedbacks = feedbackDefinitions(() => null)
	const variables = variableDefinitions()

	it('the 15-key page has exactly 15 keys in 3 rows of 5', () => {
		const page = structure.find((s) => s.id === 'page15')!
		const rows = page.definitions as { presets: string[] }[]
		expect(rows.map((r) => r.presets.length)).toEqual([5, 5, 5])
	})

	it('only uses existing actions, feedbacks, variables and presets', () => {
		for (const section of structure)
			for (const group of section.definitions as { presets: string[] }[])
				for (const id of group.presets) expect(presets[id], id).toBeDefined()

		for (const [id, preset] of Object.entries(presets)) {
			if (preset?.type !== 'simple') continue
			for (const step of preset.steps)
				for (const a of [...step.down, ...step.up])
					expect(actions, `${id} → ${(a as any).actionId}`).toHaveProperty((a as any).actionId)
			for (const f of preset.feedbacks)
				expect(feedbacks, `${id} → ${(f as any).feedbackId}`).toHaveProperty((f as any).feedbackId)
			// every key ends grey when disconnected
			expect((preset.feedbacks.at(-1) as any).feedbackId, id).toBe('disconnected')
			for (const m of preset.style.text.matchAll(/\$\(cueplayer:([a-z0-9_]+)\)/g))
				expect(variables, id).toHaveProperty(m[1])
		}
	})
})
