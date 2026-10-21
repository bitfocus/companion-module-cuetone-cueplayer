import type { CompanionActionDefinitions, DropdownChoice } from '@companion-module/base'
import { Commands, type ApiRequest } from './api.js'
import { TRACK_CUSTOM, TRACK_SELECTED, decodeTrackChoice, trackChoices, type Library } from './library.js'
import type { CuePlayerStatus } from './types.js'

type NoOptions = Record<string, never>
export type OnOffToggle = 'on' | 'off' | 'toggle'

export type ActionsSchema = {
	go: { options: { track: string; playlistId: string; trackId: string } }
	play_pause: { options: NoOptions }
	pause: { options: NoOptions }
	resume: { options: NoOptions }
	stop: { options: NoOptions }
	restart: { options: NoOptions }
	fadeout: { options: NoOptions }
	next: { options: NoOptions }
	previous: { options: NoOptions }
	seek: { options: { position: number } }
	skip: { options: { by: number } }
	background: { options: { mode: OnOffToggle } }
	stop_after: { options: { mode: OnOffToggle } }
	repeat_one: { options: { mode: OnOffToggle } }
	pad_trigger: { options: { slot: number } }
	pad_stop: { options: { slot: number } }
	pads_stop: { options: NoOptions }
}

/** What the action callbacks need from the module */
export interface ActionHost {
	library(): Library | undefined
	status(): CuePlayerStatus | null
	send(req: ApiRequest, label: string): Promise<boolean>
	togglePlayPause(): Promise<boolean>
	log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void
}

const MODE_CHOICES: DropdownChoice<OnOffToggle>[] = [
	{ id: 'toggle', label: '켜기/끄기 바꾸기 (toggle)' },
	{ id: 'on', label: '켜기 (on)' },
	{ id: 'off', label: '끄기 (off)' },
]

export const PAD_CHOICES: DropdownChoice<number>[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({
	id: n,
	label: `${n}번 칸`,
}))

/** on/off/toggle → the value to PUT, or undefined when toggling without a known state */
export function resolveMode(mode: OnOffToggle, current: boolean | undefined): boolean | undefined {
	if (mode === 'on') return true
	if (mode === 'off') return false
	return current === undefined ? undefined : !current
}

/** The go request for the chosen dropdown entry / custom ids */
export function goRequest(options: { track?: string; playlistId?: string; trackId?: string }): ApiRequest {
	const track = String(options.track ?? '')
	if (track === TRACK_CUSTOM) {
		return Commands.go(
			String(options.playlistId ?? '').trim() || undefined,
			String(options.trackId ?? '').trim() || undefined,
		)
	}
	const { playlistId, trackId } = decodeTrackChoice(track)
	return Commands.go(playlistId, trackId)
}

