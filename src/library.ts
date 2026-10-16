import type { DropdownChoice } from '@companion-module/base'
import type { CuePlayerClient } from './api.js'
import { ApiError } from './api.js'
import type { CuePlayerStatus, PlaylistDetail, PlaylistTrack } from './types.js'

/** Value of the "곡" dropdown that means "the song chosen / cued in the app" (go without ids) */
export const TRACK_SELECTED = ''
/** Value of the "곡" dropdown that shows the free-text id fields */
export const TRACK_CUSTOM = 'custom'

export interface Library {
	playlists: PlaylistDetail[]
}

/** Load every playlist with its tracks, one request at a time (gentle on the app's tiny HTTP server). */
export async function loadLibrary(client: CuePlayerClient): Promise<Library> {
	const summaries = await client.getPlaylists()
	const playlists: PlaylistDetail[] = []
	for (const s of summaries) {
		try {
			playlists.push(await client.getPlaylist(s.id))
		} catch (e) {
			// a list deleted between the two calls: skip it, anything else is a real failure
			if (e instanceof ApiError && e.code === 'not_found') continue
			throw e
		}
	}
	return { playlists }
}

/** "p…:t…" — the go dropdown keeps the playlist with the track (one song can be in several lists). */
export function encodeTrackChoice(playlistId: string, trackId: string): string {
	return `${playlistId}:${trackId}`
}

export function decodeTrackChoice(value: string): { playlistId?: string; trackId?: string } {
	const v = value.trim()
	if (!v || v === TRACK_CUSTOM) return {}
	const i = v.indexOf(':')
	if (i < 0) return { trackId: v }
	return { playlistId: v.slice(0, i) || undefined, trackId: v.slice(i + 1) || undefined }
}

export function trackChoices(lib: Library | undefined): DropdownChoice<string>[] {
	const out: DropdownChoice<string>[] = [
		{ id: TRACK_SELECTED, label: '앱에서 고른 곡 · 올려 둔 곡' },
		{ id: TRACK_CUSTOM, label: '직접 입력 (목록 ID · 곡 ID)' },
	]
	for (const p of lib?.playlists ?? []) {
		for (const t of p.tracks) {
			if (t.missing) continue
			out.push({ id: encodeTrackChoice(p.id, t.id), label: `${p.name} › ${t.title}` })
		}
	}
	return out
}

export function playlistChoices(lib: Library | undefined): DropdownChoice<string>[] {
	return [{ id: '', label: '(아무 목록)' }, ...(lib?.playlists ?? []).map((p) => ({ id: p.id, label: p.name }))]
}

/** Stable fingerprint, to redefine actions only when the dropdowns really change */
export function libraryKey(lib: Library | undefined): string {
	return JSON.stringify(
		(lib?.playlists ?? []).map((p) => [p.id, p.name, p.tracks.map((t) => [t.id, t.title, !!t.missing])]),
	)
}

/**
 * The song CuePlayer's ⏮ (transport/previous) would go to: the one before the current song in its playlist.
 * CuePlayer plays a list as a queue without the songs whose file is missing (`tracks.filter { !$0.missing }`),
 * so those are skipped here too. Section markers are not rows in `/playlists/{id}`, so nothing else to skip.
 * null when nothing is loaded, at the first song, or when the list / song isn't known (yet).
 */
export function previousTrack(
	status: CuePlayerStatus | null | undefined,
	lib: Library | undefined,
): { track: PlaylistTrack; playlist: PlaylistDetail } | null {
	const cur = status?.current
	if (!cur?.id || !cur.playlistId) return null
	const playlist = lib?.playlists.find((p) => p.id === cur.playlistId)
	if (!playlist) return null
	const playable = playlist.tracks.filter((t) => !t.missing)
	const i = playable.findIndex((t) => t.id === cur.id)
	return i > 0 ? { track: playable[i - 1], playlist } : null
}
