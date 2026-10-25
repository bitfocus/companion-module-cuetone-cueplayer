/** Shapes returned by CuePlayer remote API v1 (Sources/RemoteControl.swift `status()` and `/playlists`). */

export type PlayState = 'playing' | 'paused' | 'stopped' | 'fading'

export interface TrackRef {
	id: string
	title: string
	duration?: number
}

export interface CurrentTrack extends TrackRef {
	playlistId?: string
	/** playlist name */
	playlist?: string
}

export interface PadState {
	slot: number
	name: string
	playing: boolean
	empty: boolean
}

/** 효과음 판 (CuePlayer 맥 1.1.53 · 윈도우 1.0.63~). 옛 CuePlayer 는 안 보냄 */
export interface PadPageInfo {
	/** 1부터 */
	index: number
	count: number
	name: string
	names?: string[]
}

export interface CuePlayerStatus {
	apiVersion: number
	appVersion?: string
	instanceId?: string
	revision?: number
	state?: PlayState
	current?: CurrentTrack | null
	cued?: TrackRef | null
	next?: TrackRef | null
	position?: number
	remaining?: number
	/** 겹치기 중 끝나 가는 앞 곡 (CuePlayer 1.1.22~). 있으면 남은 시간은 이 곡 기준 — 3·2·1 을 끝까지 */
	ending?: { id?: string; title: string; remaining: number } | null
	background?: boolean
	stopAfter?: boolean
	/** 한 곡 반복 중 (CuePlayer 10-21~). 옛 CuePlayer 는 안 보냄 */
	repeat?: boolean
	locked?: boolean
	/** 지금 판의 10칸 */
	pads?: PadState[]
	/** 지금 보고 있는 효과음 판 */
	padPage?: PadPageInfo
	/** 판을 넘긴 뒤에도 다른 판에서 나오는 효과음 (자리 번호 · 이름), 없으면 안 옴 */
	padPlayingElsewhere?: { slot: number; name: string } | null
	announcing?: boolean
	output?: { name?: string; problem?: string | null }
}

export interface PlaylistSummary {
	id: string
	name: string
	trackCount?: number
	user?: boolean
}

export interface PlaylistTrack {
	id: string
	title: string
	missing?: boolean
	duration?: number
}

export interface PlaylistDetail {
	id: string
	name: string
	tracks: PlaylistTrack[]
}