export function actionDefinitions(host: ActionHost): CompanionActionDefinitions<ActionsSchema> {
	const simple = (name: string, description: string, req: () => ApiRequest) => ({
		name,
		description,
		options: [],
		callback: async () => {
			await host.send(req(), name)
		},
	})
	const onOff = (
		name: string,
		read: (s: CuePlayerStatus) => boolean | undefined,
		build: (on: boolean) => ApiRequest,
	): CompanionActionDefinitions<ActionsSchema>['background'] => ({
		name,
		options: [{ id: 'mode', type: 'dropdown', label: '동작', choices: MODE_CHOICES, default: 'toggle' }],
		callback: async (event) => {
			const s = host.status()
			const value = resolveMode(event.options.mode, s ? read(s) : undefined)
			if (value === undefined) {
				host.log('warn', `${name}: 큐플레이어 상태를 몰라서 바꾸지 못했어요`)
				return
			}
			await host.send(build(value), name)
		},
	})

	return {
		go: {
			name: '곡 재생 (처음부터) · Go',
			description: '고른 곡을 처음부터 재생해요. "앱에서 고른 곡"이면 앱에서 선택하거나 올려 둔 곡.',
			options: [
				{
					id: 'track',
					type: 'dropdown',
					label: '곡',
					choices: trackChoices(host.library()),
					default: TRACK_SELECTED,
					minChoicesForSearch: 0,
					allowCustom: true,
				},
				{
					id: 'playlistId',
					type: 'textinput',
					label: '목록 ID (비우면 아무 목록)',
					default: '',
					useVariables: true,
					isVisibleExpression: `$(options:track) == '${TRACK_CUSTOM}'`,
				},
				{
					id: 'trackId',
					type: 'textinput',
					label: '곡 ID',
					default: '',
					useVariables: true,
					isVisibleExpression: `$(options:track) == '${TRACK_CUSTOM}'`,
				},
			],
			callback: async (event) => {
				await host.send(goRequest(event.options), '곡 재생')
			},
		},
		play_pause: {
			name: '재생/일시정지 · Play/Pause toggle',
			description: '재생 중이면 일시정지, 아니면 이어서 재생 (곡이 없으면 고른 곡 재생)',
			options: [],
			callback: async () => {
				await host.togglePlayPause()
			},
		},
		pause: simple('일시정지 · Pause', '이미 멈춰 있으면 그대로', Commands.pause),
		resume: simple('이어서 재생 · Resume', '이미 재생 중이면 그대로', Commands.resume),
		stop: simple(
			'즉시 정지 · Stop',
			'바로 멈추고 그 곡 처음 자리에 대기 (페이드 정지와 같은 결과, CuePlayer 1.1.22~)',
			Commands.stop,
		),
		restart: simple('처음부터 · Restart', '지금 곡을 처음부터', Commands.restart),
		fadeout: simple(
			'페이드 정지 · Fade out',
			'설정한 시간 동안 줄이고 멈춘 뒤 그 곡 처음 자리에 대기 (다시 눌러도 취소 안 함)',
			Commands.fadeout,
		),
		next: simple('다음 곡 · Next', '앱 ⏭ 과 같음 (멈춰 있으면 올려 두기만)', Commands.next),
		previous: simple('이전 곡 · Previous', '앱 ⏮ 과 같음 (멈춰 있으면 올려 두기만)', Commands.previous),
		seek: {
			name: '위치로 이동 · Seek',
			options: [{ id: 'position', type: 'number', label: '위치 (초)', default: 0, min: 0, max: 86400, step: 1 }],
			callback: async (event) => {
				await host.send(Commands.seek(Number(event.options.position) || 0), '위치 이동')
			},
		},
		skip: {
			name: '앞뒤로 건너뛰기 · Skip ±seconds',
			options: [{ id: 'by', type: 'number', label: '초 (뒤로는 음수)', default: 10, min: -3600, max: 3600, step: 1 }],
			callback: async (event) => {
				const by = Number(event.options.by)
				if (!by) return
				await host.send(Commands.skip(by), '건너뛰기')
			},
		},
		background: onOff('보이스오버 · Voice-over', (s) => s.background, Commands.background),
		stop_after: onOff('끝나면 정지 · Stop after current', (s) => s.stopAfter, Commands.stopAfter),
		repeat_one: onOff('한 곡 반복 · Repeat one', (s) => s.repeat, Commands.repeatOne),
		pad_trigger: {
			name: '효과음 울리기 · Pad trigger',
			options: [{ id: 'slot', type: 'dropdown', label: '칸', choices: PAD_CHOICES, default: 1 }],
			callback: async (event) => {
				await host.send(Commands.padTrigger(Number(event.options.slot)), `효과음 ${event.options.slot}`)
			},
		},
		pad_stop: {
			name: '효과음 멈춤 · Pad stop',
			options: [{ id: 'slot', type: 'dropdown', label: '칸', choices: PAD_CHOICES, default: 1 }],
			callback: async (event) => {
				await host.send(Commands.padStop(Number(event.options.slot)), `효과음 ${event.options.slot} 멈춤`)
			},
		},
		pads_stop: simple('효과음 전부 멈춤 · All pads stop', '울리는 효과음을 모두 멈춰요', Commands.padsStop),
	}
}
