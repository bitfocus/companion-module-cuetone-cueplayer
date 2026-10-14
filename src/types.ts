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
	locked?: boolean
	pads?: PadState[]
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
