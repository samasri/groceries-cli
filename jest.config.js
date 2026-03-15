/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/__specs__'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
        module: 'commonjs',
        target: 'ES2022',
      },
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/__specs__/**',
    '!src/cli.ts',
  ],
};
