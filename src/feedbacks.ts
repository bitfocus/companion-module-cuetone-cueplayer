import type { CompanionFeedbackDefinitions } from '@companion-module/base'
import { PAD_CHOICES } from './actions.js'
import { Checks } from './state.js'
import type { CuePlayerStatus } from './types.js'
import type { FeedbackGroup } from './connection.js'

type NoOptions = Record<string, never>
type Bool<T> = { type: 'boolean'; options: T }

export type FeedbacksSchema = {
	playing: Bool<NoOptions>
	paused: Bool<NoOptions>
	fading: Bool<NoOptions>
	stopped: Bool<NoOptions>
	background: Bool<NoOptions>
	stop_after: Bool<NoOptions>
	repeat_one: Bool<NoOptions>
	pad_playing: Bool<{ slot: number }>
	announcing: Bool<NoOptions>
	remaining_below: Bool<{ seconds: number }>
	connected: Bool<NoOptions>
	disconnected: Bool<NoOptions>
	output_problem: Bool<NoOptions>
}

export type FeedbackId = keyof FeedbacksSchema

/** Which feedbacks to re-check for each kind of change */
export const FEEDBACK_GROUPS: Record<FeedbackGroup, FeedbackId[]> = {
	state: [
		'playing',
		'paused',
		'fading',
		'stopped',
		'background',
		'stop_after',
		'repeat_one',
		'pad_playing',
		'announcing',
		'connected',
		'disconnected',
		'output_problem',
		'remaining_below',
	],
	time: ['remaining_below'],
}

export const Colors = {
	white: 0xffffff,
	black: 0x000000,
	green: 0x1f9d55,
	amber: 0xd99a00,
	orange: 0xe8590c,
	red: 0xc92a2a,
	purple: 0x7048e8,
	blue: 0x1971c2,
	teal: 0x0c8599,
	grey: 0x2b2b2b,
	greyText: 0x8a8a8a,
	/** 큐톤 보라 (Cue Remote 앱의 켜짐 색) */
	brand: 0x6747ee,
	/** 아이콘 버튼 바탕 (앱 단추와 같은 짙은 회색) */
	key: 0x1c1c1f,
} as const

export function feedbackDefinitions(
	status: () => CuePlayerStatus | null,
): CompanionFeedbackDefinitions<FeedbacksSchema> {
	const simple = (
		name: string,
		description: string,
		check: (s: CuePlayerStatus | null) => boolean,
		bgcolor: number,
		color: number = Colors.white,
	) => ({
		type: 'boolean' as const,
		name,
		description,
		defaultStyle: { bgcolor, color },
		options: [],
		callback: () => check(status()),
	})
	return {
		playing: simple('재생 중 · Playing', '곡이 재생 중일 때', Checks.playing, Colors.green),
		paused: simple(
			'일시정지 · Paused',
			'곡이 일시정지 상태일 때 (멈춤 뒤 처음 자리 포함)',
			Checks.paused,
			Colors.amber,
			Colors.black,
		),
		fading: simple('페이드 중 · Fading', '페이드아웃 중일 때', Checks.fading, Colors.purple),
		stopped: simple('멈춤 (곡 없음) · Stopped', '올라온 곡이 없을 때', Checks.stopped, Colors.grey),
		background: simple(
			'보이스오버 켜짐 · Voice-over on',
			'보이스오버가 켜져 있을 때 (음악을 작게 깔아 둠)',
			Checks.background,
			Colors.blue,
		),
		stop_after: simple(
			'끝나면 정지 켜짐 · Stop-after on',
			'지금 곡이 끝나면 정지가 켜져 있을 때',
			Checks.stopAfter,
			Colors.teal,
		),
		repeat_one: simple('한 곡 반복 켜짐 · Repeat one on', '지금 곡을 반복하고 있을 때', Checks.repeatOne, Colors.teal),
		announcing: simple('방송 중 · Announcing', 'TTS 방송이 나가는 중일 때', Checks.announcing, Colors.red),
		connected: simple('연결됨 · Connected', '큐플레이어와 연결돼 있을 때', Checks.connected, Colors.green),
		disconnected: simple(
			'연결 끊김 · Disconnected',
			'큐플레이어와 연결이 끊겼을 때 (버튼을 회색으로)',
			Checks.disconnected,
			Colors.grey,
			Colors.greyText,
		),
		output_problem: simple(
			'출력 장치 문제 · Output problem',
			'앱이 출력 장치 문제를 알릴 때',
			Checks.outputProblem,
			Colors.red,
		),
		pad_playing: {
			type: 'boolean',
			name: '효과음 울리는 중 · Pad playing',
			description: '고른 칸의 효과음이 울리는 중일 때',
			defaultStyle: { bgcolor: Colors.orange, color: Colors.white },
			options: [{ id: 'slot', type: 'dropdown', label: '칸', choices: PAD_CHOICES, default: 1 }],
			callback: (fb) => Checks.padPlaying(status(), Number(fb.options.slot)),
		},
		remaining_below: {
			type: 'boolean',
			name: '끝나기 N초 전 · Remaining below',
			description: '재생·페이드 중이고 남은 시간이 N초보다 적을 때',
			defaultStyle: { bgcolor: Colors.red, color: Colors.white },
			options: [{ id: 'seconds', type: 'number', label: '초', default: 10, min: 1, max: 3600, step: 1 }],
			callback: (fb) => Checks.remainingBelow(status(), Number(fb.options.seconds)),
		},
	}
}
