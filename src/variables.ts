import type { CompanionVariableDefinitions } from '@companion-module/base'

type PadNameVariables = {
	[K in `pad_${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}_name`]: string
}

export type VariablesSchema = {
	/** playing · paused · stopped · fading · disconnected */
	state: string
	/** 재생 중 · 일시정지 · 멈춤 · 페이드 중 · 연결 끊김 */
	state_label: string
	current_title: string
	current_playlist: string
	/** m:ss (h:mm:ss over an hour), counting down */
	remaining: string
	/** whole seconds, '' when unknown */
	remaining_seconds: number | string
	elapsed: string
	next_title: string
	/** the song ⏮ goes back to (before the current one in its list), '' at the first song */
	previous_title: string
	previous_playlist: string
	cued_title: string
} & PadNameVariables

export function variableDefinitions(): CompanionVariableDefinitions<VariablesSchema> {
	const defs: Record<string, { name: string }> = {
		state: { name: '상태 (playing / paused / stopped / fading / disconnected)' },
		state_label: { name: '상태 (한글: 재생 중 · 일시정지 · 멈춤 · 페이드 중 · 연결 끊김)' },
		current_title: { name: '지금 곡 제목' },
		current_playlist: { name: '지금 곡의 목록 이름' },
		remaining: { name: '남은 시간 (m:ss)' },
		remaining_seconds: { name: '남은 시간 (초)' },
		elapsed: { name: '지난 시간 (m:ss)' },
		next_title: { name: '다음에 이어질 곡 제목' },
		previous_title: { name: '이전 곡 제목 (⏮ 로 돌아갈 곡, 첫 곡이면 비어 있음)' },
		previous_playlist: { name: '이전 곡의 목록 이름' },
		cued_title: { name: '올려 둔(대기) 곡 제목' },
	}
	for (let n = 1; n <= 10; n++) defs[`pad_${n}_name`] = { name: `효과음 ${n}번 칸 이름` }
	return defs as CompanionVariableDefinitions<VariablesSchema>
}
