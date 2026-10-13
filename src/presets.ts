import type {
	CompanionButtonStyleProps,
	CompanionPresetDefinitions,
	CompanionPresetSection,
} from '@companion-module/base'
import type { ModuleSchema } from './main.js'
import { Colors } from './feedbacks.js'

type Presets = CompanionPresetDefinitions<ModuleSchema>
type Preset = NonNullable<Presets[string]> & { type: 'simple' }
type Feedbacks = Preset['feedbacks']
type ActionEntry = Preset['steps'][number]['down'][number]

/** Companion swaps "cueplayer" for the real connection label when a preset is placed */
const V = (name: string): string => `$(cueplayer:${name})`

function style(text: string, over: Partial<CompanionButtonStyleProps> = {}): CompanionButtonStyleProps {
	return { text, size: 'auto', color: Colors.white, bgcolor: Colors.black, show_topbar: false, ...over }
}

/** Grey, whatever else is lit — added last so it wins: never a stale green when the link is down */
const offline = (text?: string): Feedbacks[number] => ({
	feedbackId: 'disconnected',
	options: {},
	style: { bgcolor: Colors.grey, color: Colors.greyText, ...(text ? { text } : {}) },
})

function key(
	name: string,
	text: string,
	actions: ActionEntry[],
	feedbacks: Feedbacks = [],
	over: Partial<CompanionButtonStyleProps> = {},
): Preset {
	return {
		type: 'simple',
		name,
		style: style(text, over),
		steps: [{ down: actions, up: [] }],
		feedbacks: [...feedbacks, offline()],
	}
}

