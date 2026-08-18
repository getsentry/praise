module.exports = {
  roots: ['src'],
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: { parser: { syntax: 'typescript', tsx: true } },
      },
    ],
  },
};
