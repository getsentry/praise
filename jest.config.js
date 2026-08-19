module.exports = {
  roots: ['src'],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test-support/jest.setup.ts'],
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          // Mirrors the swc-loader settings in webpack/webpack.common.js.
          transform: { react: { runtime: 'automatic' } },
        },
      },
    ],
    '^.+\\.m?js$': ['@swc/jest', { jsc: { parser: { syntax: 'ecmascript' } } }],
  },
  // `text-field-edit` is ESM only, and node_modules is not transformed by default.
  transformIgnorePatterns: ['/node_modules/(?!text-field-edit/)'],
};
