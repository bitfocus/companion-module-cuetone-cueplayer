import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

export default [
	// vitest.config.ts isn't part of a tsconfig, so skip type-aware linting of it
	{
		ignores: ['vitest.config.ts'],
	},
	...(await generateEslintConfig({
		enableTypescript: true,
	})),
	{
		files: ['test/**/*'],
		rules: {
			// tests may import devDependencies (vitest) and the plain-JS mock server
			'n/no-unpublished-import': 'off',
			'n/no-missing-import': 'off',
			// false positives on expect(obj.method).toHaveBeenCalled*()
			'@typescript-eslint/unbound-method': 'off',
		},
	},
]
