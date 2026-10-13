import type { SomeCompanionConfigField } from '@companion-module/base'

export const DEFAULT_PORT = 53100
export const DEFAULT_POLL_MS = 300

export type ModuleConfig = {
	host: string
	port: number
	pollInterval: number
}

/** Stored by Companion apart from the config (kept out of logs and optional in exports) */
export type ModuleSecrets = {
	token?: string
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			label: '큐플레이어 준비',
			width: 12,
			value:
				'큐플레이어 설정 → 원격 조작 → "원격 조작 받기"를 켜 주세요. 같은 컴퓨터면 주소 127.0.0.1 그대로, 다른 컴퓨터면 받을 곳을 "같은 네트워크"로 바꾸고 그 컴퓨터의 IP 와 토큰을 넣어요.',
		},
		{
			type: 'static-text',
			id: 'info_en',
			label: 'Setup',
			width: 12,
			value:
				'In CuePlayer turn on Settings → Remote control. Same computer: keep 127.0.0.1. Another computer: set CuePlayer to "same network" and enter its IP address and token.',
		},
		{
			type: 'textinput',
			id: 'host',
			label: '주소 (IP) · Host',
			width: 8,
			default: '127.0.0.1',
			minLength: 1,
		},
		{
			type: 'number',
			id: 'port',
			label: '포트 · Port',
			width: 4,
			min: 1,
			max: 65535,
			default: DEFAULT_PORT,
			asInteger: true,
		},
		{
			type: 'secret-text',
			id: 'token',
			label: '토큰 (같은 네트워크일 때) · Token',
			description:
				'큐플레이어 설정 → 원격 조작의 토큰. 이 컴퓨터만 받을 때는 비워 둬도 돼요. Sent as Authorization: Bearer.',
			width: 12,
			default: '',
		},
		{
			type: 'number',
			id: 'pollInterval',
			label: '상태 확인 간격 (ms) · Poll interval',
			width: 4,
			min: 100,
			max: 5000,
			default: DEFAULT_POLL_MS,
			asInteger: true,
		},
	]
}

/** Fill gaps / clamp, so a half-filled config still works */
export function normalizeConfig(config: Partial<ModuleConfig> | undefined): ModuleConfig {
	const port = Number(config?.port)
	const poll = Number(config?.pollInterval)
	return {
		host: (config?.host ?? '').trim() || '127.0.0.1',
		port: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : DEFAULT_PORT,
		pollInterval: Number.isFinite(poll) ? Math.min(5000, Math.max(100, Math.round(poll))) : DEFAULT_POLL_MS,
	}
}
