module.exports = {
  roots: ['src'],
  // The extension is all DOM work, and Jest 30 no longer bundles jsdom.
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: { parser: { syntax: 'typescript', tsx: true } },
      },
    ],
    '^.+\\.jsx?$': [
      '@swc/jest',
      {
        jsc: { parser: { syntax: 'ecmascript' } },
      },
    ],
  },
  // text-field-edit ships as an ES module; Jest's CJS runtime can't require()
  // it unless it's transformed too, so it can't stay in the default ignore list.
  transformIgnorePatterns: ['node_modules/(?!text-field-edit/)'],
};
