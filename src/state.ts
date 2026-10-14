import type { CuePlayerStatus } from './types.js'
import type { VariablesSchema } from './variables.js'

export const PAD_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

const STATE_LABEL: Record<string, string> = {
	playing: '재생 중',
	paused: '일시정지',
	stopped: '멈춤',
	fading: '페이드 중',
	disconnected: '연결 끊김',
}

/** 83.2 → "1:23"; 3725 → "1:02:05". `ceil` for count-downs so "0:00" means really over. */
export function formatTime(seconds: number | undefined | null, round: 'floor' | 'ceil' = 'floor'): string {
	if (seconds === undefined || seconds === null || !Number.isFinite(seconds)) return '--:--'
	const total = Math.max(0, round === 'ceil' ? Math.ceil(seconds - 1e-6) : Math.floor(seconds))
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	const ss = String(s).padStart(2, '0')
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/**
 * Status → Companion variables. `status === null` means "not connected": everything becomes unknown,
 * except pad names, which keep their last value so a pad key still says what it is.
 */
export function statusToVariables(
	status: CuePlayerStatus | null,
	previous?: Partial<VariablesSchema>,
): VariablesSchema {
	const vars = {} as VariablesSchema
	if (!status) {
		vars.state = 'disconnected'
		vars.state_label = STATE_LABEL.disconnected
		vars.current_title = ''
		vars.current_playlist = ''
		vars.remaining = '--:--'
		vars.remaining_seconds = ''
		vars.elapsed = '--:--'
		vars.next_title = ''
		vars.cued_title = ''
		for (const n of PAD_SLOTS) vars[`pad_${n}_name`] = previous?.[`pad_${n}_name`] ?? ''
		return vars
	}
	const state = status.state ?? (status.current ? 'paused' : 'stopped')
	const hasCurrent = !!status.current
	vars.state = state
	vars.state_label = STATE_LABEL[state] ?? state
	vars.current_title = status.current?.title ?? ''
	vars.current_playlist = status.current?.playlist ?? ''
	const remaining = hasCurrent ? (status.remaining ?? 0) : 0
	vars.remaining = hasCurrent ? formatTime(remaining, 'ceil') : '0:00'
	vars.remaining_seconds = hasCurrent ? Math.max(0, Math.ceil(remaining - 1e-6)) : 0
	vars.elapsed = hasCurrent ? formatTime(status.position ?? 0) : '0:00'
	vars.next_title = status.next?.title ?? ''
	vars.cued_title = status.cued?.title ?? ''
	for (const n of PAD_SLOTS) {
		const pad = status.pads?.find((p) => p.slot === n)
		vars[`pad_${n}_name`] = pad && !pad.empty ? pad.name : ''
	}
	return vars
}

/** Feedback rules. All of them are false while disconnected, so a key never stays green on stale data. */
export const Checks = {
	connected: (s: CuePlayerStatus | null): boolean => s !== null,
	disconnected: (s: CuePlayerStatus | null): boolean => s === null,
	playing: (s: CuePlayerStatus | null): boolean => s?.state === 'playing',
	paused: (s: CuePlayerStatus | null): boolean => s?.state === 'paused',
	fading: (s: CuePlayerStatus | null): boolean => s?.state === 'fading',
	stopped: (s: CuePlayerStatus | null): boolean => s?.state === 'stopped',
	background: (s: CuePlayerStatus | null): boolean => s?.background === true,
	stopAfter: (s: CuePlayerStatus | null): boolean => s?.stopAfter === true,
	announcing: (s: CuePlayerStatus | null): boolean => s?.announcing === true,
	outputProblem: (s: CuePlayerStatus | null): boolean => !!s?.output?.problem,
	padPlaying: (s: CuePlayerStatus | null, slot: number): boolean =>
		!!s?.pads?.some((p) => p.slot === slot && p.playing && !p.empty),
	/** Only while sound is actually running (playing or fading) — a paused song is not "about to end". */
	remainingBelow: (s: CuePlayerStatus | null, seconds: number): boolean =>
		!!s && !!s.current && (s.state === 'playing' || s.state === 'fading') && (s.remaining ?? Infinity) < seconds,
}

/** What the client-side play/pause toggle should send for this status. */
export function toggleCommand(status: CuePlayerStatus | null): 'pause' | 'resume' | 'go' {
	if (status?.state === 'playing' || status?.state === 'fading') return 'pause'
	// nothing loaded: 'go' plays the cued / selected song in the app ('resume' would answer no_track)
	if (status && !status.current) return 'go'
	return 'resume'
}
