module.exports = {
  roots: ['src', 'scripts'],
  moduleFileExtensions: ['ts', 'tsx', 'mjs', 'js'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.mjs'],
  transform: {
    '^.+\\.(tsx?|mjs)$': [
      '@swc/jest',
      {
        jsc: { parser: { syntax: 'typescript', tsx: true } },
      },
    ],
  },
};
