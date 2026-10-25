import type {
	CompanionButtonStyleProps,
	CompanionPresetDefinitions,
	CompanionPresetSection,
} from '@companion-module/base'
import type { ModuleSchema } from './main.js'
import { Colors } from './feedbacks.js'
import { Icons } from './icons.js'

type Presets = CompanionPresetDefinitions<ModuleSchema>
type Preset = NonNullable<Presets[string]> & { type: 'simple' }
type Feedbacks = Preset['feedbacks']
type ActionEntry = Preset['steps'][number]['down'][number]

/** Companion swaps "cueplayer" for the real connection label when a preset is placed */
const V = (name: string): string => `$(cueplayer:${name})`

function style(text: string, over: Partial<CompanionButtonStyleProps> = {}): CompanionButtonStyleProps {
	return { text, size: 'auto', color: Colors.white, bgcolor: Colors.black, show_topbar: false, ...over }
}

/** 아이콘 버튼: 위쪽 가운데 아이콘(72×72 PNG), 아래쪽 글자. 바탕은 앱 단추와 같은 짙은 회색 */
const icon = (png: string): Partial<CompanionButtonStyleProps> => ({
	png64: png,
	pngalignment: 'center:top',
	alignment: 'center:bottom',
	size: '14',
	bgcolor: Colors.key,
})

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
		style: style(V('remaining'), { ...icon(Icons.play), size: '18' }),
		previewStyle: { text: '1:23', ...icon(Icons.play), size: '18' },
		steps: [{ down: [{ actionId: 'play_pause', options: {} }], up: [] }],
		feedbacks: [
			{ feedbackId: 'playing', options: {}, style: { bgcolor: Colors.green, color: Colors.white, png64: Icons.pause } },
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
		'페이드 정지',
		'페이드',
		[{ actionId: 'fadeout', options: {} }],
		[{ feedbackId: 'fading', options: {}, style: { bgcolor: Colors.purple, color: Colors.white } }],
		icon(Icons.fade),
	)
	p.next = key('다음 곡 (다음 곡 제목)', V('next_title'), [{ actionId: 'next', options: {} }], [], icon(Icons.next))
	p.stop = key('즉시 정지', '즉시 정지', [{ actionId: 'stop', options: {} }], [], icon(Icons.stop))
	p.restart = key('처음부터', '처음부터', [{ actionId: 'restart', options: {} }], [], icon(Icons.restart))
	p.background = key(
		'보이스오버 (켜고 끄기)',
		'보이스오버',
		[{ actionId: 'background', options: { mode: 'toggle' } }],
		[{ feedbackId: 'background', options: {}, style: { bgcolor: Colors.brand, color: Colors.white } }],
		icon(Icons.voiceover),
	)
	p.stop_after = key(
		'끝나면 정지 (켜고 끄기)',
		'끝나면 정지',
		[{ actionId: 'stop_after', options: { mode: 'toggle' } }],
		[{ feedbackId: 'stop_after', options: {}, style: { bgcolor: Colors.brand, color: Colors.white } }],
		icon(Icons.stop_after),
	)
	p.repeat_one = key(
		'한 곡 반복 (켜고 끄기)',
		'한 곡 반복',
		[{ actionId: 'repeat_one', options: { mode: 'toggle' } }],
		[{ feedbackId: 'repeat_one', options: {}, style: { bgcolor: Colors.brand, color: Colors.white } }],
		icon(Icons.repeat_one),
	)
	for (let n = 1; n <= 10; n++) {
		p[`pad_${n}`] = {
			...key(
				`효과음 ${n}`,
				V(`pad_${n}_name`),
				[{ actionId: 'pad_trigger', options: { slot: n } }],
				[{ feedbackId: 'pad_playing', options: { slot: n }, style: { bgcolor: Colors.orange, color: Colors.white } }],
				icon(Icons[`pad${n}` as keyof typeof Icons]),
			),
			previewStyle: { text: `효과음 ${n}`, ...icon(Icons[`pad${n}` as keyof typeof Icons]) },
			keywords: ['pad', 'sfx', 'jingle', '효과음'],
		}
	}

	// extras
	p.previous = key(
		'이전 곡 (이전 곡 제목)',
		V('previous_title'),
		[{ actionId: 'previous', options: {} }],
		[],
		icon(Icons.previous),
	)
	p.pause = key(
		'일시정지',
		'일시정지',
		[{ actionId: 'pause', options: {} }],
		[{ feedbackId: 'paused', options: {}, style: { bgcolor: Colors.amber, color: Colors.black } }],
		icon(Icons.pause),
	)
	p.resume = key(
		'이어서 재생',
		'재생',
		[{ actionId: 'resume', options: {} }],
		[{ feedbackId: 'playing', options: {}, style: { bgcolor: Colors.green, color: Colors.white } }],
		icon(Icons.play),
	)
	p.go_selected = key(
		'고른 곡 처음부터 재생 (Go)',
		'GO',
		[{ actionId: 'go', options: { track: '', playlistId: '', trackId: '' } }],
		[{ feedbackId: 'playing', options: {}, style: { bgcolor: Colors.green, color: Colors.white } }],
		icon(Icons.go),
	)
	p.skip_back = key('10초 뒤로', '10초 뒤로', [{ actionId: 'skip', options: { by: -10 } }], [], icon(Icons.back10))
	p.skip_fwd = key('10초 앞으로', '10초 앞으로', [{ actionId: 'skip', options: { by: 10 } }], [], icon(Icons.fwd10))
	p.pad_page_previous = {
		...key('효과음 앞 뱅크', '앞 뱅크', [{ actionId: 'pad_page_previous', options: {} }], [], icon(Icons.page_prev)),
		keywords: ['pad', 'bank', '뱅크', 'page', '효과음'],
	}
	p.pad_page_next = {
		...key('효과음 다음 뱅크', '다음 뱅크', [{ actionId: 'pad_page_next', options: {} }], [], icon(Icons.page_next)),
		keywords: ['pad', 'bank', '뱅크', 'page', '효과음'],
	}
	p.pad_page_name = {
		...key(
			'효과음 뱅크 이름 (누르면 다음 뱅크)',
			`${V('pad_page_index')}/${V('pad_page_count')} ${V('pad_page_name')}`,
			[{ actionId: 'pad_page_next', options: {} }],
			[
				{
					feedbackId: 'pad_elsewhere',
					options: {},
					style: { bgcolor: Colors.orange, color: Colors.white },
				},
			],
			icon(Icons.page),
		),
		previewStyle: { text: '1/3 1부 시상식', ...icon(Icons.page) },
		keywords: ['pad', 'bank', '뱅크', 'page', '효과음'],
	}
	p.pads_stop = key(
		'효과음 전부 멈춤',
		'효과음 멈춤',
		[{ actionId: 'pads_stop', options: {} }],
		[],
		icon(Icons.pads_stop),
	)
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
		icon(Icons.announce),
	)
	p.output_problem = key(
		'출력 장치 문제 표시',
		'출력',
		[],
		[
			{
				feedbackId: 'output_problem',
				options: {},
				style: { bgcolor: Colors.red, color: Colors.white, text: '출력 문제' },
			},
		],
		icon(Icons.warning),
	)
	p.link = {
		type: 'simple',
		name: '연결 상태',
		style: style('큐플레이어', icon(Icons.link)),
		steps: [],
		feedbacks: [
			{ feedbackId: 'connected', options: {}, style: { bgcolor: Colors.green, color: Colors.white } },
			offline('연결 끊김'),
		],
	}

	const structure: CompanionPresetSection<ModuleSchema>[] = [
		{
			id: 'page15',
			name: '스트림덱 15키 한 장 · 15-key page',
			description:
				'5×3 그대로 놓으면 돼요. 1줄 재생/일시정지·페이드 정지·다음·즉시 정지·처음부터, 2줄 보이스오버·끝나면 정지·효과음 1~3, 3줄 효과음 4~8. 효과음 9·10번은 아래 "효과음" 묶음에 있어요 (17개라 한 장에 다 안 들어가요).',
			definitions: [
				{ id: 'row1', type: 'simple', name: '1줄 · 곡', presets: ['play_pause', 'fadeout', 'next', 'stop', 'restart'] },
				{
					id: 'row2',
					type: 'simple',
					name: '2줄 · 보이스오버 · 효과음',
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
					name: '효과음 1~10 · 전부 멈춤',
					presets: [
						'pad_1',
						'pad_2',
						'pad_3',
						'pad_4',
						'pad_5',
						'pad_6',
						'pad_7',
						'pad_8',
						'pad_9',
						'pad_10',
						'pads_stop',
					],
				},
				{
					id: 'pad_pages',
					type: 'simple',
					name: '효과음 뱅크 · 앞 뱅크 · 뱅크 이름 · 다음 뱅크 · Pad bank',
					presets: ['pad_page_previous', 'pad_page_name', 'pad_page_next'],
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
					presets: ['go_selected', 'pause', 'resume', 'previous', 'skip_back', 'skip_fwd', 'repeat_one'],
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