export function presetDefinitions(): { structure: CompanionPresetSection<ModuleSchema>[]; presets: Presets } {
	const p: Presets = {}

	p.play_pause = {
		type: 'simple',
		name: '재생/일시정지 (남은 시간)',
		keywords: ['play', 'pause', 'remaining', '재생'],
		style: style(`${V('state_label')}\n${V('remaining')}`),
		previewStyle: { text: '재생/일시정지\n1:23' },
		steps: [{ down: [{ actionId: 'play_pause', options: {} }], up: [] }],
		feedbacks: [
			{ feedbackId: 'playing', options: {}, style: { bgcolor: Colors.green, color: Colors.white } },
			{
				feedbackId: 'remaining_below',
				options: { seconds: 30 },
				style: { bgcolor: Colors.orange, color: Colors.white },
			},
			{ feedbackId: 'remaining_below', options: { seconds: 10 }, style: { bgcolor: Colors.red, color: Colors.white } },
			{ feedbackId: 'paused', options: {}, style: { bgcolor: Colors.amber, color: Colors.black } },
			{ feedbackId: 'fading', options: {}, style: { bgcolor: Colors.purple, color: Colors.white } },
			offline('연결\n끊김'),
		],
	}
	p.fadeout = key(
		'페이드아웃',
		'페이드\n아웃',
		[{ actionId: 'fadeout', options: {} }],
		[{ feedbackId: 'fading', options: {}, style: { bgcolor: Colors.purple, color: Colors.white } }],
	)
	p.next = key('다음 곡 (다음 곡 제목)', `다음\n${V('next_title')}`, [{ actionId: 'next', options: {} }], [], {
		size: '14',
	})
	p.stop = key('멈춤', '멈춤', [{ actionId: 'stop', options: {} }])
	p.restart = key('처음부터', '처음\n부터', [{ actionId: 'restart', options: {} }])
	p.background = key(
		'배경으로 줄이기 (켜고 끄기)',
		'배경',
		[{ actionId: 'background', options: { mode: 'toggle' } }],
		[{ feedbackId: 'background', options: {}, style: { bgcolor: Colors.blue, color: Colors.white } }],
	)
	p.stop_after = key(
		'끝나면 멈춤 (켜고 끄기)',
		'끝나면\n멈춤',
		[{ actionId: 'stop_after', options: { mode: 'toggle' } }],
		[{ feedbackId: 'stop_after', options: {}, style: { bgcolor: Colors.teal, color: Colors.white } }],
	)
	for (let n = 1; n <= 9; n++) {
		p[`pad_${n}`] = {
			...key(
				`효과음 ${n}`,
				`${n}\n${V(`pad_${n}_name`)}`,
				[{ actionId: 'pad_trigger', options: { slot: n } }],
				[{ feedbackId: 'pad_playing', options: { slot: n }, style: { bgcolor: Colors.orange, color: Colors.white } }],
			),
			previewStyle: { text: `효과음\n${n}` },
			keywords: ['pad', 'sfx', 'jingle', '효과음'],
		}
	}

	// extras
	p.previous = key('이전 곡', '이전', [{ actionId: 'previous', options: {} }])
	p.pause = key(
		'일시정지',
		'일시\n정지',
		[{ actionId: 'pause', options: {} }],
		[{ feedbackId: 'paused', options: {}, style: { bgcolor: Colors.amber, color: Colors.black } }],
	)
	p.resume = key(
		'이어서 재생',
		'재생',
		[{ actionId: 'resume', options: {} }],
		[{ feedbackId: 'playing', options: {}, style: { bgcolor: Colors.green, color: Colors.white } }],
	)
	p.go_selected = key(
		'고른 곡 처음부터 재생 (Go)',
		'GO',
		[{ actionId: 'go', options: { track: '', playlistId: '', trackId: '' } }],
		[{ feedbackId: 'playing', options: {}, style: { bgcolor: Colors.green, color: Colors.white } }],
	)
	p.skip_back = key('10초 뒤로', '-10초', [{ actionId: 'skip', options: { by: -10 } }])
	p.skip_fwd = key('10초 앞으로', '+10초', [{ actionId: 'skip', options: { by: 10 } }])
	p.pads_stop = key('효과음 전부 멈춤', '효과음\n전부 멈춤', [{ actionId: 'pads_stop', options: {} }])
	p.now_playing = {
		type: 'simple',
		name: '지금 곡 (제목·남은 시간, 누르지 않는 표시용)',
		style: style(`${V('current_title')}\n${V('remaining')}`, { size: '14' }),
		previewStyle: { text: '지금 곡\n1:23' },
		steps: [],
		feedbacks: [
			{ feedbackId: 'playing', options: {}, style: { bgcolor: Colors.green, color: Colors.white } },
			{ feedbackId: 'remaining_below', options: { seconds: 10 }, style: { bgcolor: Colors.red, color: Colors.white } },
			offline('연결\n끊김'),
		],
	}
	p.announcing = key(
		'방송 중 표시',
		'방송',
		[],
		[{ feedbackId: 'announcing', options: {}, style: { bgcolor: Colors.red, color: Colors.white } }],
	)
	p.output_problem = key(
		'출력 장치 문제 표시',
		'출력',
		[],
		[
			{
				feedbackId: 'output_problem',
				options: {},
				style: { bgcolor: Colors.red, color: Colors.white, text: '출력\n문제' },
			},
		],
	)
	p.link = {
		type: 'simple',
		name: '연결 상태',
		style: style('큐플레이어'),
		steps: [],
		feedbacks: [
			{ feedbackId: 'connected', options: {}, style: { bgcolor: Colors.green, color: Colors.white } },
			offline('큐플레이어\n연결 끊김'),
		],
	}

	const structure: CompanionPresetSection<ModuleSchema>[] = [
		{
			id: 'page15',
			name: '스트림덱 15키 한 장 · 15-key page',
			description:
				'5×3 그대로 놓으면 돼요. 1줄 재생/일시정지·페이드아웃·다음·멈춤·처음부터, 2줄 배경·끝나면 멈춤·효과음 1~3, 3줄 효과음 4~8. 효과음 9번은 아래 "효과음" 묶음에 있어요 (16개라 한 장에 다 안 들어가요).',
			definitions: [
				{ id: 'row1', type: 'simple', name: '1줄 · 곡', presets: ['play_pause', 'fadeout', 'next', 'stop', 'restart'] },
				{
					id: 'row2',
					type: 'simple',
					name: '2줄 · 배경 · 효과음',
					presets: ['background', 'stop_after', 'pad_1', 'pad_2', 'pad_3'],
				},
				{ id: 'row3', type: 'simple', name: '3줄 · 효과음', presets: ['pad_4', 'pad_5', 'pad_6', 'pad_7', 'pad_8'] },
			],
		},
		{
			id: 'pads',
			name: '효과음 · Pads',
			definitions: [
				{
					id: 'pads_all',
					type: 'simple',
					name: '효과음 1~9 · 전부 멈춤',
					presets: ['pad_1', 'pad_2', 'pad_3', 'pad_4', 'pad_5', 'pad_6', 'pad_7', 'pad_8', 'pad_9', 'pads_stop'],
				},
			],
		},
		{
			id: 'more',
			name: '더 보기 · More',
			definitions: [
				{
					id: 'transport',
					type: 'simple',
					name: '곡 조작',
					presets: ['go_selected', 'pause', 'resume', 'previous', 'skip_back', 'skip_fwd'],
				},
				{
					id: 'display',
					type: 'simple',
					name: '표시',
					presets: ['now_playing', 'announcing', 'output_problem', 'link'],
				},
			],
		},
	]
	return { structure, presets: p }
}
