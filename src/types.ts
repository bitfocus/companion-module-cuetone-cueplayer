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
