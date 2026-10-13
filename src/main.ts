import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, normalizeConfig, type ModuleConfig, type ModuleSecrets } from './config.js'
import { variableDefinitions, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { actionDefinitions, type ActionsSchema } from './actions.js'
import { FEEDBACK_GROUPS, feedbackDefinitions, type FeedbackId, type FeedbacksSchema } from './feedbacks.js'
import { presetDefinitions } from './presets.js'
import { CuePlayerConnection, type LinkState } from './connection.js'
import { statusToVariables } from './state.js'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: ModuleSecrets
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

const LINK_STATUS: Record<LinkState, InstanceStatus> = {
	connecting: InstanceStatus.Connecting,
	ok: InstanceStatus.Ok,
	connection_failure: InstanceStatus.ConnectionFailure,
	auth_failure: InstanceStatus.AuthenticationFailure,
}

export default class CuePlayerInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig
	conn: CuePlayerConnection | undefined

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig, _isFirstInit: boolean, secrets: ModuleSecrets | undefined): Promise<void> {
		this.setVariableDefinitions(variableDefinitions())
		this.setVariableValues(statusToVariables(null))
		this.setFeedbackDefinitions(feedbackDefinitions(() => this.conn?.status ?? null))
		this.updateActions()
		const { structure, presets } = presetDefinitions()
		this.setPresetDefinitions(structure, presets)
		this.connect(config, secrets)
	}

	async destroy(): Promise<void> {
		this.conn?.stop()
		this.conn = undefined
	}

	async configUpdated(config: ModuleConfig, secrets: ModuleSecrets | undefined): Promise<void> {
		this.connect(config, secrets)
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	private connect(config: ModuleConfig, secrets: ModuleSecrets | undefined): void {
		this.conn?.stop()
		this.config = normalizeConfig(config)
		this.conn = new CuePlayerConnection(
			{
				setVariableValues: (values) => this.setVariableValues(values),
				checkFeedbacks: (groups) => {
					const ids = new Set<FeedbackId>(groups.flatMap((g) => FEEDBACK_GROUPS[g]))
					const [first, ...rest] = [...ids]
					if (first) this.checkFeedbacks(first, ...rest)
				},
				setLinkState: (state, message) => this.updateStatus(LINK_STATUS[state], message),
				log: (level, message) => this.log(level, message),
				libraryChanged: () => this.updateActions(),
			},
			{
				host: this.config.host,
				port: this.config.port,
				token: secrets?.token ?? '',
				pollMs: this.config.pollInterval,
			},
		)
		this.conn.start()
	}

	updateActions(): void {
		this.setActionDefinitions(
			actionDefinitions({
				library: () => this.conn?.library,
				status: () => this.conn?.status ?? null,
				send: async (req, label) => (this.conn ? this.conn.send(req, label) : false),
				togglePlayPause: async () => (this.conn ? this.conn.togglePlayPause() : false),
				log: (level, message) => this.log(level, message),
			}),
		)
	}
}
