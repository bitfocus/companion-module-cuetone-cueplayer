// Drives the real module class through a fake Companion host context (what Companion's IPC layer would call).
import { afterEach, describe, expect, it } from 'vitest'
import { InstanceStatus } from '@companion-module/base'
import CuePlayerInstance from '../src/main.js'
import { startMockCuePlayer } from './mock-cueplayer.mjs'

function fakeContext() {
	const ctx = {
		_isInstanceContext: true as const,
		id: 'test-connection',
		label: 'cueplayer',
		upgradeScripts: [],
		statuses: [] as { status: string; message: string | null }[],
		variables: {} as Record<string, unknown>,
		variableDefs: {} as Record<string, unknown>,
		actions: {} as Record<string, any>,
		feedbacks: {} as Record<string, any>,
		presets: undefined as any,
		checked: [] as string[][],
		actionDefinitionCalls: 0,
		sharedUdpSocketHandlers: new Map(),
		saveConfig: () => {},
		updateStatus(status: string, message: string | null) {
			ctx.statuses.push({ status, message })
		},
		oscSend: () => {},
		recordAction: () => {},
		setActionDefinitions(a: Record<string, any>) {
			ctx.actions = a
			ctx.actionDefinitionCalls++
		},
		subscribeActions: () => {},
		unsubscribeActions: () => {},
		setFeedbackDefinitions(f: Record<string, any>) {
			ctx.feedbacks = f
		},
		unsubscribeFeedbacks: () => {},
		checkFeedbacks(types: string[]) {
			ctx.checked.push(types)
		},
		checkAllFeedbacks: () => {},
		checkFeedbacksById: () => {},
		setPresetDefinitions(structure: unknown, presets: unknown) {
			ctx.presets = { structure, presets }
		},
		setCompositeElementDefinitions: () => {},
		setVariableDefinitions(v: Record<string, unknown>) {
			ctx.variableDefs = v
		},
		setVariableValues(v: Record<string, unknown>) {
			Object.assign(ctx.variables, v)
		},
		getVariableValue: (id: string) => ctx.variables[id],
		sharedUdpSocketJoin: async () => '',
		sharedUdpSocketLeave: async () => {},
		sharedUdpSocketSend: async () => {},
	}
	return ctx
}

async function until(cond: () => boolean, ms = 3000) {
	const start = Date.now()
	while (!cond()) {
		if (Date.now() - start > ms) throw new Error('timed out')
		await new Promise((r) => setTimeout(r, 10))
	}
}

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
	while (cleanups.length) await cleanups.pop()!()
})

const fb = (ctx: ReturnType<typeof fakeContext>, id: string, options: Record<string, unknown> = {}) =>
	ctx.feedbacks[id].callback(
		{ id: 'f', controlId: 'c', feedbackId: id, options, type: 'boolean', previousOptions: null },
		{},
	)
const act = async (ctx: ReturnType<typeof fakeContext>, id: string, options: Record<string, unknown> = {}) =>
	ctx.actions[id].callback({ id: 'a', controlId: 'c', actionId: id, options, surfaceId: undefined }, {})

describe('module instance (fake Companion host)', () => {
	it('init → Ok, definitions, dropdowns, actions and feedbacks work end to end', async () => {
		const m = await startMockCuePlayer({ token: 'tok' })
		cleanups.push(m.close)
		const ctx = fakeContext()
		const inst = new CuePlayerInstance(ctx)
		cleanups.push(async () => inst.destroy())
		await inst.init({ host: '127.0.0.1', port: m.port, pollInterval: 50 }, true, { token: 'tok' })

		expect(ctx.statuses[0].status).toBe(InstanceStatus.Connecting)
		await until(() => ctx.statuses.at(-1)?.status === InstanceStatus.Ok)
		expect(Object.keys(ctx.variableDefs)).toContain('pad_9_name')
		expect(ctx.presets.structure.map((s: { id: string }) => s.id)).toEqual(['page15', 'pads', 'more'])

		// track dropdown filled from /playlists after connecting
		await until(() => ctx.actions.go.options[0].choices.length > 2)
		const labels = ctx.actions.go.options[0].choices.map((c: { label: string }) => c.label)
		expect(labels).toContain('입장 › 신랑 입장')
		expect(labels).not.toContain('입장 › 없는 파일')

		await act(ctx, 'go', { track: 'p1a2b3c4d5e6f:t000000000002', playlistId: '', trackId: '' })
		expect(ctx.variables.current_title).toBe('신랑 입장')
		expect(fb(ctx, 'playing')).toBe(true)
		expect(ctx.checked.flat()).toContain('playing')

		await act(ctx, 'play_pause')
		expect(fb(ctx, 'paused')).toBe(true)
		await act(ctx, 'background', { mode: 'toggle' })
		expect(fb(ctx, 'background')).toBe(true)
		await act(ctx, 'pad_trigger', { slot: 1 })
		expect(fb(ctx, 'pad_playing', { slot: 1 })).toBe(true)
		expect(fb(ctx, 'pad_playing', { slot: 2 })).toBe(false)

		const lastPost = m.mock.requests.filter((r: { method: string }) => r.method !== 'GET').at(-1)
		expect(lastPost.headers.authorization).toBe('Bearer tok')
		expect(typeof lastPost.body.requestId).toBe('string')

		// app goes away → ConnectionFailure, keys go grey
		await m.close()
		cleanups.pop()
		await until(() => ctx.statuses.at(-1)?.status === InstanceStatus.ConnectionFailure)
		expect(fb(ctx, 'background')).toBe(false)
		expect(fb(ctx, 'paused')).toBe(false)
		expect(fb(ctx, 'disconnected')).toBe(true)
		expect(ctx.variables.state_label).toBe('연결 끊김')
	})

	it('wrong token → AuthenticationFailure', async () => {
		const m = await startMockCuePlayer({ token: 'tok' })
		cleanups.push(m.close)
		const ctx = fakeContext()
		const inst = new CuePlayerInstance(ctx)
		cleanups.push(async () => inst.destroy())
		await inst.init({ host: '127.0.0.1', port: m.port, pollInterval: 50 }, true, { token: 'nope' })
		await until(() => ctx.statuses.at(-1)?.status === InstanceStatus.AuthenticationFailure)
		expect(ctx.statuses.at(-1)?.message).toBe('토큰이 없거나 틀려요')

		// fixing the token in the config reconnects
		await inst.configUpdated({ host: '127.0.0.1', port: m.port, pollInterval: 50 }, { token: 'tok' })
		await until(() => ctx.statuses.at(-1)?.status === InstanceStatus.Ok)
	})
})
