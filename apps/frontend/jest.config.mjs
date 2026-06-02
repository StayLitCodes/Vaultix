import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const customConfig = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  // Add more setup options before each test is run
  setupFiles: ['<rootDir>/jest.setup.global.mjs'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    // Handle module aliases
    '^@/(.*)$': '<rootDir>/$1',
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
const asyncConfig = createJestConfig(customConfig)

export default async () => {
    const config = await asyncConfig()
    // Explicitly override transformIgnorePatterns because next/jest can be picky
    config.transformIgnorePatterns = [
        'node_modules/(?!(msw|@mswjs|@bundled-es-modules|undici|@stellar/freighter-api|until-async)/)',
    ]
    return config
}
