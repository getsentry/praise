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
  },
};
